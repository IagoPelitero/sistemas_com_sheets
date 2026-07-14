/**
 * ============================================================
 * Prisma Performance — Ranking.gs
 * ------------------------------------------------------------
 * TOP 10 com ordenação automática.
 * Supervisor: ranking da própria equipe (com nomes).
 * ADMIN: ranking geral.
 * Atendente: ranking da equipe SEM nomes (anonimizado),
 * destacando a própria posição.
 * ============================================================
 */

/**
 * Monta o ranking TOP 10 do mês (ou dos últimos 7 dias).
 * O período muda apenas o RECORTE dos dados — a pontuação
 * (vendas + %s de retenção) é exatamente a mesma.
 * @param {Object} me
 * @param {string=} monthKey
 * @param {string=} periodo 'mes' (padrão) | 'semana'
 */
function rankingBuild_(me, monthKey, periodo) {
  const mk = sanitizeMonthKey_(monthKey);
  const weekly = periodo === 'semana';
  const showNames = isAdmin_(me) || isSupervisor_(me);
  const users = visibleUsers_(me).filter(function (u) { return u.status === 'Ativo'; });
  const scope = isAdmin_(me) ? 'all' : 'team';

  let sales, rets;
  if (weekly) {
    // Últimos 7 dias (hoje incluso) — pode atravessar a virada do
    // mês, então busca os meses envolvidos e filtra pela data.
    const cutoff = weekCutoffKey_();
    const months = cutoff.slice(0, 7) === toMonthKey_(new Date())
      ? [toMonthKey_(new Date())]
      : [cutoff.slice(0, 7), toMonthKey_(new Date())];
    sales = []; rets = [];
    months.forEach(function (m) {
      sales = sales.concat(salesQuery_(me, scope, m));
      rets = rets.concat(retentionQuery_(me, scope, m));
    });
    sales = sales.filter(function (s) { return toDateKey_(s.data) >= cutoff; });
    rets = rets.filter(function (r) { return toDateKey_(r.data) >= cutoff; });
  } else {
    sales = salesQuery_(me, scope, mk);
    rets = retentionQuery_(me, scope, mk);
  }

  const salesByUser = {}, retsByUser = {};
  sales.forEach(function (s) { salesByUser[s.userId] = (salesByUser[s.userId] || 0) + (parseInt(s.quantidade, 10) || 1); });
  // Retenção POR PRODUTO (Cartão e Conta nunca se misturam)
  rets.forEach(function (r) {
    if (r.produto !== 'Cartão de Crédito' && r.produto !== 'Conta Digital') return;
    if (!retsByUser[r.userId]) retsByUser[r.userId] = { cartao: { a: 0, r: 0 }, conta: { a: 0, r: 0 } };
    const slot = r.produto === 'Cartão de Crédito' ? retsByUser[r.userId].cartao : retsByUser[r.userId].conta;
    slot.a++;
    if (r.resultado === 'Retido' || r.resultado === 'Retido por Incentivo' || r.resultado === 'Retido por Argumentação') slot.r++;
  });

  const rows = users
    // SOMENTE atendentes participam do ranking — ADMIN e todos os
    // perfis de supervisor ficam de fora, para qualquer visualizador.
    .filter(function (u) { return ATTENDANT_ROLES.indexOf(u.cargo) !== -1; })
    .map(function (u) {
      const r = retsByUser[u.id] || { cartao: { a: 0, r: 0 }, conta: { a: 0, r: 0 } };
      const vendas = salesByUser[u.id] || 0;
      const pctCartao = pct_(r.cartao.r, r.cartao.a);
      const pctConta = pct_(r.conta.r, r.conta.a);
      return {
        userId: u.id,
        nome: showNames ? u.nome : null,
        equipe: u.equipe,
        vendas: vendas,
        pctCartao: pctCartao,
        pctConta: pctConta,
        score: vendas + pctCartao + pctConta // pontuação para ordenação
      };
    })
    .sort(function (a, b) { return b.score - a.score; }); // ordenação automática

  const myPos = rows.findIndex(function (r) { return String(r.userId) === String(me.id); }) + 1;

  return {
    mes: mk,
    periodo: weekly ? 'semana' : 'mes',
    minhaPosicao: myPos > 0 ? myPos : null,
    top10: rows.slice(0, 10).map(function (r, i) {
      return {
        posicao: i + 1,
        nome: showNames ? r.nome : (String(r.userId) === String(me.id) ? 'Você' : 'Colega'),
        equipe: r.equipe,
        vendas: r.vendas,
        pctCartao: r.pctCartao,
        pctConta: r.pctConta,
        propria: String(r.userId) === String(me.id)
      };
    })
  };
}

/** Primeiro dia (yyyy-MM-dd) da janela dos últimos 7 dias, no fuso do projeto. */
function weekCutoffKey_() {
  const d = new Date();
  d.setDate(d.getDate() - 6); // hoje + 6 dias anteriores
  return toDateKey_(d);
}
