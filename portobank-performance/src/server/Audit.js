/**
 * ============================================================
 * PortoBank Performance — Audit.js
 * ------------------------------------------------------------
 * Responsabilidade única: trilha de auditoria.
 *
 * Toda alteração de dado passa por Audit.registrarAlteracao(),
 * gravando: usuário, data, hora, campo alterado, valor anterior,
 * novo valor e IP (quando disponível — o Apps Script não expõe
 * IP do cliente; o campo fica preparado para preenchimento via
 * front quando possível).
 * ============================================================
 */

var Audit = (function () {

  function agora_() {
    var d = new Date();
    return {
      data: Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      hora: Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm:ss')
    };
  }

  /** Compara antes/depois e grava uma linha de auditoria por campo alterado */
  function registrarAlteracao(usuario, tabela, registroId, antes, depois, ip) {
    var t = agora_();
    var linhas = [];
    var campos = Object.keys(depois || antes || {});

    campos.forEach(function (campo) {
      if (campo === '_row') return;
      var vAntes  = antes  ? antes[campo]  : '';
      var vDepois = depois ? depois[campo] : '';
      if (String(vAntes) !== String(vDepois)) {
        linhas.push({
          id: Db.nextId(CONFIG.SHEETS.AUDITORIA),
          usuario: usuario, data: t.data, hora: t.hora,
          tabela: tabela, registroId: registroId,
          campoAlterado: campo,
          valorAnterior: String(vAntes),
          novoValor: String(vDepois),
          ip: ip || ''
        });
      }
    });

    if (linhas.length) Db.insertMany(CONFIG.SHEETS.AUDITORIA, linhas);
  }

  /** Log simples de ação (login, exportação, cálculo, etc.) */
  function log(usuario, acao, detalhe) {
    var t = agora_();
    Db.insert(CONFIG.SHEETS.LOGS, {
      id: Db.nextId(CONFIG.SHEETS.LOGS),
      usuario: usuario, data: t.data, hora: t.hora,
      acao: acao, detalhe: detalhe || ''
    });
  }

  return { registrarAlteracao: registrarAlteracao, log: log };
})();
