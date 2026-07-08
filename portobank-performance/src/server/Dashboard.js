/**
 * ============================================================
 * PortoBank Performance — Dashboard.js
 * ------------------------------------------------------------
 * Responsabilidade única: montar, em UMA chamada, tudo que o
 * dashboard exibe (cartões Hoje/Mês/Ano, semáforo de meta,
 * comissão acumulada, projeção e séries para os gráficos).
 * Uma chamada única = menos round-trips = tela rápida.
 * ============================================================
 */

var Dashboard = (function () {

  function contar_(rows, inicio, fim) {
    var f = Utils.filtroPeriodo(inicio, fim, 'data');
    return rows.filter(f);
  }

  /** Payload completo do dashboard para o usuário logado */
  function carregar() {
    var u = Auth.exigir();
    var escopo = Auth.filtroEscopo(u);

    var vendas = Db.readAll(CONFIG.SHEETS.VENDAS).filter(function (r) {
      return escopo(r) && r.status === CONFIG.STATUS.CONCLUIDA;
    });
    var rets = Db.readAll(CONFIG.SHEETS.RETENCOES).filter(escopo);
    var retidas = rets.filter(function (r) { return r.status === CONFIG.STATUS.CONCLUIDA; });

    var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    var iniMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    var iniAno = new Date(hoje.getFullYear(), 0, 1);
    var agora = new Date();

    function bloco(ini) {
      var v = contar_(vendas, ini, agora).length;
      var rOk = contar_(retidas, ini, agora).length;
      var rAll = contar_(rets, ini, agora).length;
      return {
        vendas: v,
        retencoes: rOk,
        percentualRetencao: rAll ? Utils.round2((rOk / rAll) * 100) : 0
      };
    }

    // Comissão do usuário (SELF) — supervisores/admin veem os próprios zeros
    var comissao = null, progresso = null;
    try {
      comissao = Commission.minhaComissao();
      progresso = Goals.progresso();
    } catch (e) { /* perfis sem comissão própria seguem sem o bloco */ }

    // Séries dos gráficos --------------------------------------------------
    // Linha: vendas+retenções por dia do mês
    var diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    var linha = [];
    for (var d = 1; d <= diasNoMes; d++) {
      var di = new Date(hoje.getFullYear(), hoje.getMonth(), d);
      var df = new Date(hoje.getFullYear(), hoje.getMonth(), d, 23, 59, 59);
      linha.push([d, contar_(vendas, di, df).length, contar_(retidas, di, df).length]);
    }

    // Pizza: produtos vendidos no mês
    var pizza = {};
    contar_(vendas, iniMes, agora).forEach(function (v) {
      pizza[v.produto] = (pizza[v.produto] || 0) + 1;
    });

    // Colunas: produtos retidos no mês
    var colunas = {};
    contar_(retidas, iniMes, agora).forEach(function (r) {
      colunas[r.produto] = (colunas[r.produto] || 0) + 1;
    });

    // Heatmap: dia da semana × hora de criação (mês)
    var heat = [];
    contar_(vendas.concat(retidas), iniMes, agora).forEach(function (r) {
      var dt = r.criadoEm instanceof Date ? r.criadoEm : new Date(r.criadoEm);
      if (!isNaN(dt)) heat.push([dt.getDay(), dt.getHours()]);
    });

    return {
      usuario: { nome: u.nome, perfil: u.perfil, email: u.email },
      cartoes: {
        hoje: bloco(hoje),
        mes: bloco(iniMes),
        ano: bloco(iniAno)
      },
      comissao: comissao ? {
        acumulada: comissao.total,
        projecao: comissao.projecao,
        detalhe: comissao.comissao,
        bonificacoes: comissao.bonificacoes
      } : null,
      progresso: progresso,     // metas, semáforo verde/amarelo/vermelho, próxima faixa
      graficos: { linha: linha, pizza: pizza, colunas: colunas, heatmap: heat }
    };
  }

  return { carregar: carregar };
})();
