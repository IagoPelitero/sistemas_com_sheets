/**
 * ============================================================
 * PortoBank Performance — Ranking.gs
 * ------------------------------------------------------------
 * TOP 10 com ordenação automática.
 * Supervisor: ranking da própria equipe (com nomes).
 * ADMIN: ranking geral.
 * Atendente: ranking da equipe SEM nomes (anonimizado),
 * destacando a própria posição.
 * ============================================================
 */

/**
 * Monta o ranking TOP 10 do mês.
 * @param {Object} me
 * @param {string=} monthKey
 */
function rankingBuild_(me, monthKey) {
  const mk = monthKey || toMonthKey_(new Date());
  const showNames = isAdmin_(me) || isSupervisor_(me);
  const users = visibleUsers_(me).filter(function (u) { return u.status === 'Ativo'; });

  const sales = salesQuery_(me, isAdmin_(me) ? 'all' : 'team', mk);
  const rets = retentionQuery_(me, isAdmin_(me) ? 'all' : 'team', mk);

  const salesByUser = {}, retsByUser = {};
  sales.forEach(function (s) { salesByUser[s.userId] = (salesByUser[s.userId] || 0) + (parseInt(s.quantidade, 10) || 1); });
  rets.forEach(function (r) {
    if (!retsByUser[r.userId]) retsByUser[r.userId] = { atendidos: 0, retidos: 0 };
    retsByUser[r.userId].atendidos++;
    if (r.resultado === 'Retido' || r.resultado === 'Retido por Argumentação') retsByUser[r.userId].retidos++;
  });

  const rows = users
    .filter(function (u) { return ATTENDANT_ROLES.indexOf(u.cargo) !== -1 || isAdmin_(me); })
    .map(function (u) {
      const r = retsByUser[u.id] || { atendidos: 0, retidos: 0 };
      const vendas = salesByUser[u.id] || 0;
      const pctRet = pct_(r.retidos, r.atendidos);
      return {
        userId: u.id,
        nome: showNames ? u.nome : null,
        equipe: u.equipe,
        vendas: vendas,
        pctRetencao: pctRet,
        score: vendas + pctRet // pontuação combinada para ordenação
      };
    })
    .sort(function (a, b) { return b.score - a.score; }); // ordenação automática

  const myPos = rows.findIndex(function (r) { return String(r.userId) === String(me.id); }) + 1;

  return {
    mes: mk,
    minhaPosicao: myPos > 0 ? myPos : null,
    top10: rows.slice(0, 10).map(function (r, i) {
      return {
        posicao: i + 1,
        nome: showNames ? r.nome : (String(r.userId) === String(me.id) ? 'Você' : 'Colega'),
        equipe: r.equipe,
        vendas: r.vendas,
        pctRetencao: r.pctRetencao,
        propria: String(r.userId) === String(me.id)
      };
    })
  };
}
