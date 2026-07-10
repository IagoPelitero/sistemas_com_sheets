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
    metaRetencaoCartao: settingNum_('meta.padrao.retencaoCartao'),
    metaRetencaoConta: settingNum_('meta.padrao.retencaoConta')
  };
}

function normalizeGoal_(g) {
  return {
    metaVendas: parseFloat(g.metaVendas) || 0,
    // compatibilidade: metas antigas com campo único caem no valor por produto
    metaRetencaoCartao: parseFloat(g.metaRetencaoCartao) || parseFloat(g.metaRetencao) || 0,
    metaRetencaoConta: parseFloat(g.metaRetencaoConta) || parseFloat(g.metaRetencao) || 0
  };
}

/**
 * Meta vigente para o MODAL de edição — devolve os valores que
 * estão valendo hoje para o alvo, evitando que o gestor salve os
 * padrões por engano ao abrir o formulário.
 * @param {Object} me
 * @param {Object} q {tipo?, alvoId?, id?, mes?}
 */
function goalsGetFor_(me, q) {
  q = q || {};
  const mk = q.mes || toMonthKey_(new Date());

  if (q.tipo === 'team') {
    const alvo = q.alvoId || me.equipe;
    if (!isAdmin_(me) && String(alvo) !== String(me.equipe)) {
      throw new Error('Você só pode consultar metas da sua equipe.');
    }
    const g = readAll_(SHEETS.GOALS).find(function (x) {
      return x.tipo === 'team' && String(x.alvoId) === String(alvo) && String(x.mes) === mk;
    });
    if (g) return normalizeGoal_(g);
    return {
      metaVendas: settingNum_('meta.padrao.vendas'),
      metaRetencaoCartao: settingNum_('meta.padrao.retencaoCartao'),
      metaRetencaoConta: settingNum_('meta.padrao.retencaoConta')
    };
  }

  if (q.id && String(q.id) !== String(me.id)) {
    const target = readAll_(SHEETS.USERS).find(function (u) { return String(u.id) === String(q.id); });
    if (!target) throw new Error('Usuário não encontrado.');
    assertCanManage_(me, target);
    return goalForUser_(target, mk);
  }

  return goalForUser_(me, mk);
}

/**
 * Define/atualiza uma meta (ADMIN: qualquer; Supervisor: só a
 * própria equipe e membros dela).
 * @param {Object} me
 * Metas: QUANTIDADE de vendas (sem valor em R$) e % de retenção
 * INDIVIDUAL POR PRODUTO (Cartão e Conta).
 * @param {Object} data {tipo, alvoId, metaVendas, metaRetencaoCartao, metaRetencaoConta, mes}
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
    metaVendas: parseInt(data.metaVendas, 10) || 0,
    metaRetencaoCartao: parseFloat(data.metaRetencaoCartao) || 0,
    metaRetencaoConta: parseFloat(data.metaRetencaoConta) || 0,
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
