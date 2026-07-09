/**
 * ============================================================
 * PortoBank Performance — Goals.gs
 * ------------------------------------------------------------
 * Metas por usuário ou por equipe, por mês.
 * tipo: 'user' | 'team' — alvoId: userId ou nome da equipe.
 * ============================================================
 */

/**
 * Meta efetiva de um usuário no mês (meta individual, senão
 * meta da equipe, senão padrão do sistema).
 */
function goalForUser_(user, monthKey) {
  const mk = monthKey || toMonthKey_(new Date());
  const goals = readAll_(SHEETS.GOALS);

  const own = goals.find(function (g) {
    return g.tipo === 'user' && String(g.alvoId) === String(user.id) && String(g.mes) === mk;
  });
  if (own) return normalizeGoal_(own);

  const team = goals.find(function (g) {
    return g.tipo === 'team' && String(g.alvoId) === String(user.equipe) && String(g.mes) === mk;
  });
  if (team) return normalizeGoal_(team);

  return {
    metaVendas: settingNum_('meta.padrao.vendas'),
    metaComissao: settingNum_('meta.padrao.comissao'),
    metaRetencao: settingNum_('meta.padrao.retencao')
  };
}

function normalizeGoal_(g) {
  return {
    metaVendas: parseFloat(g.metaVendas) || 0,
    metaComissao: parseFloat(g.metaComissao) || 0,
    metaRetencao: parseFloat(g.metaRetencao) || 0
  };
}

/**
 * Define/atualiza uma meta (ADMIN: qualquer; Supervisor: só a
 * própria equipe e membros dela).
 * @param {Object} me
 * @param {Object} data {tipo, alvoId, metaVendas, metaComissao, metaRetencao, mes}
 */
function goalsSet_(me, data) {
  const perms = getPermissions_(me);
  if (!perms.canEditGoals) throw new Error('Sem permissão para alterar metas.');

  const mk = data.mes || toMonthKey_(new Date());
  if (!isAdmin_(me)) {
    if (data.tipo === 'team' && String(data.alvoId) !== String(me.equipe)) {
      throw new Error('Você só pode alterar metas da sua equipe.');
    }
    if (data.tipo === 'user') {
      const target = readAll_(SHEETS.USERS).find(function (u) { return String(u.id) === String(data.alvoId); });
      if (!target || String(target.equipe) !== String(me.equipe)) {
        throw new Error('Você só pode alterar metas de membros da sua equipe.');
      }
    }
  }

  const goals = readAll_(SHEETS.GOALS);
  const existing = goals.find(function (g) {
    return g.tipo === data.tipo && String(g.alvoId) === String(data.alvoId) && String(g.mes) === mk;
  });

  const payload = {
    tipo: data.tipo,
    alvoId: data.alvoId,
    metaVendas: parseFloat(data.metaVendas) || 0,
    metaComissao: parseFloat(data.metaComissao) || 0,
    metaRetencao: parseFloat(data.metaRetencao) || 0,
    mes: mk,
    atualizadoEm: nowIso_()
  };

  if (existing) {
    updateRowById_(SHEETS.GOALS, existing.id, payload);
  } else {
    payload.id = uid_();
    appendRow_(SHEETS.GOALS, payload);
  }
  audit_(me.email, 'GOAL_SET', data.tipo + ':' + data.alvoId + ' (' + mk + ')');
  return true;
}
