/**
 * ============================================================
 * Prisma Performance — Sales.gs
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
  if (qtd > 1000) throw new Error('Quantidade acima do limite (1000) — confira o valor digitado.');

  // Produto precisa existir e estar ativo — um payload manipulado
  // não pode poluir a base com produtos inventados
  const produtoOk = readAll_(SHEETS.PRODUCTS).some(function (p) {
    return String(p.nome) === String(data.produto).trim() && String(p.ativo) !== 'Não';
  });
  if (!produtoOk) throw new Error('Produto inválido ou inativo.');

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
  // Anti-duplicidade: venda idêntica nos últimos 10s é bloqueada
  assertNoRecentDuplicate_(SHEETS.SALES, sale, ['data', 'cpf', 'produto', 'quantidade'], 10);
  appendRow_(SHEETS.SALES, sale);
  audit_(me.email, 'SALE_CREATE', sale.produto + ' x' + qtd);
  return sale;
}

/**
 * Últimos lançamentos para a tela Nova Venda:
 * os ENTRY_DELETE_LIMIT próprios (todo perfil) e, para
 * supervisor/ADMIN, também os 10 mais recentes do seu escopo.
 * @param {Object} me
 * @return {Object} {meus[], equipe[]?}
 */
function salesRecent_(me) {
  function fmt(s, nomes) {
    const o = { id: s.id, data: toDateBR_(s.data), cpf: maskCpf_(s.cpf), produto: s.produto, quantidade: s.quantidade };
    if (nomes) o.atendente = nomes[String(s.userId)] || '(removido)';
    return o;
  }
  const out = { meus: ownRecentEntries_(SHEETS.SALES, me, ENTRY_DELETE_LIMIT).map(function (s) { return fmt(s); }) };
  if (isAdmin_(me) || isSupervisor_(me)) {
    const nomes = userNameMap_();
    out.equipe = teamRecentEntries_(SHEETS.SALES, me, 10).map(function (s) { return fmt(s, nomes); });
  }
  return out;
}

/**
 * Exclui uma venda (autonomia do atendente / escopo do gestor —
 * regras em entryDelete_). Definitiva e auditada.
 */
function salesDelete_(me, id) {
  const row = entryDelete_(SHEETS.SALES, me, id);
  audit_(me.email, 'SALE_DELETE', row.produto + ' x' + row.quantidade + ' de ' + toDateBR_(row.data));
  return true;
}

/**
 * Devolve os campos EDITÁVEIS (crus) de uma venda, após autorizar
 * a mutação. O CPF completo só é revelado a quem pode editar o
 * registro (dono/escopo) — a lista de "últimos" segue mascarada.
 * @param {Object} me
 * @param {string} id
 * @return {Object} {id, data(yyyy-MM-dd), cpf, produto, quantidade, obs}
 */
function salesGetForEdit_(me, id) {
  const row = readAll_(SHEETS.SALES).find(function (s) { return String(s.id) === String(id); });
  if (!row) throw new Error('Venda não encontrada.');
  entryAssertCanMutate_(SHEETS.SALES, me, row, 'editar');
  return {
    id: row.id, data: toDateKey_(row.data), cpf: String(row.cpf).replace(/\D/g, ''),
    produto: row.produto, quantidade: row.quantidade, obs: row.obs || ''
  };
}

/**
 * Edita uma venda existente. Reaproveita EXATAMENTE as validações
 * do cadastro (produto ativo, quantidade) e a autonomia do excluir
 * (entryAssertCanMutate_). id, userId, equipe e criadoEm são
 * preservados; a comissão recalcula sozinha na próxima leitura.
 * @param {Object} me
 * @param {string} id
 * @param {Object} data {data, cpf, produto, quantidade, obs}
 */
function salesUpdate_(me, id, data) {
  const row = readAll_(SHEETS.SALES).find(function (s) { return String(s.id) === String(id); });
  if (!row) throw new Error('Venda não encontrada.');
  entryAssertCanMutate_(SHEETS.SALES, me, row, 'editar');

  if (!data.data) throw new Error('Data é obrigatória.');
  if (!isValidCpf_(data.cpf)) throw new Error('CPF inválido (11 dígitos).');
  if (!data.produto) throw new Error('Produto é obrigatório.');
  const qtd = parseInt(data.quantidade, 10);
  if (!qtd || qtd < 1) throw new Error('Quantidade deve ser maior que zero.');
  if (qtd > 1000) throw new Error('Quantidade acima do limite (1000) — confira o valor digitado.');
  const produtoOk = readAll_(SHEETS.PRODUCTS).some(function (p) {
    return String(p.nome) === String(data.produto).trim() && String(p.ativo) !== 'Não';
  });
  if (!produtoOk) throw new Error('Produto inválido ou inativo.');

  const patch = {
    data: toDateKey_(data.data),
    cpf: String(data.cpf).replace(/\D/g, ''),
    produto: String(data.produto).trim(),
    quantidade: qtd,
    obs: String(data.obs || '').trim()
  };
  if (!updateRowById_(SHEETS.SALES, id, patch)) throw new Error('Falha ao atualizar a venda.');
  audit_(me.email, 'SALE_UPDATE', patch.produto + ' x' + qtd + ' de ' + toDateBR_(patch.data));
  return true;
}

/**
 * Vendas do mês corrente filtradas por escopo.
 * @param {Object} me
 * @param {string} scope 'self' | 'team' | 'all'
 * @param {string=} monthKey 'yyyy-MM' (padrão: mês atual)
 */
function salesQuery_(me, scope, monthKey) {
  const mk = sanitizeMonthKey_(monthKey);
  return readAll_(SHEETS.SALES).filter(function (s) {
    if (toMonthKey_(s.data) !== mk) return false;
    if (scope === 'self') return String(s.userId) === String(me.id);
    if (scope === 'team') return String(s.equipe) === String(me.equipe);
    return true; // all
  });
}
