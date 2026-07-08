/**
 * ============================================================
 * PortoBank Performance — Sales.gs
 * ------------------------------------------------------------
 * Registro e consulta de vendas de massificados.
 * Campos: Data, CPF, Produto (Massificado), Quantidade, OBS.
 * ============================================================
 */

/**
 * Registra uma nova venda.
 * @param {Object} me Usuário autenticado.
 * @param {Object} data {data, cpf, produto, quantidade, obs}
 */
function salesCreate_(me, data) {
  if (!data.data) throw new Error('Data é obrigatória.');
  if (!isValidCpf_(data.cpf)) throw new Error('CPF inválido (11 dígitos).');
  if (!data.produto) throw new Error('Produto é obrigatório.');
  const qtd = parseInt(data.quantidade, 10);
  if (!qtd || qtd < 1) throw new Error('Quantidade deve ser maior que zero.');

  const sale = {
    id: uid_(),
    data: toDateKey_(data.data),
    cpf: String(data.cpf).replace(/\D/g, ''),
    produto: String(data.produto).trim(),
    quantidade: qtd,
    obs: String(data.obs || '').trim(),
    userId: me.id,
    equipe: me.equipe,
    criadoEm: nowIso_()
  };
  appendRow_(SHEETS.SALES, sale);
  audit_(me.email, 'SALE_CREATE', sale.produto + ' x' + qtd);
  return sale;
}

/**
 * Vendas do mês corrente filtradas por escopo.
 * @param {Object} me
 * @param {string} scope 'self' | 'team' | 'all'
 * @param {string=} monthKey 'yyyy-MM' (padrão: mês atual)
 */
function salesQuery_(me, scope, monthKey) {
  const mk = monthKey || toMonthKey_(new Date());
  return readAll_(SHEETS.SALES).filter(function (s) {
    if (toMonthKey_(s.data) !== mk) return false;
    if (scope === 'self') return String(s.userId) === String(me.id);
    if (scope === 'team') return String(s.equipe) === String(me.equipe);
    return true; // all
  });
}
