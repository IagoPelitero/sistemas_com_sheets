/**
 * ============================================================
 * PortoBank Performance — Commission.gs
 * ------------------------------------------------------------
 * Cálculo automático de comissões.
 *
 * FONTES DAS REGRAS
 * ─ Cartão de Crédito (FONE): especificação do sistema
 *     73% → R$150 | 74% → R$180 | 75% → R$200
 *     Bônus argumentação: 35–37% → +100 | 38–39% → +150 | ≥40% → +200
 *     Bônus premium: 76%/42% → 100 | 78%/44% → 200 (prevalece o maior)
 * ─ Demais regras: PDF "Programa de Remuneração Variável"
 *   (vigência 01/01/2026):
 *     6.3.1 Vendas coletivas por faixa de atingimento
 *           (até 60 | 60–79,99 | 80–100 | >100) — sem teto
 *     6.3.2 Cartão digital: Argumentação R$1,50 e Incentivo R$0,50
 *           por retido (pontos 1,5/0,5 × R$1,00) + Cashback por
 *           faixa (36%→50 | 39%→70 | 42%→100 | 45%→130)
 *     6.4   Teto do bloco de retenção: R$530
 *     6.5   Retenção de massificados por faixa de conversão,
 *           separada em Argumentação e Incentivo, por produto
 *     6.6   Conta Digital: 30%→100 | 50%→150 | 75%→200
 *           Bônus: 76%→+100 | 78%→+150
 *     Indicadores: CPCP R$30 | Upgrade Platinum R$2 |
 *           Upgrade Black/Infinite R$4 (valor unitário do produto)
 *
 * Todas as regras vêm da aba Settings → alteráveis sem código.
 * ============================================================
 */

/** Lê um valor de configuração (com fallback no seed). */
function settingGet_(key) {
  const rows = readAll_(SHEETS.SETTINGS);
  const found = rows.find(function (r) { return String(r.chave) === key; });
  const raw = found ? found.valor : DEFAULT_SETTINGS[key];
  return raw;
}

/** Lê configuração JSON. */
function settingJson_(key) {
  try { return JSON.parse(settingGet_(key)); } catch (e) { return JSON.parse(DEFAULT_SETTINGS[key]); }
}

/** Lê configuração numérica. */
function settingNum_(key) {
  const n = parseFloat(settingGet_(key));
  return isNaN(n) ? 0 : n;
}

/** Arredonda em 2 casas. */
function round2_(v) { return Math.round(v * 100) / 100; }

/**
 * Índice da faixa de atingimento das vendas coletivas (PDF 6.3.1).
 * até 60 → 0 | 60–79,99 → 1 | 80–100 → 2 | acima de 100 → 3
 */
function vendasFaixaIdx_(atingimento) {
  if (atingimento < 60) return 0;
  if (atingimento < 80) return 1;
  if (atingimento <= 100) return 2;
  return 3;
}

/**
 * Comissão de VENDAS (PDF 6.3.1 + indicadores).
 * A faixa é escolhida pelo atingimento INDIVIDUAL do usuário no
 * mês: vendas realizadas ÷ meta individual de vendas (definida
 * pelo ADMIN ou supervisor em Gestão da Equipe). Sem teto.
 * Produtos fora da tabela (CPCP, Upgrades, novos): valor unitário
 * cadastrado no produto.
 * @param {Object[]} sales
 * @param {number} atingimento % individual (vendas ÷ meta × 100)
 * @return {Object} {total, faixaIdx, atingimento, detalhes[]}
 */
function commissionVendas_(sales, atingimento) {
  const tabela = settingJson_('comissao.vendas.tabela');
  const idx = vendasFaixaIdx_(atingimento || 0);

  const products = readAll_(SHEETS.PRODUCTS);
  const unitario = {};
  products.forEach(function (p) { unitario[p.nome] = parseFloat(p.comissaoUnitaria) || 0; });

  let total = 0;
  const porProduto = {};
  sales.forEach(function (s) {
    const qtd = parseInt(s.quantidade, 10) || 1;
    const unit = tabela[s.produto] ? (parseFloat(tabela[s.produto][idx]) || 0)
      : (unitario[s.produto] !== undefined ? unitario[s.produto] : 0);
    total += unit * qtd;
    porProduto[s.produto] = round2_((porProduto[s.produto] || 0) + unit * qtd);
  });

  const detalhes = Object.keys(porProduto).map(function (p) { return p + ' → R$' + porProduto[p].toFixed(2); });
  return { total: round2_(total), faixaIdx: idx, atingimento: round2_(atingimento || 0), detalhes: detalhes };
}

/**
 * Comissão de Cartão de Crédito FONE (faixas + bônus).
 * @param {Object} cartao stats.cartao (ver retentionStats_)
 */
function commissionCartaoFone_(cartao) {
  const detalhes = [];
  let base = 0, bonusArg = 0, bonusPremium = 0;

  // Volume mínimo para prêmios por faixa (0 = desativado)
  const minCasos = settingNum_('comissao.faixas.minimoCasos');
  if (minCasos > 0 && cartao.atendidos < minCasos) {
    return { base: 0, bonusArg: 0, bonusPremium: 0, total: 0,
      detalhes: ['Volume mínimo não atingido (' + cartao.atendidos + '/' + minCasos + ' casos)'] };
  }

  // Faixas base: aplica a MAIOR faixa atingida
  settingJson_('comissao.cartaoFone.tiers').forEach(function (t) {
    if (cartao.pctRetidos >= t.pct) { base = t.valor; }
  });
  if (base > 0) detalhes.push('Base ' + cartao.pctRetidos + '% retidos → R$' + base);

  // Bônus por argumentação
  settingJson_('comissao.cartaoFone.bonusArg').forEach(function (b) {
    if (cartao.pctArgumentacao >= b.min && cartao.pctArgumentacao <= b.max && b.valor > bonusArg) {
      bonusArg = b.valor;
    }
  });
  // Regra "=40%": qualquer valor ≥ 40 mantém o bônus máximo da tabela
  const arg = settingJson_('comissao.cartaoFone.bonusArg');
  const topArg = arg[arg.length - 1];
  if (cartao.pctArgumentacao >= topArg.min) bonusArg = Math.max(bonusArg, topArg.valor);
  if (bonusArg > 0) detalhes.push('Bônus argumentação ' + cartao.pctArgumentacao + '% → +R$' + bonusArg);

  // Bônus premium (prevalece o maior atingido)
  settingJson_('comissao.cartaoFone.bonusPremium').forEach(function (p) {
    if (cartao.pctRetidos >= p.retidos && cartao.pctArgumentacao >= p.argumentacao && p.valor > bonusPremium) {
      bonusPremium = p.valor;
    }
  });
  if (bonusPremium > 0) detalhes.push('Bônus premium → +R$' + bonusPremium);

  return { base: base, bonusArg: bonusArg, bonusPremium: bonusPremium, total: base + bonusArg + bonusPremium, detalhes: detalhes };
}

/**
 * Pontos e valor do Cartão de Crédito DIGITAL (PDF 6.3.2).
 * Argumentação = 1,5 pt (R$1,50) | Incentivo = 0,5 pt (R$0,50).
 * Somente Cartão possui regra de pontos.
 * @param {Object[]} rows Retenções do usuário no mês.
 */
function commissionCartaoDigital_(rows) {
  const ptInc = settingNum_('comissao.cartaoDigital.pontoIncentivo');   // 0.5
  const ptArg = settingNum_('comissao.cartaoDigital.pontoArgumentacao'); // 1.5
  const valorPonto = settingNum_('comissao.cartaoDigital.valorPonto');   // R$1,00

  let pontos = 0;
  rows.forEach(function (r) {
    if (r.produto !== 'Cartão de Crédito') return;
    // 'Retido por Incentivo' (nomenclatura atual) ou 'Retido' (registros legados)
    if (r.resultado === 'Retido por Incentivo' || r.resultado === 'Retido') pontos += ptInc;
    if (r.resultado === 'Retido por Argumentação') pontos += ptArg;
  });
  return { pontos: pontos, valor: round2_(pontos * valorPonto) };
}

/**
 * Prêmio de CASHBACK (PDF 6.3.2) — valor fixo pela maior faixa
 * de conversão atingida: 36%→50 | 39%→70 | 42%→100 | 45%→130.
 * Conversão = retenções via Cashback ÷ total de casos Cashback/Milhas.
 * @param {Object} cb stats.cashback
 */
function commissionCashback_(cb) {
  let premio = 0;
  const minCasos = settingNum_('comissao.faixas.minimoCasos');
  if (minCasos > 0 && cb.atendidos < minCasos) return { premio: 0, pct: cb.pctCashback };
  settingJson_('comissao.cashback.faixas').forEach(function (f) {
    if (cb.pctCashback >= f.pct && f.valor > premio) premio = f.valor;
  });
  return { premio: premio, pct: cb.pctCashback };
}

/**
 * Prêmio de CONTA DIGITAL (PDF 6.6) — valor fixo pela maior faixa
 * de retenção atingida (30/50/75%) + bônus (76/78%).
 * @param {Object} conta stats.conta
 */
function commissionContaDigital_(conta) {
  let premio = 0, bonus = 0;
  const minCasos = settingNum_('comissao.faixas.minimoCasos');
  if (minCasos > 0 && conta.atendidos < minCasos) return { premio: 0, bonus: 0, total: 0, pct: conta.pctRetidos };
  settingJson_('comissao.contaDigital.faixas').forEach(function (f) {
    if (conta.pctRetidos >= f.pct && f.valor > premio) premio = f.valor;
  });
  settingJson_('comissao.contaDigital.bonus').forEach(function (b) {
    if (conta.pctRetidos >= b.pct && b.valor > bonus) bonus = b.valor;
  });
  return { premio: premio, bonus: bonus, total: premio + bonus, pct: conta.pctRetidos };
}

/**
 * Retenção de MASSIFICADOS (PDF 6.5).
 * Para cada produto massificado, paga-se R$/retido conforme a
 * faixa de conversão atingida no mês — tabelas separadas para
 * Argumentação (faixas 15/30/50/60%) e Incentivo (60/65/70/75%).
 * Conversão calculada por produto e por tipo:
 *   convArg = retidos por argumentação ÷ casos do produto
 *   convInc = retidos por incentivo    ÷ casos do produto
 * Abaixo da primeira faixa não há pagamento.
 * @param {Object[]} rows Retenções do usuário no mês.
 */
function commissionMassificados_(rows) {
  const faixasArg = settingJson_('comissao.massificados.faixasArg');
  const faixasInc = settingJson_('comissao.massificados.faixasInc');
  const tabArg = settingJson_('comissao.massificados.arg');
  const tabInc = settingJson_('comissao.massificados.inc');

  // Agrupa por produto massificado
  const grupos = {};
  rows.forEach(function (r) {
    if (String(r.produto).indexOf(MASSIFICADO_PREFIX) !== 0) return;
    const nome = String(r.produto).replace(MASSIFICADO_PREFIX + ' - ', '');
    if (!grupos[nome]) grupos[nome] = { total: 0, arg: 0, inc: 0 };
    grupos[nome].total++;
    if (r.resultado === 'Retido por Argumentação') grupos[nome].arg++;
    if (r.resultado === 'Retido por Incentivo') grupos[nome].inc++;
  });

  function faixaIdx_(conv, faixas) {
    let idx = -1;
    faixas.forEach(function (f, i) { if (conv >= f) idx = i; });
    return idx; // -1 = abaixo da primeira faixa → sem pagamento
  }

  let total = 0;
  const detalhes = [];
  Object.keys(grupos).forEach(function (nome) {
    const g = grupos[nome];
    const convArg = pct_(g.arg, g.total);
    const convInc = pct_(g.inc, g.total);
    const iArg = faixaIdx_(convArg, faixasArg);
    const iInc = faixaIdx_(convInc, faixasInc);
    const vArg = (iArg >= 0 && tabArg[nome]) ? (parseFloat(tabArg[nome][iArg]) || 0) * g.arg : 0;
    const vInc = (iInc >= 0 && tabInc[nome]) ? (parseFloat(tabInc[nome][iInc]) || 0) * g.inc : 0;
    total += vArg + vInc;
    if (vArg > 0) detalhes.push(nome + ' arg ' + convArg + '% × ' + g.arg + ' → R$' + round2_(vArg).toFixed(2));
    if (vInc > 0) detalhes.push(nome + ' inc ' + convInc + '% × ' + g.inc + ' → R$' + round2_(vInc).toFixed(2));
  });

  return { total: round2_(total), detalhes: detalhes };
}

/**
 * Comissão total de um usuário no mês (vendas + retenção).
 * Teto do PDF 6.4 (R$530) aplicado ao bloco 6.3.2:
 * pontos do cartão (argumentação + incentivo) + prêmio de cashback.
 * @param {Object} user
 * @param {string=} monthKey
 * @return {Object} composição completa da comissão
 */
function commissionForUser_(user, monthKey) {
  const mk = monthKey || toMonthKey_(new Date());
  const sales = salesQuery_(user, 'self', mk);
  const rets = retentionQuery_(user, 'self', mk);
  const stats = retentionStats_(rets);

  // Atingimento INDIVIDUAL: vendas do próprio usuário ÷ meta
  // individual (ADMIN/supervisor definem em Gestão da Equipe)
  const goal = goalForUser_(user, mk);
  const totalQtd = sales.reduce(function (a, x) { return a + (parseInt(x.quantidade, 10) || 1); }, 0);
  const atingimento = pct_(totalQtd, goal.metaVendas);

  const isDigital = user.cargo === ROLES.AT_RET_DIGITAL || user.cargo === ROLES.SUP_RET_DIGITAL;
  const digital = commissionCartaoDigital_(rets);
  const mass = commissionMassificados_(rets);
  const vendas = commissionVendas_(sales, atingimento);

  // Composição da comissão — TODOS os perfis somam TODAS as
  // modalidades: Cartão + Conta Digital + Cashback + Vendas +
  // Retenção de Massificados. O que muda por perfil é apenas a
  // regra do CARTÃO:
  //  - DIGITAL: pontos por retenção (arg 1,5 = R$1,50 · inc 0,5 =
  //    R$0,50), com teto de R$530 SÓ no cartão;
  //  - FONE: faixas 73/74/75% + bônus.
  // Conta Digital (PDF 6.6 "Fone/Digital") e Cashback (PDF 6.3.2)
  // pagam por faixa para ambos os perfis, sem teto.
  const cartao = isDigital
    ? { base: 0, bonusArg: 0, bonusPremium: 0, total: digital.valor,
        pontos: digital.pontos, detalhes: ['Pontuação digital: ' + digital.pontos + ' pts'] }
    : commissionCartaoFone_(stats.cartao);
  const conta = commissionContaDigital_(stats.conta);
  const cashback = commissionCashback_(stats.cashback);

  // Teto de R$530: aplica-se SOMENTE à retenção de CARTÃO DE
  // CRÉDITO do perfil DIGITAL (pontos de argumentação +
  // incentivo). Não alcança os demais produtos nem o fone.
  const teto = settingNum_('comissao.retencao.teto');
  const cartaoFinal = (isDigital && teto > 0)
    ? Math.min(cartao.total, teto)
    : cartao.total;

  const totalRetencao = round2_(cartaoFinal + cashback.premio + conta.total + mass.total);
  const total = round2_(vendas.total + totalRetencao);

  const tetoAplicado = isDigital && teto > 0 && cartao.total > teto;
  cartao.total = cartaoFinal;

  return {
    mes: mk,
    cartao: cartao,
    cashback: cashback,
    contaDigital: conta,
    massificados: mass,
    vendas: vendas,
    // compatibilidade com o painel:
    globais: {
      vendas: vendas.total,
      contaDigital: conta.total,
      retencaoMassificados: mass.total,
      conversaoMilhasCashback: cashback.premio
    },
    tetoRetencaoAplicado: tetoAplicado,
    totalVendas: vendas.total,
    totalRetencao: totalRetencao,
    total: total
  };
}
