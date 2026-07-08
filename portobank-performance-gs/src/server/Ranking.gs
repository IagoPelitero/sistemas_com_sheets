/**
 * ============================================================
 * PortoBank Performance — Ranking.js
 * ------------------------------------------------------------
 * Responsabilidade única: rankings (individual, equipe,
 * supervisor).
 *
 * REGRA DE OURO: o ranking mostra quantidade, percentual,
 * meta e posição — NUNCA comissão, salário, valor ou
 * premiação de outros agentes.
 * ============================================================
 */

var Ranking = (function () {

  function baseAtendentes_(competencia) {
    var periodo = Utils.periodoDaCompetencia(competencia);
    var noPeriodo = Utils.filtroPeriodo(periodo.inicio, periodo.fim, 'data');
    var concl = function (r) { return r.status === CONFIG.STATUS.CONCLUIDA; };

    var vendas = Db.readAll(CONFIG.SHEETS.VENDAS).filter(function (r) { return noPeriodo(r) && concl(r); });
    var rets   = Db.readAll(CONFIG.SHEETS.RETENCOES).filter(noPeriodo);

    var mapa = {};
    function slot(email) {
      if (!mapa[email]) mapa[email] = { email: email, vendas: 0, retidas: 0, tratativas: 0 };
      return mapa[email];
    }
    vendas.forEach(function (v) { slot(v.atendenteEmail).vendas++; });
    rets.forEach(function (r) {
      var s = slot(r.atendenteEmail);
      s.tratativas++;
      if (r.status === CONFIG.STATUS.CONCLUIDA) s.retidas++;
    });

    var usuarios = Db.indexBy(CONFIG.SHEETS.USUARIOS, 'email');
    return Object.keys(mapa).map(function (email) {
      var s = mapa[email], u = usuarios[email] || {};
      var metas = Goals.metasDoUsuario(email, competencia);
      var metaQtd = metas.reduce(function (acc, m) { return acc + Number(m.metaQuantidade || 0); }, 0);
      return {
        email: email,
        nome: u.nome || email,
        equipeId: u.equipeId || '',
        supervisorEmail: u.supervisorEmail || '',
        quantidade: s.vendas + s.retidas,
        vendas: s.vendas,
        retidas: s.retidas,
        percentualRetencao: s.tratativas ? Utils.round2((s.retidas / s.tratativas) * 100) : 0,
        meta: metaQtd,
        percentualMeta: metaQtd ? Utils.round2(((s.vendas + s.retidas) / metaQtd) * 100) : 0
      };
    });
  }

  function posicionar_(lista, chaveOrdem) {
    lista.sort(function (a, b) { return b[chaveOrdem] - a[chaveOrdem]; });
    lista.forEach(function (item, i) { item.posicao = i + 1; });
    return lista;
  }

  /** Ranking individual — visível a todos, SEM valores financeiros */
  function individual(competencia) {
    var u = Auth.exigir();
    competencia = competencia || Utils.competenciaAtual();
    var lista = posicionar_(baseAtendentes_(competencia), 'quantidade');

    // Sanitização: garante que nenhum campo financeiro escape
    return lista.map(function (r) {
      return {
        posicao: r.posicao, nome: r.nome,
        eu: r.email === u.email,                       // destaca o próprio usuário
        quantidade: r.quantidade,
        percentualRetencao: r.percentualRetencao,
        meta: r.meta, percentualMeta: r.percentualMeta
      };
    });
  }

  /** Ranking por equipe */
  function equipes(competencia) {
    Auth.exigir();
    competencia = competencia || Utils.competenciaAtual();
    var base = baseAtendentes_(competencia);
    var equipes = Db.indexBy(CONFIG.SHEETS.EQUIPES, 'id');

    var mapa = {};
    base.forEach(function (r) {
      var k = r.equipeId || 'SEM_EQUIPE';
      if (!mapa[k]) mapa[k] = { equipeId: k, nome: (equipes[k] || {}).nome || 'Sem equipe',
                                quantidade: 0, retidas: 0, tratativas: 0, meta: 0 };
      mapa[k].quantidade += r.quantidade;
      mapa[k].retidas += r.retidas;
      mapa[k].tratativas += r.retidas ? Math.round(r.retidas / (r.percentualRetencao / 100 || 1)) : 0;
      mapa[k].meta += r.meta;
    });

    var lista = Object.keys(mapa).map(function (k) {
      var e = mapa[k];
      e.percentualRetencao = e.tratativas ? Utils.round2((e.retidas / e.tratativas) * 100) : 0;
      e.percentualMeta = e.meta ? Utils.round2((e.quantidade / e.meta) * 100) : 0;
      return e;
    });
    return posicionar_(lista, 'quantidade');
  }

  /** Ranking de supervisores */
  function supervisores(competencia) {
    Auth.exigir();
    competencia = competencia || Utils.competenciaAtual();
    var base = baseAtendentes_(competencia);
    var usuarios = Db.indexBy(CONFIG.SHEETS.USUARIOS, 'email');

    var mapa = {};
    base.forEach(function (r) {
      var k = r.supervisorEmail || 'SEM_SUPERVISOR';
      if (!mapa[k]) mapa[k] = { supervisor: (usuarios[k] || {}).nome || k,
                                quantidade: 0, meta: 0 };
      mapa[k].quantidade += r.quantidade;
      mapa[k].meta += r.meta;
    });

    var lista = Object.keys(mapa).map(function (k) {
      var s = mapa[k];
      s.percentualMeta = s.meta ? Utils.round2((s.quantidade / s.meta) * 100) : 0;
      return s;
    });
    return posicionar_(lista, 'quantidade');
  }

  return { individual: individual, equipes: equipes, supervisores: supervisores };
})();
