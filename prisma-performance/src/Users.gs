/**
 * ============================================================
 * Prisma Performance — Users.gs
 * ------------------------------------------------------------
 * CRUD de usuários.
 *  - Edição completa via sistema (Nome, Email, Cargo, Equipe,
 *    Status) — sem abrir o Sheets.
 *  - Exclusão DEFINITIVA da linha (deleteRow), sem soft delete.
 * ============================================================
 */

/**
 * Cria um usuário.
 * @param {Object} me Usuário autenticado.
 * @param {Object} data {nome, email, cargo, equipe, status}
 * @return {Object} usuário criado.
 */
function usersCreate_(me, data) {
  const perms = getPermissions_(me);
  if (!perms.canManageUsers) throw new Error('Sem permissão para cadastrar usuários.');

  const email = String(data.email || '').toLowerCase().trim();
  if (!email || email.indexOf('@') === -1) throw new Error('E-mail inválido.');
  if (!data.nome) throw new Error('Nome é obrigatório.');
  if (!PERMISSIONS[data.cargo]) throw new Error('Cargo inválido.');

  // Supervisor só cadastra na própria equipe e nunca cria ADMIN/supervisores
  if (!isAdmin_(me)) {
    if (data.cargo === ROLES.ADMIN || SUPERVISOR_ROLES.indexOf(data.cargo) !== -1) {
      throw new Error('Somente o ADMIN pode criar administradores ou supervisores.');
    }
    data.equipe = me.equipe;
  }

  const exists = readAll_(SHEETS.USERS).some(function (u) {
    return String(u.email).toLowerCase().trim() === email;
  });
  if (exists) throw new Error('Já existe um usuário com este e-mail.');

  const user = {
    id: uid_(),
    nome: String(data.nome).trim(),
    email: email,
    cargo: data.cargo,
    equipe: String(data.equipe || '').trim(),
    status: data.status || 'Ativo',
    tema: 'prisma',
    motor: isAdmin_(me) ? normalizeMotor_(data.motor) : '',
    criadoEm: nowIso_(),
    atualizadoEm: nowIso_()
  };
  appendRow_(SHEETS.USERS, user);
  audit_(me.email, 'USER_CREATE', email);
  return user;
}

/**
 * Valida o motor da regra do Cartão de Crédito.
 * '' / 'auto' = automático pelo cargo | 'fone' | 'digital'.
 * Afeta SOMENTE o cálculo do Cartão — nenhuma outra comissão.
 */
function normalizeMotor_(v) {
  const m = String(v || '').toLowerCase().trim();
  if (m === '' || m === 'auto') return '';
  if (m === 'fone' || m === 'digital') return m;
  throw new Error("Motor de comissão inválido. Use 'auto', 'fone' ou 'digital'.");
}

/**
 * Edita um usuário (Nome, Email, Cargo, Equipe, Status).
 * @param {Object} me
 * @param {string} id
 * @param {Object} patch
 */
function usersUpdate_(me, id, patch) {
  const perms = getPermissions_(me);
  if (!perms.canManageUsers) throw new Error('Sem permissão para editar usuários.');

  const target = readAll_(SHEETS.USERS).find(function (u) { return String(u.id) === String(id); });
  if (!target) throw new Error('Usuário não encontrado.');
  assertCanManage_(me, target);

  const allowed = {};
  ['nome', 'email', 'cargo', 'equipe', 'status'].forEach(function (f) {
    if (patch[f] !== undefined && patch[f] !== '') allowed[f] = patch[f];
  });
  if (allowed.email) allowed.email = String(allowed.email).toLowerCase().trim();
  if (allowed.cargo && !PERMISSIONS[allowed.cargo]) throw new Error('Cargo inválido.');
  if (allowed.cargo && !isAdmin_(me) &&
      (allowed.cargo === ROLES.ADMIN || SUPERVISOR_ROLES.indexOf(allowed.cargo) !== -1)) {
    throw new Error('Somente o ADMIN pode promover a administrador ou supervisor.');
  }
  if (!isAdmin_(me)) delete allowed.equipe; // supervisor não move gente de equipe

  // Motor do Cartão de Crédito: SOMENTE o ADMIN altera. Tratado
  // fora do loop acima porque '' (automático) é um valor válido.
  if (patch.motor !== undefined) {
    if (!isAdmin_(me)) throw new Error('Somente o ADMIN pode alterar a regra de comissão do Cartão.');
    allowed.motor = normalizeMotor_(patch.motor);
  }

  allowed.atualizadoEm = nowIso_();
  if (!updateRowById_(SHEETS.USERS, id, allowed)) throw new Error('Falha ao atualizar usuário.');
  audit_(me.email, 'USER_UPDATE', id);
  return true;
}

/**
 * EXCLUI DEFINITIVAMENTE um usuário — remove a linha da aba
 * Users. Sem lixo de dados.
 * @param {Object} me
 * @param {string} id
 */
function usersDelete_(me, id) {
  const perms = getPermissions_(me);
  if (!perms.canManageUsers) throw new Error('Sem permissão para excluir usuários.');

  const target = readAll_(SHEETS.USERS).find(function (u) { return String(u.id) === String(id); });
  if (!target) throw new Error('Usuário não encontrado.');
  if (String(target.id) === String(me.id)) throw new Error('Você não pode excluir a si mesmo.');
  assertCanManage_(me, target);

  if (!deleteRowById_(SHEETS.USERS, id)) throw new Error('Falha ao excluir usuário.');
  audit_(me.email, 'USER_DELETE', target.email);
  return true;
}

/**
 * Salva a preferência de tema do usuário.
 * @param {Object} me
 * @param {string} tema
 */
function usersSetTheme_(me, tema) {
  if (THEMES.indexOf(tema) === -1) throw new Error('Tema inválido.');
  updateRowById_(SHEETS.USERS, me.id, { tema: tema, atualizadoEm: nowIso_() });
  return true;
}
