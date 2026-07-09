/**
 * ============================================================
 * PortoBank Performance — Retention.gs
 * ------------------------------------------------------------
 * Registro e consulta de retenções.
 * Produtos e resultados válidos (ver RETENTION_PRODUCTS):
 *   Cartão de Crédito → Retido | Cancelado | Retido por Argumentação
 *   Conta Digital     → Retido | Cancelado
 *   Cashback          → Cashback | Milhas
 *   Massificado       → Retido | Cancelado
 * ============================================================
 */

/**
 * Registra uma nova retenção.
 * @param {Object} me
 * @param {Object} data {data, cpf, produto, resultado, obs}
 */
function retentionCreate_(me, data) {
  if (!data.data) throw new Error('Data é obrigatória.');
  if (!isValidCpf_(data.cpf)) throw new Error('CPF inválido (11 dígitos).');

  const results = RETENTION_PRODUCTS[data.produto];
  if (!results) throw new Error('Produto de retenção inválido.');
  if (results.indexOf(data.resultado) === -1) {
    throw new Error('Resultado "' + data.resultado + '" não é válido para ' + data.produto + '.');
  }

  const ret = {
    id: uid_(),
    data: toDateKey_(data.data),
    cpf: String(data.cpf).replace(/\D/g, ''),
    produto: data.produto,
    resultado: data.resultado,
    obs: String(data.obs || '').trim(),
    userId: me.id,
    equipe: me.equipe,
    criadoEm: nowIso_()
  };
  appendRow_(SHEETS.RETENTION, ret);
  audit_(me.email, 'RETENTION_CREATE', ret.produto + ' → ' + ret.resultado);
  return ret;
}

/**
 * Retenções do mês por escopo.
 * @param {Object} me
 * @param {string} scope 'self' | 'team' | 'all'
 * @param {string=} monthKey
 */
function retentionQuery_(me, scope, monthKey) {
  const mk = monthKey || toMonthKey_(new Date());
  return readAll_(SHEETS.RETENTION).filter(function (r) {
    if (toMonthKey_(r.data) !== mk) return false;
    if (scope === 'self') return String(r.userId) === String(me.id);
    if (scope === 'team') return String(r.equipe) === String(me.equipe);
    return true;
  });
}

/**
 * Estatísticas de retenção por produto para um conjunto de linhas.
 * @param {Object[]} rows
 * @return {Object} métricas por produto
 */
function retentionStats_(rows) {
  const byProduct = {};
  Object.keys(RETENTION_PRODUCTS).forEach(function (p) {
    byProduct[p] = { atendidos: 0, retidos: 0, argumentados: 0, cancelados: 0, cashback: 0, milhas: 0 };
  });
  rows.forEach(function (r) {
    const s = byProduct[r.produto];
    if (!s) return;
    s.atendidos++;
    if (r.resultado === 'Retido') s.retidos++;
    if (r.resultado === 'Retido por Argumentação') { s.retidos++; s.argumentados++; }
    if (r.resultado === 'Cancelado') s.cancelados++;
    if (r.resultado === 'Cashback') s.cashback++;
    if (r.resultado === 'Milhas') s.milhas++;
  });

  const cc = byProduct['Cartão de Crédito'];
  const cd = byProduct['Conta Digital'];
  const cb = byProduct['Cashback'];
  const ms = byProduct['Massificado'];

  return {
    cartao: {
      atendidos: cc.atendidos, retidos: cc.retidos, argumentados: cc.argumentados, cancelados: cc.cancelados,
      pctRetidos: pct_(cc.retidos, cc.atendidos),
      pctArgumentacao: pct_(cc.argumentados, cc.atendidos),
      pctCancelados: pct_(cc.cancelados, cc.atendidos)
    },
    conta: {
      atendidos: cd.atendidos, retidos: cd.retidos, cancelados: cd.cancelados,
      pctRetidos: pct_(cd.retidos, cd.atendidos),
      pctCancelados: pct_(cd.cancelados, cd.atendidos)
    },
    cashback: {
      atendidos: cb.atendidos, cashback: cb.cashback, milhas: cb.milhas,
      pctCashback: pct_(cb.cashback, cb.atendidos),
      pctMilhas: pct_(cb.milhas, cb.atendidos)
    },
    massificado: {
      atendidos: ms.atendidos, retidos: ms.retidos, cancelados: ms.cancelados,
      pctRetidos: pct_(ms.retidos, ms.atendidos)
    }
  };
}
