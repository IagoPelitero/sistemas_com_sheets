/**
 * ============================================================
 * PortoBank Performance — Auth.gs
 * ------------------------------------------------------------
 * Autenticação via conta Google (Session) + REGRA DO
 * PRIMEIRO LOGIN:
 *
 *   Se NÃO existir nenhum usuário cadastrado, o primeiro
 *   login cria automaticamente o usuário como ADMIN e o
 *   registra normalmente na aba Users (visível, sem exceções).
 * ============================================================
 */

/**
 * Retorna o e-mail do usuário logado no Google.
 * @return {string}
 */
function getSessionEmail_() {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error('Não foi possível identificar sua conta Google. Verifique o modo de publicação do Web App.');
  }
  return email.toLowerCase().trim();
}

/**
 * Resolve o usuário atual. Aplica a regra do primeiro login.
 * @return {Object} usuário (linha da aba Users)
 */
function getCurrentUser_() {
  const email = getSessionEmail_();
  const users = readAll_(SHEETS.USERS);

  // ---- PRIMEIRO LOGIN: nenhum usuário cadastrado ----
  if (users.length === 0) {
    const admin = {
      id: uid_(),
      nome: email.split('@')[0],
      email: email,
      cargo: ROLES.ADMIN,
      equipe: 'Administração',
      status: 'Ativo',
      tema: 'portobank',
      criadoEm: nowIso_(),
      atualizadoEm: nowIso_()
    };
    appendRow_(SHEETS.USERS, admin); // registrado NORMALMENTE na aba Users
    ensureDefaultSettings_();         // popula comissões/produtos padrão
    audit_(email, 'BOOTSTRAP', 'Primeiro login: ADMIN criado automaticamente');
    return admin;
  }

  const user = users.find(function (u) { return String(u.email).toLowerCase().trim() === email; });
  if (!user) {
    throw new Error('ACCESS_DENIED: Seu e-mail (' + email + ') não está cadastrado. Solicite acesso ao seu supervisor ou ADMIN.');
  }
  if (String(user.status) !== 'Ativo') {
    throw new Error('ACCESS_DENIED: Seu usuário está inativo. Contate o ADMIN.');
  }
  return user;
}

/**
 * Permissões do cargo do usuário.
 * @param {Object} user
 * @return {Object}
 */
function getPermissions_(user) {
  return PERMISSIONS[user.cargo] || PERMISSIONS[ROLES.AT_VENDAS];
}

/** true se o usuário é ADMIN. */
function isAdmin_(user) { return user.cargo === ROLES.ADMIN; }

/** true se o usuário é supervisor (qualquer tipo). */
function isSupervisor_(user) { return SUPERVISOR_ROLES.indexOf(user.cargo) !== -1; }

/**
 * Garante que `user` possa gerenciar `target` (escopo).
 * ADMIN: tudo. Supervisor: apenas a própria equipe.
 * @throws {Error} se não autorizado.
 */
function assertCanManage_(user, target) {
  if (isAdmin_(user)) return;
  if (isSupervisor_(user) && String(target.equipe) === String(user.equipe)) return;
  throw new Error('Sem permissão para gerenciar este usuário.');
}

/**
 * Filtra usuários visíveis conforme o escopo do solicitante.
 * @param {Object} user
 * @return {Object[]}
 */
function visibleUsers_(user) {
  const all = readAll_(SHEETS.USERS);
  if (isAdmin_(user)) return all;
  // Supervisor e atendentes: apenas a própria equipe
  return all.filter(function (u) { return String(u.equipe) === String(user.equipe); });
}
