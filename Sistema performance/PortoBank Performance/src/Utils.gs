/**
 * ============================================================
 * PortoBank Performance — Utils.gs
 * ------------------------------------------------------------
 * Funções utilitárias + camada de acesso a dados (DB).
 * TODO acesso à planilha passa por aqui — os demais módulos
 * nunca chamam SpreadsheetApp diretamente para CRUD.
 * ============================================================
 */

/** Retorna a planilha ativa (banco de dados). */
function getDb_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/** Cache (por execução) dos cabeçalhos REAIS de cada aba. */
var HEADER_CACHE_ = {};

/**
 * Cabeçalhos REAIS da aba (primeira linha da planilha).
 * O sistema SEMPRE lê e escreve pelas colunas que existem no
 * Sheets — nunca pela ordem do código — para jamais sobrescrever
 * dados de colunas reordenadas ou de versões anteriores.
 */
function headersOf_(sheet, name) {
  if (HEADER_CACHE_[name]) return HEADER_CACHE_[name];
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) { HEADER_CACHE_[name] = HEADERS[name]; return HEADER_CACHE_[name]; }
  const first = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
  while (first.length && !first[first.length - 1]) first.pop(); // remove vazios do fim
  HEADER_CACHE_[name] = first.length ? first : HEADERS[name];
  return HEADER_CACHE_[name];
}

/**
 * Garante que a aba exista e que os cabeçalhos do sistema
 * estejam presentes. Colunas novas (ex.: metaRetencaoCartao)
 * são ACRESCENTADAS ao final — as existentes nunca são
 * renomeadas, movidas ou apagadas (nada é sobrescrito).
 * @param {string} name Nome da aba (ver SHEETS).
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSheet_(name) {
  const db = getDb_();
  let sheet = db.getSheetByName(name);
  if (!sheet) {
    sheet = db.insertSheet(name);
    sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    HEADER_CACHE_[name] = null;
    return sheet;
  }
  // Reconciliação: acrescenta apenas as colunas que faltam
  const real = headersOf_(sheet, name);
  const missing = HEADERS[name].filter(function (h) { return real.indexOf(h) === -1; });
  if (missing.length) {
    sheet.getRange(1, real.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
    HEADER_CACHE_[name] = null;
    cacheInvalidate_(name);
  }
  return sheet;
}

/**
 * Gera um ID único, CRESCENTE e somente hexadecimal (0-9, a-f):
 *   [12 dígitos] timestamp em ms com zeros à esquerda — garante
 *     ordenação cronológica por simples comparação de texto e só
 *     "estoura" os 12 dígitos no ano ~10.889;
 *   [12 dígitos] aleatórios do UUID — 2^48 (~281 trilhões) de
 *     combinações POR MILISSEGUNDO, colisão desprezível.
 * Ex.: "0197f4a2c8e13fa8c21b9de4" (24 caracteres).
 * IDs antigos (aleatório+timestamp) continuam válidos: unicidade é
 * por igualdade e nenhuma ordenação do sistema depende do id.
 */
function uid_() {
  const ts = ('000000000000' + Date.now().toString(16)).slice(-12);
  return ts + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}

/** Data/hora atual em ISO. */
function nowIso_() {
  return new Date().toISOString();
}

/**
 * Memo POR EXECUÇÃO: uma mesma chamada de api() lê cada aba no
 * máximo UMA vez. Sem isto, montar um dashboard desserializava a
 * aba Settings do CacheService dezenas de vezes (cada settingGet_
 * refazia fetch + JSON.parse). Invalidação em cacheInvalidate_.
 */
var EXEC_ROWS_ = {};

/**
 * Lê TODAS as linhas de uma aba como objetos — com memo de
 * execução + CacheService. ÚNICA função de leitura em massa.
 * @param {string} sheetName
 * @return {Object[]} linhas como objetos {header: valor}
 */
function readAll_(sheetName) {
  if (EXEC_ROWS_[sheetName]) return EXEC_ROWS_[sheetName];

  const cached = cacheGet_(sheetName);
  if (cached) { EXEC_ROWS_[sheetName] = cached; return cached; }

  const sheet = ensureSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { cachePut_(sheetName, []); EXEC_ROWS_[sheetName] = []; return []; }

  const headers = headersOf_(sheet, sheetName);
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const rows = values.map(function (r) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = r[i]; });
    return obj;
  });
  cachePut_(sheetName, rows);
  EXEC_ROWS_[sheetName] = rows;
  return rows;
}

/**
 * Acrescenta uma linha (objeto) a uma aba, com Lock e
 * invalidação de cache.
 * @param {string} sheetName
 * @param {Object} obj
 */
function appendRow_(sheetName, obj) {
  withLock_(function () {
    const sheet = ensureSheet_(sheetName);
    const headers = headersOf_(sheet, sheetName);
    const row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
    sheet.appendRow(row);
  });
  cacheInvalidate_(sheetName);
}

/**
 * Acrescenta VÁRIAS linhas de uma vez (importações): uma única
 * trava, um único setValues e uma única invalidação de cache —
 * nunca uma escrita por linha.
 * @param {string} sheetName
 * @param {Object[]} objs
 */
function appendRows_(sheetName, objs) {
  if (!objs.length) return;
  withLock_(function () {
    const sheet = ensureSheet_(sheetName);
    const headers = headersOf_(sheet, sheetName);
    const rows = objs.map(function (obj) {
      return headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  });
  cacheInvalidate_(sheetName);
}

/**
 * Atualiza a linha cujo campo `id` corresponda.
 * @param {string} sheetName
 * @param {string} id
 * @param {Object} patch Campos a alterar.
 * @return {boolean} true se encontrou e atualizou.
 */
function updateRowById_(sheetName, id, patch) {
  let updated = false;
  withLock_(function () {
    const sheet = ensureSheet_(sheetName);
    const headers = headersOf_(sheet, sheetName);
    const idCol = headers.indexOf('id') + 1;
    const rowIndex = findRowIndexById_(sheet, idCol, id);
    if (rowIndex === -1) return;
    const range = sheet.getRange(rowIndex, 1, 1, headers.length);
    const current = range.getValues()[0];
    headers.forEach(function (h, i) {
      if (patch[h] !== undefined) current[i] = patch[h];
    });
    range.setValues([current]);
    updated = true;
  });
  if (updated) cacheInvalidate_(sheetName);
  return updated;
}

/**
 * EXCLUI DEFINITIVAMENTE a linha (deleteRow) — sem soft delete,
 * sem lixo de dados.
 * @param {string} sheetName
 * @param {string} id
 * @return {boolean}
 */
function deleteRowById_(sheetName, id) {
  let deleted = false;
  withLock_(function () {
    const sheet = ensureSheet_(sheetName);
    const idCol = headersOf_(sheet, sheetName).indexOf('id') + 1;
    const rowIndex = findRowIndexById_(sheet, idCol, id);
    if (rowIndex === -1) return;
    sheet.deleteRow(rowIndex);
    deleted = true;
  });
  if (deleted) cacheInvalidate_(sheetName);
  return deleted;
}

/**
 * Localiza o índice (1-based) da linha pelo id usando busca
 * apenas na coluna de id (leitura mínima, sem varrer a planilha).
 */
function findRowIndexById_(sheet, idCol, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

/**
 * Executa uma função com LockService (evita corrida em escrita
 * concorrente — preparado para centenas de usuários).
 */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // até 20s
  try { return fn(); } finally { lock.releaseLock(); }
}

/**
 * Últimos lançamentos do PRÓPRIO usuário em uma aba (Sales ou
 * Retention), do mais recente para o mais antigo.
 * @param {string} sheetName
 * @param {Object} me
 * @param {number} limit
 * @return {Object[]}
 */
function ownRecentEntries_(sheetName, me, limit) {
  return readAll_(sheetName)
    .filter(function (r) { return String(r.userId) === String(me.id); })
    .sort(function (a, b) { return String(b.criadoEm).localeCompare(String(a.criadoEm)); })
    .slice(0, limit);
}

/**
 * Últimos lançamentos no escopo do gestor: equipe do supervisor
 * ou, para ADMIN, todos.
 * @param {string} sheetName
 * @param {Object} me Supervisor ou ADMIN.
 * @param {number} limit
 * @return {Object[]}
 */
function teamRecentEntries_(sheetName, me, limit) {
  const equipe = isAdmin_(me) ? null : String(me.equipe);
  return readAll_(sheetName)
    .filter(function (r) { return equipe === null || String(r.equipe) === equipe; })
    .sort(function (a, b) { return String(b.criadoEm).localeCompare(String(a.criadoEm)); })
    .slice(0, limit);
}

/**
 * Exclui um lançamento (venda/retenção) com regra de autonomia:
 *  - Dono: somente entre os próprios ENTRY_DELETE_LIMIT mais recentes;
 *  - Supervisor: qualquer lançamento da própria equipe;
 *  - ADMIN: qualquer lançamento.
 * A exclusão é definitiva (deleteRow) e todos os indicadores e
 * comissões são recalculados na próxima leitura — nada derivado
 * fica gravado na planilha.
 * @param {string} sheetName
 * @param {Object} me
 * @param {string} id
 * @return {Object} a linha excluída (para auditoria).
 */
function entryDelete_(sheetName, me, id) {
  const row = readAll_(sheetName).find(function (r) { return String(r.id) === String(id); });
  if (!row) throw new Error('Registro não encontrado.');
  const own = String(row.userId) === String(me.id);
  if (own) {
    const recente = ownRecentEntries_(sheetName, me, ENTRY_DELETE_LIMIT)
      .some(function (r) { return String(r.id) === String(id); });
    if (!recente) {
      throw new Error('Você só pode excluir os seus ' + ENTRY_DELETE_LIMIT + ' lançamentos mais recentes.');
    }
  } else if (!isAdmin_(me) && !(isSupervisor_(me) && String(row.equipe) === String(me.equipe))) {
    throw new Error('Sem permissão para excluir este lançamento.');
  }
  if (!deleteRowById_(sheetName, id)) throw new Error('Falha ao excluir o registro.');
  return row;
}

/** Mapa id → nome de usuário (montado UMA vez por operação). */
function userNameMap_() {
  const map = {};
  readAll_(SHEETS.USERS).forEach(function (u) { map[String(u.id)] = u.nome; });
  return map;
}

/**
 * IDEMPOTÊNCIA anti-duplo-clique: cada operação de ESCRITA do
 * cliente envia um reqId único; se o mesmo reqId chegar de novo
 * (duplo clique, retry de rede, latência), a segunda chamada é
 * rejeitada ANTES de gravar. Verificação sob lock (check-and-set
 * atômico) com validade de 10 minutos no CacheService.
 * @param {string=} reqId
 */
function dedupeGuard_(reqId) {
  if (!reqId) return;
  withLock_(function () {
    const key = CACHE_PREFIX + 'req:' + String(reqId);
    if (cache_().get(key)) {
      throw new Error('Esta operação já foi processada — o clique duplo foi ignorado.');
    }
    cache_().put(key, '1', 600);
  });
}

/**
 * Segunda camada anti-duplicidade: rejeita um lançamento IDÊNTICO
 * (mesmo usuário e mesmos campos) criado nos últimos `seconds`
 * segundos — cobre duplo envio por duas abas/dispositivos, que o
 * reqId não alcança.
 * @param {string} sheetName
 * @param {Object} candidate
 * @param {string[]} fields Campos que definem "idêntico".
 * @param {number} seconds Janela de proteção.
 */
function assertNoRecentDuplicate_(sheetName, candidate, fields, seconds) {
  const cutoff = Date.now() - seconds * 1000;
  const dup = readAll_(sheetName).some(function (r) {
    if (String(r.userId) !== String(candidate.userId)) return false;
    const t = new Date(r.criadoEm).getTime();
    if (isNaN(t) || t < cutoff) return false;
    return fields.every(function (f) { return String(r[f]) === String(candidate[f]); });
  });
  if (dup) {
    throw new Error('Um lançamento idêntico foi registrado há poucos segundos — duplicidade bloqueada. Se for intencional, aguarde ' + seconds + 's e registre novamente.');
  }
}

/** Registra evento de auditoria (best-effort, não bloqueia). */
function audit_(quem, acao, detalhe) {
  try {
    appendRow_(SHEETS.AUDIT, {
      id: uid_(), quando: nowIso_(), quem: quem, acao: acao, detalhe: detalhe || ''
    });
  } catch (e) { /* auditoria nunca derruba a operação principal */ }
}

/**
 * Normaliza data (Date|string) para 'yyyy-MM-dd' SEM deslocar o
 * dia por fuso horário:
 *  - 'yyyy-MM-dd' puro (formulário): usado COMO ESTÁ. Nunca passa
 *    por new Date(), que interpretaria como meia-noite UTC (21h do
 *    dia anterior em São Paulo) e registraria o dia errado.
 *  - Date (célula do Sheets) ou ISO com hora (cache): formatado no
 *    fuso do projeto.
 */
function toDateKey_(v) {
  const pure = String(v).match(/^(\d{4}-\d{2}-\d{2})$/);
  if (pure) return pure[1];
  const d = (v instanceof Date) ? v : new Date(v);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Data no padrão brasileiro 'dd/MM/yyyy' (sem deslocamento). */
function toDateBR_(v) {
  const k = toDateKey_(v);
  return k.slice(8, 10) + '/' + k.slice(5, 7) + '/' + k.slice(0, 4);
}

/** Chave de mês 'yyyy-MM'. */
function toMonthKey_(v) {
  return toDateKey_(v).slice(0, 7);
}

/**
 * Sanitiza um mês vindo do CLIENTE: aceita apenas 'yyyy-MM';
 * vazio ou malformado cai no mês atual. Evita que um payload
 * manipulado gere períodos absurdos ou quebre daysInMonth_.
 */
function sanitizeMonthKey_(mk) {
  const s = String(mk || '');
  return /^\d{4}-\d{2}$/.test(s) ? s : toMonthKey_(new Date());
}

/**
 * Normaliza o campo `mes` de uma linha da planilha para 'yyyy-MM'.
 * O Sheets converte a string '2026-07' em DATA (1º/07/2026) ao
 * gravar — sem esta normalização a comparação String(mes) nunca
 * bate e as metas salvas "somem". Cobre: string 'yyyy-MM' pura,
 * Date da célula e ISO vindo do cache.
 */
function monthKeyOf_(v) {
  const s = String(v);
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  return toMonthKey_(v);
}

/** Percentual seguro (evita divisão por zero). */
function pct_(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

/** Valida CPF (apenas formato: 11 dígitos). */
function isValidCpf_(cpf) {
  return /^\d{11}$/.test(String(cpf).replace(/\D/g, ''));
}
