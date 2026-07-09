/**
 * ============================================================
 * PortoBank Performance — Dashboard.gs
 * ------------------------------------------------------------
 * Monta os dados prontos para renderização dos dashboards.
 * Todo o cálculo pesado acontece no servidor, em UMA chamada,
 * a partir de dados cacheados — o cliente só desenha.
 * ============================================================
 */

/**
 * Dashboard completo do usuário logado (mês corrente).
 * A estrutura retornada varia conforme o perfil.
 */
function dashboardBuild_(me, monthKey) {
  const mk = monthKey || toMonthKey_(new Date());
  const scope = getPermissions_(me).scope === 'self' ? 'self' : 'team';
  const isAdminUser = isAdmin_(me);

  const sales = salesQuery_(me, isAdminUser ? 'all' : scope, mk);
  const rets = retentionQuery_(me, isAdminUser ? 'all' : scope, mk);

  // Para atendentes, os cards refletem os PRÓPRIOS números
  const mySales = salesQuery_(me, 'self', mk);
  const myRets = retentionQuery_(me, 'self', mk);
  const baseSales = scope === 'self' ? mySales : sales;
  const baseRets = scope === 'self' ? myRets : rets;

  const stats = retentionStats_(baseRets);
  const commission = commissionForUser_(me, mk);
  const goal = goalForUser_(me, mk);

  const totalVendas = sumQty_(baseSales);
  const progresso = pct_(commission.total, goal.metaComissao);
  const progressoVendas = pct_(totalVendas, goal.metaVendas);

  return {
    mes: mk,
    cards: {
      vendas: totalVendas,
      comissao: commission.total,
      metaVendas: goal.metaVendas,
      metaComissao: goal.metaComissao,
      progressoVendas: progressoVendas,
      progressoComissao: progresso,
      restanteVendas: Math.max(0, goal.metaVendas - totalVendas),
      restanteComissao: round2_(Math.max(0, goal.metaComissao - commission.total))
    },
    retencao: stats,
    comissao: commission,
    graficoDiario: dailySeries_(baseSales, baseRets, mk),
    vendasPorProduto: salesByProduct_(baseSales),
    vendasIndividuais: baseSales
      .sort(function (a, b) { return String(b.data).localeCompare(String(a.data)); })
      .slice(0, 50)
      .map(function (s) { return { data: s.data, cpf: maskCpf_(s.cpf), produto: s.produto, quantidade: s.quantidade, obs: s.obs }; }),
    massificadosRetidos: baseRets
      .filter(function (r) {
        return String(r.produto).indexOf(MASSIFICADO_PREFIX) === 0 &&
          (r.resultado === 'Retido por Argumentação' || r.resultado === 'Retido por Incentivo');
      })
      .map(function (r) {
        return {
          data: r.data, cpf: maskCpf_(r.cpf),
          produto: String(r.produto).replace(MASSIFICADO_PREFIX + ' - ', ''),
          resultado: r.resultado === 'Retido por Argumentação' ? 'Argumentação' : 'Incentivo',
          obs: r.obs
        };
      }),
    tabelaDiaria: dailyRetentionTable_(baseRets, mk)
  };
}

/**
 * Aba EQUIPE — dados ANONIMIZADOS (sem nomes).
 */
function teamBuild_(me, monthKey) {
  const mk = monthKey || toMonthKey_(new Date());
  const teamSales = salesQuery_(me, isAdmin_(me) ? 'all' : 'team', mk);
  const teamRets = retentionQuery_(me, isAdmin_(me) ? 'all' : 'team', mk);
  const members = visibleUsers_(me);

  // Vendas por membro — SEM nomes (rótulos anônimos)
  const byMemberSales = {};
  teamSales.forEach(function (s) {
    byMemberSales[s.userId] = (byMemberSales[s.userId] || 0) + (parseInt(s.quantidade, 10) || 1);
  });
  const salesAnon = Object.keys(byMemberSales)
    .map(function (id, i) { return { rotulo: 'Colega ' + (i + 1), quantidade: byMemberSales[id], propria: String(id) === String(me.id) }; })
    .sort(function (a, b) { return b.quantidade - a.quantidade; });

  // Atendidos/retenção por membro — SEM nomes
  const byMemberRet = {};
  teamRets.forEach(function (r) {
    if (!byMemberRet[r.userId]) byMemberRet[r.userId] = { atendidos: 0, retidos: 0 };
    byMemberRet[r.userId].atendidos++;
    if (r.resultado === 'Retido' || r.resultado === 'Retido por Argumentação') byMemberRet[r.userId].retidos++;
  });
  const retAnon = Object.keys(byMemberRet)
    .map(function (id, i) {
      const m = byMemberRet[id];
      return { rotulo: 'Colega ' + (i + 1), quantidade: m.atendidos, pctRetencao: pct_(m.retidos, m.atendidos), propria: String(id) === String(me.id) };
    })
    .sort(function (a, b) { return b.pctRetencao - a.pctRetencao; });

  return {
    mes: mk,
    totalEquipe: sumQty_(teamSales),
    totalMembros: members.length,
    vendasPorProduto: salesByProduct_(teamSales),
    vendasAnonimas: salesAnon,
    retencaoAnonima: retAnon,
    pizza: retentionStats_(teamRets)
  };
}

// ---------------- Helpers ----------------

function sumQty_(sales) {
  return sales.reduce(function (acc, s) { return acc + (parseInt(s.quantidade, 10) || 1); }, 0);
}

function salesByProduct_(sales) {
  const map = {};
  sales.forEach(function (s) { map[s.produto] = (map[s.produto] || 0) + (parseInt(s.quantidade, 10) || 1); });
  return Object.keys(map)
    .map(function (p) { return { produto: p, quantidade: map[p] }; })
    .sort(function (a, b) { return b.quantidade - a.quantidade; });
}

/** Série diária de vendas e retenções do mês (para gráfico de evolução). */
function dailySeries_(sales, rets, monthKey) {
  const days = daysInMonth_(monthKey);
  const vend = {}, rete = {};
  sales.forEach(function (s) { const d = toDateKey_(s.data); vend[d] = (vend[d] || 0) + (parseInt(s.quantidade, 10) || 1); });
  rets.forEach(function (r) {
    const d = toDateKey_(r.data);
    if (r.resultado === 'Retido' || r.resultado === 'Retido por Argumentação') rete[d] = (rete[d] || 0) + 1;
  });
  return days.map(function (d) {
    return { dia: d.slice(8), vendas: vend[d] || 0, retencoes: rete[d] || 0 };
  });
}

/** Tabela diária: quantidade e % de retenção por dia. */
function dailyRetentionTable_(rets, monthKey) {
  const byDay = {};
  rets.forEach(function (r) {
    const d = toDateKey_(r.data);
    if (!byDay[d]) byDay[d] = { atendidos: 0, retidos: 0 };
    byDay[d].atendidos++;
    if (r.resultado === 'Retido' || r.resultado === 'Retido por Argumentação') byDay[d].retidos++;
  });
  return Object.keys(byDay).sort().map(function (d) {
    return { dia: d, quantidade: byDay[d].atendidos, pctRetencao: pct_(byDay[d].retidos, byDay[d].atendidos) };
  });
}

function daysInMonth_(monthKey) {
  const parts = monthKey.split('-');
  const y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
  const total = new Date(y, m, 0).getDate();
  const out = [];
  for (let d = 1; d <= total; d++) out.push(monthKey + '-' + String(d).padStart(2, '0'));
  return out;
}

/** Mascara CPF para exibição (LGPD-friendly). */
function maskCpf_(cpf) {
  const c = String(cpf).replace(/\D/g, '');
  return c.length === 11 ? c.slice(0, 3) + '.***.***-' + c.slice(9) : '***';
}
