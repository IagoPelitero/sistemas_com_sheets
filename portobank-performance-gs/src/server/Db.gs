/**
 * ============================================================
 * PortoBank Performance — Db.js
 * ------------------------------------------------------------
 * Responsabilidade única: camada de acesso a dados.
 * O Google Sheets é tratado como banco de dados. NENHUMA
 * fórmula é usada na planilha — todo cálculo acontece aqui
 * no Apps Script.
 *
 * Recursos:
 *   - CRUD genérico por nome de aba
 *   - Cache de leitura (CacheService) para respostas rápidas
 *   - Paginação e busca em memória
 *   - Índice em memória por coluna (busca O(1) por id/e-mail)
 *   - Escrita em lote (setValues) para performance
 * ============================================================
 */

var Db = (function () {

  /** Retorna a planilha-banco, criando-a via Setup se necessário */
  function ss_() {
    var id = CONFIG.SPREADSHEET_ID ||
             PropertiesService.getScriptProperties().getProperty(CONFIG.PROP_SSID);
    if (!id) {
      // Primeira execução: o Setup cria o banco e grava o ID
      id = Setup.criarBanco();
    }
    return SpreadsheetApp.openById(id);
  }

  function sheet_(nome) {
    var sh = ss_().getSheetByName(nome);
    if (!sh) throw new Error('Aba não encontrada: ' + nome);
    return sh;
  }

  function cacheKey_(nome) { return 'tbl_' + nome; }

  /**
   * Lê a aba inteira e devolve array de objetos {coluna: valor}.
   * Usa cache para evitar leituras repetidas do Sheets.
   */
  function readAll(nome, ignorarCache) {
    var cache = CacheService.getScriptCache();
    if (!ignorarCache) {
      var hit = cache.get(cacheKey_(nome));
      if (hit) return JSON.parse(hit);
    }
    var sh = sheet_(nome);
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return [];
    var headers = values[0];
    var rows = [];
    for (var i = 1; i < values.length; i++) {
      var obj = { _row: i + 1 };                 // linha física p/ updates
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
      rows.push(obj);
    }
    try {
      var json = JSON.stringify(rows);
      if (json.length < 95000) cache.put(cacheKey_(nome), json, CONFIG.CACHE_TTL);
    } catch (e) { /* tabela grande demais para cache — segue sem */ }
    return rows;
  }

  /** Invalida o cache de uma aba após escrita */
  function bust(nome) {
    CacheService.getScriptCache().remove(cacheKey_(nome));
  }

  /** Índice em memória: { valorDaColuna: linhaObjeto } */
  function indexBy(nome, coluna) {
    var rows = readAll(nome);
    var idx = {};
    rows.forEach(function (r) { idx[String(r[coluna])] = r; });
    return idx;
  }

  /** Gera ID sequencial curto e único por tabela */
  function nextId(nome) {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var props = PropertiesService.getScriptProperties();
      var key = 'seq_' + nome;
      var n = Number(props.getProperty(key) || 0) + 1;
      props.setProperty(key, String(n));
      return nome.substring(0, 3).toUpperCase() + '-' + Utilities.formatString('%06d', n);
    } finally { lock.releaseLock(); }
  }

  /** Insere um objeto respeitando a ordem dos cabeçalhos da aba */
  function insert(nome, obj) {
    var sh = sheet_(nome);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
    sh.appendRow(row);
    bust(nome);
    return obj;
  }

  /** Insere vários objetos em uma única escrita (performance) */
  function insertMany(nome, objs) {
    if (!objs.length) return;
    var sh = sheet_(nome);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var matrix = objs.map(function (o) {
      return headers.map(function (h) { return o[h] !== undefined ? o[h] : ''; });
    });
    sh.getRange(sh.getLastRow() + 1, 1, matrix.length, headers.length).setValues(matrix);
    bust(nome);
  }

  /** Atualiza a linha cujo campo `id` bate; devolve o objeto novo */
  function update(nome, id, changes) {
    var sh = sheet_(nome);
    var rows = readAll(nome, true);
    var alvo = null;
    for (var i = 0; i < rows.length; i++) if (String(rows[i].id) === String(id)) { alvo = rows[i]; break; }
    if (!alvo) throw new Error('Registro não encontrado em ' + nome + ': ' + id);

    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var novo = {};
    headers.forEach(function (h) {
      novo[h] = changes.hasOwnProperty(h) ? changes[h] : alvo[h];
    });
    var linha = headers.map(function (h) { return novo[h] !== undefined ? novo[h] : ''; });
    sh.getRange(alvo._row, 1, 1, headers.length).setValues([linha]);
    bust(nome);
    return { antes: alvo, depois: novo };
  }

  /** Exclusão lógica quando existir coluna `ativo`; física caso contrário */
  function remove(nome, id) {
    var rows = readAll(nome, true);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].id) === String(id)) {
        var sh = sheet_(nome);
        if (rows[i].hasOwnProperty('ativo')) {
          return update(nome, id, { ativo: false });
        }
        sh.deleteRow(rows[i]._row);
        bust(nome);
        return { antes: rows[i], depois: null };
      }
    }
    throw new Error('Registro não encontrado: ' + id);
  }

  /**
   * Consulta com filtro, busca textual, ordenação e paginação.
   * opts = { filtro: fn(row), busca: 'texto', pagina: 1,
   *          porPagina: 25, ordenarPor: 'data', desc: true }
   */
  function query(nome, opts) {
    opts = opts || {};
    var rows = readAll(nome);

    if (opts.filtro) rows = rows.filter(opts.filtro);

    if (opts.busca) {
      var q = String(opts.busca).toLowerCase();
      rows = rows.filter(function (r) {
        return Object.keys(r).some(function (k) {
          return k !== '_row' && String(r[k]).toLowerCase().indexOf(q) !== -1;
        });
      });
    }

    if (opts.ordenarPor) {
      var col = opts.ordenarPor, mult = opts.desc ? -1 : 1;
      rows.sort(function (a, b) { return (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * mult; });
    }

    var total = rows.length;
    var porPagina = opts.porPagina || CONFIG.PAGE_SIZE;
    var pagina = Math.max(1, opts.pagina || 1);
    var inicio = (pagina - 1) * porPagina;

    return {
      total: total,
      pagina: pagina,
      porPagina: porPagina,
      paginas: Math.ceil(total / porPagina),
      itens: rows.slice(inicio, inicio + porPagina)
    };
  }

  return {
    readAll: readAll,
    indexBy: indexBy,
    insert: insert,
    insertMany: insertMany,
    update: update,
    remove: remove,
    query: query,
    nextId: nextId,
    bust: bust,
    _ss: ss_
  };
})();
