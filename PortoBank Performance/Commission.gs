/**
 * ============================================================
 * PortoBank Performance — Commission.gs
 * ------------------------------------------------------------
 * Cálculo automático de comissões.
 *
 * CARTÃO DE CRÉDITO (FONE) — faixas de % retidos:
 *   73% → R$150 | 74% → R$180 | 75% → R$200
 * Bônus por Argumentação:
 *   35–37% → +R$100 | 38–39% → +R$150 | =40% → +R$200
 * Bônus Premium:
 *   76% retidos + 42% argumentação → R$100
 *   78% retidos + 44% argumentação → R$200 (prevalece o maior)
 *
 * CARTÃO DE CRÉDITO (DIGITAL) — pontos:
 *   retenção incentivo = 0,5 pt | argumentação = 1,5 pt
 *   (valor do ponto configurável em Configurações)
 *
 * COMISSÕES GLOBAIS (Conta Digital, Retenção Massificados,
 * Milhas→Cashback, Venda Massificados): valores padrão já
 * cadastrados e editáveis em Configurações — ajustar conforme
 * o PDF oficial da operação.
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

/**
 * Comissão de Cartão de Crédito FONE a partir das estatísticas.
 * @param {Object} cartao stats.cartao (ver retentionStats_)
 * @return {Object} {base, bonusArg, bonusPremium, total, detalhes[]}
 */
function commissionCartaoFone_(cartao) {
  const detalhes = [];
  let base = 0, bonusArg = 0, bonusPremium = 0;

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
 * Pontos e valor do Cartão de Crédito DIGITAL.
 * Somente Cartão possui regra de pontos.
 * @param {Object[]} rows Retenções do usuário no mês.
 */
function commissionCartaoDigital_(rows) {
  const ptInc = settingNum_('comissao.cartaoDigital.pontoIncentivo');   // 0.5
  const ptArg = settingNum_('comissao.cartaoDigital.pontoArgumentacao'); // 1.5
  const valorPonto = settingNum_('comissao.cartaoDigital.valorPonto');

  let pontos = 0;
  rows.forEach(function (r) {
    if (r.produto !== 'Cartão de Crédito') return;
    if (r.resultado === 'Retido') pontos += ptInc;
    if (r.resultado === 'Retido por Argumentação') pontos += ptArg;
  });
  return { pontos: pontos, valor: Math.round(pontos * valorPonto * 100) / 100 };
}

/**
 * Comissões globais (unitárias) sobre vendas e retenções.
 * @param {Object[]} sales
 * @param {Object[]} retentions
 */
function commissionGlobal_(sales, retentions) {
  const vContaDigital = settingNum_('comissao.global.contaDigital');
  const vRetMass = settingNum_('comissao.global.retencaoMassificados');
  const vMilhasCash = settingNum_('comissao.global.conversaoMilhasCashback');
  const vVendaMass = settingNum_('comissao.global.vendaMassificados');

  // Comissão de venda: usa valor unitário do produto se cadastrado,
  // senão o valor global de venda de massificados.
  const products = readAll_(SHEETS.PRODUCTS);
  const productValue = {};
  products.forEach(function (p) { productValue[p.nome] = parseFloat(p.comissaoUnitaria) || vVendaMass; });

  let vendas = 0;
  sales.forEach(function (s) {
    const unit = productValue[s.produto] !== undefined ? productValue[s.produto] : vVendaMass;
    vendas += unit * (parseInt(s.quantidade, 10) || 1);
  });

  let contaDigital = 0, retMass = 0, milhasCash = 0;
  retentions.forEach(function (r) {
    if (r.produto === 'Conta Digital' && r.resultado === 'Retido') contaDigital += vContaDigital;
    if (r.produto === 'Massificado' && r.resultado === 'Retido') retMass += vRetMass;
    if (r.produto === 'Cashback' && r.resultado === 'Cashback') milhasCash += vMilhasCash; // conversão Milhas → Cashback
  });

  return {
    vendas: round2_(vendas),
    contaDigital: round2_(contaDigital),
    retencaoMassificados: round2_(retMass),
    conversaoMilhasCashback: round2_(milhasCash)
  };
}

/**
 * Comissão total de um usuário no mês (vendas + retenção).
 * @param {Object} user
 * @param {string=} monthKey
 * @return {Object} composição completa da comissão
 */
function commissionForUser_(user, monthKey) {
  const mk = monthKey || toMonthKey_(new Date());
  const sales = salesQuery_(user, 'self', mk);
  const rets = retentionQuery_(user, 'self', mk);
  const stats = retentionStats_(rets);

  const isDigital = user.cargo === ROLES.AT_RET_DIGITAL || user.cargo === ROLES.SUP_RET_DIGITAL;
  const cartao = isDigital
    ? { base: 0, bonusArg: 0, bonusPremium: 0, total: commissionCartaoDigital_(rets).valor, detalhes: ['Pontuação digital'], pontos: commissionCartaoDigital_(rets).pontos }
    : commissionCartaoFone_(stats.cartao);

  const globais = commissionGlobal_(sales, rets);
  const total = round2_(cartao.total + globais.vendas + globais.contaDigital +
    globais.retencaoMassificados + globais.conversaoMilhasCashback);

  return {
    mes: mk,
    cartao: cartao,
    globais: globais,
    totalVendas: globais.vendas,
    totalRetencao: round2_(total - globais.vendas),
    total: total
  };
}

/** Arredonda em 2 casas. */
function round2_(v) { return Math.round(v * 100) / 100; }
