/**
 * ============================================================
 * PortoBank Performance — Settings.js
 * ------------------------------------------------------------
 * Responsabilidade única: telas de CONFIGURAÇÕES.
 * CRUD genérico e auditado para as tabelas parametrizáveis:
 * Produtos, RegrasComissao, RegrasFone, RegrasRetencao,
 * Bonificacoes, Faixas, Campanhas, Configuracoes.
 *
 * É aqui que percentuais, faixas, bônus e metas são criados —
 * nunca no código.
 * ============================================================
 */

var Settings = (function () {

  /** Tabelas que o ADMIN pode editar pelas telas de Configurações */
  var EDITAVEIS = [
    CONFIG.SHEETS.PRODUTOS, CONFIG.SHEETS.REGRAS_COMISSAO, CONFIG.SHEETS.REGRAS_FONE,
    CONFIG.SHEETS.REGRAS_RETENCAO, CONFIG.SHEETS.BONIFICACOES, CONFIG.SHEETS.FAIXAS,
    CONFIG.SHEETS.CAMPANHAS, CONFIG.SHEETS.METAS, CONFIG.SHEETS.EQUIPES
  ];

  function exigirTabelaEditavel_(tabela) {
    if (EDITAVEIS.indexOf(tabela) === -1)
      throw new Error('Tabela não editável por Configurações: ' + tabela);
  }

  /** Lista registros de uma tabela de configuração */
  function listar(tabela, opts) {
    Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    exigirTabelaEditavel_(tabela);
    return Db.query(tabela, opts || {});
  }

  /** Cria/atualiza registro em tabela de configuração (auditado) */
  function salvar(tabela, payload) {
    var u = Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    exigirTabelaEditavel_(tabela);

    if (payload.id) {
      var res = Db.update(tabela, payload.id, payload);
      Audit.registrarAlteracao(u.email, tabela, payload.id, res.antes, res.depois);
      return res.depois;
    }
    payload.id = Db.nextId(tabela);
    if (payload.ativo === undefined) payload.ativo = true;
    Db.insert(tabela, payload);
    Audit.registrarAlteracao(u.email, tabela, payload.id, null, payload);
    return payload;
  }

  /** Remove (lógico quando possível) registro de configuração */
  function excluir(tabela, id) {
    var u = Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    exigirTabelaEditavel_(tabela);
    var res = Db.remove(tabela, id);
    Audit.registrarAlteracao(u.email, tabela, id, res.antes, res.depois);
    return true;
  }

  /** Lê um parâmetro simples da aba Configuracoes (chave/valor) */
  function get(chave, padrao) {
    var row = Db.indexBy(CONFIG.SHEETS.CONFIGURACOES, 'chave')[chave];
    return row ? row.valor : padrao;
  }

  /** Grava parâmetro chave/valor */
  function set(chave, valor, descricao) {
    var u = Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    var rows = Db.readAll(CONFIG.SHEETS.CONFIGURACOES, true);
    var sh = Db._ss().getSheetByName(CONFIG.SHEETS.CONFIGURACOES);
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].chave === chave) {
        sh.getRange(rows[i]._row, 2, 1, 4).setValues([[valor, descricao || rows[i].descricao, u.email, new Date()]]);
        Db.bust(CONFIG.SHEETS.CONFIGURACOES);
        return;
      }
    }
    Db.insert(CONFIG.SHEETS.CONFIGURACOES, {
      chave: chave, valor: valor, descricao: descricao || '',
      atualizadoPor: u.email, atualizadoEm: new Date()
    });
  }

  /** Cabeçalhos de uma tabela (para as telas genéricas de CRUD) */
  function schema(tabela) {
    Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    exigirTabelaEditavel_(tabela);
    return Setup.SCHEMA[tabela] || [];
  }

  return { listar: listar, salvar: salvar, excluir: excluir,
           get: get, set: set, schema: schema, EDITAVEIS: EDITAVEIS };
})();


/**
 * ============================================================
 * Reports — relatórios e exportação (Excel, PDF, CSV)
 * ------------------------------------------------------------
 * Mantido no mesmo arquivo por afinidade de camada, mas com
 * responsabilidade separada em módulo próprio.
 * ============================================================
 */
var Reports = (function () {

  /** Gera a matriz do relatório conforme filtros e escopo */
  function gerar_(opts) {
    var u = Auth.exigir();
    if (!u.permissoes.exportar) throw new Error('Seu perfil não exporta relatórios.');

    opts = opts || {};
    var tabela = (opts.origem === 'retencoes') ? CONFIG.SHEETS.RETENCOES : CONFIG.SHEETS.VENDAS;
    var escopo = Auth.filtroEscopo(u);
    var periodo = Utils.filtroPeriodo(opts.inicio, opts.fim, 'data');

    var rows = Db.readAll(tabela).filter(function (r) {
      if (!escopo(r) || !periodo(r)) return false;
      if (opts.supervisor && r.supervisorEmail !== opts.supervisor) return false;
      if (opts.atendente && r.atendenteEmail !== opts.atendente) return false;
      if (opts.produto && r.produto !== opts.produto) return false;
      if (opts.canal && r.canal !== opts.canal) return false;
      return true;
    });

    var headers = rows.length ? Object.keys(rows[0]).filter(function (k) { return k !== '_row'; })
                              : Setup.SCHEMA[tabela];
    var matriz = [headers].concat(rows.map(function (r) {
      return headers.map(function (h) { return r[h]; });
    }));
    return { matriz: matriz, nome: tabela + '_' + (opts.inicio || '') + '_' + (opts.fim || '') };
  }

  /** CSV — devolve conteúdo textual para download imediato no front */
  function exportarCsv(opts) {
    var g = gerar_(opts);
    var csv = g.matriz.map(function (linha) {
      return linha.map(function (c) {
        var s = String(c === undefined || c === null ? '' : c);
        return '"' + s.replace(/"/g, '""') + '"';
      }).join(';');
    }).join('\n');
    Audit.log(Auth.exigir().email, 'EXPORT_CSV', g.nome);
    return { nome: g.nome + '.csv', conteudo: csv };
  }

  /** Excel — cria arquivo no Drive e devolve URL */
  function exportarExcel(opts) {
    var g = gerar_(opts);
    var ss = SpreadsheetApp.create('Relatorio_' + g.nome);
    ss.getSheets()[0].getRange(1, 1, g.matriz.length, g.matriz[0].length).setValues(g.matriz);
    var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() +
              '/export?format=xlsx';
    Audit.log(Auth.exigir().email, 'EXPORT_EXCEL', g.nome);
    return { nome: g.nome + '.xlsx', url: url };
  }

  /** PDF — exporta a planilha temporária como PDF e devolve URL */
  function exportarPdf(opts) {
    var g = gerar_(opts);
    var ss = SpreadsheetApp.create('Relatorio_' + g.nome);
    ss.getSheets()[0].getRange(1, 1, g.matriz.length, g.matriz[0].length).setValues(g.matriz);
    var url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() +
              '/export?format=pdf&size=A4&portrait=false&gridlines=true';
    Audit.log(Auth.exigir().email, 'EXPORT_PDF', g.nome);
    return { nome: g.nome + '.pdf', url: url };
  }

  return { exportarCsv: exportarCsv, exportarExcel: exportarExcel, exportarPdf: exportarPdf };
})();
