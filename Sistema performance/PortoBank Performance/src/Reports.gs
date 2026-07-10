/**
 * ============================================================
 * PortoBank Performance — Reports.gs
 * ------------------------------------------------------------
 * Relatórios exportáveis (CSV) para Supervisor e ADMIN:
 * Performance, Vendas, Retenção, Comissão, Equipe, Ranking,
 * Metas. O CSV é gerado no servidor e baixado pelo cliente.
 * ============================================================
 */

const REPORT_TYPES = ['Performance', 'Vendas', 'Retenção', 'Comissão', 'Equipe', 'Ranking', 'Metas'];

/**
 * Gera um relatório e devolve o CSV pronto para download.
 * @param {Object} me
 * @param {string} tipo Um de REPORT_TYPES.
 * @param {string=} monthKey
 * @return {Object} {filename, csv}
 */
function reportGenerate_(me, tipo, monthKey) {
  if (!getPermissions_(me).canReports) throw new Error('Sem permissão para gerar relatórios.');
  if (REPORT_TYPES.indexOf(tipo) === -1) throw new Error('Tipo de relatório inválido.');

  const mk = monthKey || toMonthKey_(new Date());
  const scope = isAdmin_(me) ? 'all' : 'team';
  // Mapa id → nome montado UMA vez — nunca por linha do CSV
  const nomes = userNameMap_();
  let rows = [];

  switch (tipo) {
    case 'Vendas':
      rows = [['Data', 'CPF', 'Produto', 'Quantidade', 'Atendente', 'Equipe', 'OBS']];
      salesQuery_(me, scope, mk).forEach(function (s) {
        rows.push([s.data, maskCpf_(s.cpf), s.produto, s.quantidade, nomes[String(s.userId)] || '(removido)', s.equipe, s.obs]);
      });
      break;

    case 'Retenção':
      rows = [['Data', 'CPF', 'Produto', 'Resultado', 'Atendente', 'Equipe', 'OBS']];
      retentionQuery_(me, scope, mk).forEach(function (r) {
        rows.push([r.data, maskCpf_(r.cpf), r.produto, r.resultado, nomes[String(r.userId)] || '(removido)', r.equipe, r.obs]);
      });
      break;

    case 'Comissão':
      rows = [['Atendente', 'Equipe', 'Comissão Vendas', 'Comissão Retenção', 'Total']];
      teamMembers_(me).forEach(function (u) {
        const c = commissionForUser_(u, mk);
        rows.push([u.nome, u.equipe, c.totalVendas, c.totalRetencao, c.total]);
      });
      break;

    case 'Performance':
      rows = [['Atendente', 'Equipe', 'Vendas', '% Retenção Cartão', '% Retenção Conta', 'Comissão Total']];
      teamMembers_(me).forEach(function (u) {
        const st = retentionStats_(retentionQuery_(u, 'self', mk));
        const c = commissionForUser_(u, mk);
        rows.push([u.nome, u.equipe, sumQty_(salesQuery_(u, 'self', mk)), st.cartao.pctRetidos, st.conta.pctRetidos, c.total]);
      });
      break;

    case 'Equipe':
      rows = [['Nome', 'Email', 'Cargo', 'Equipe', 'Status']];
      visibleUsers_(me).forEach(function (u) { rows.push([u.nome, u.email, u.cargo, u.equipe, u.status]); });
      break;

    case 'Ranking':
      rows = [['Posição', 'Nome', 'Equipe', 'Vendas', '% Ret. Cartão', '% Ret. Conta']];
      rankingBuild_(me, mk).top10.forEach(function (r) {
        rows.push([r.posicao, r.nome, r.equipe, r.vendas, r.pctCartao, r.pctConta]);
      });
      break;

    case 'Metas':
      rows = [['Tipo', 'Alvo', 'Meta Vendas (qtd)', 'Meta Retenção Cartão (%)', 'Meta Retenção Conta (%)', 'Mês']];
      readAll_(SHEETS.GOALS)
        .filter(function (g) { return String(g.mes) === mk; })
        .filter(function (g) { return isAdmin_(me) || goalVisible_(me, g); })
        .forEach(function (g) {
          rows.push([g.tipo, goalTargetName_(g, nomes), g.metaVendas, normalizeGoal_(g).metaRetencaoCartao, normalizeGoal_(g).metaRetencaoConta, g.mes]);
        });
      break;
  }

  // Registra a solicitação
  appendRow_(SHEETS.REPORTS, {
    id: uid_(), tipo: tipo, solicitante: me.email,
    parametros: JSON.stringify({ mes: mk }), status: 'Gerado', criadoEm: nowIso_()
  });
  audit_(me.email, 'REPORT', tipo + ' (' + mk + ')');

  const csv = rows.map(function (r) {
    return r.map(function (c) { return '"' + String(c === undefined ? '' : c).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\r\n');

  return { filename: 'portobank_' + tipo.toLowerCase() + '_' + mk + '.csv', csv: '\ufeff' + csv };
}

// ---------------- Helpers ----------------

function teamMembers_(me) {
  return visibleUsers_(me).filter(function (u) {
    return u.status === 'Ativo' && ATTENDANT_ROLES.indexOf(u.cargo) !== -1;
  });
}

function goalVisible_(me, g) {
  if (g.tipo === 'team') return String(g.alvoId) === String(me.equipe);
  const target = readAll_(SHEETS.USERS).find(function (u) { return String(u.id) === String(g.alvoId); });
  return target && String(target.equipe) === String(me.equipe);
}

function goalTargetName_(g, nomes) {
  return g.tipo === 'team' ? g.alvoId : (nomes[String(g.alvoId)] || '(removido)');
}
