/**
 * ============================================================
 * PortoBank Performance — Auth.js
 * ------------------------------------------------------------
 * Responsabilidade única: identidade e autorização.
 *
 * - Login Google automático: Session.getActiveUser() identifica
 *   o usuário sem senha.
 * - As permissões são resolvidas pelo E-MAIL, consultando a
 *   aba Usuarios.
 * - Toda função de negócio DEVE passar por Auth.exigir() antes
 *   de tocar em dados.
 * ============================================================
 */

var Auth = (function () {

  /** Usuário logado (via conta Google) + perfil + permissões */
  function usuarioAtual() {
    var email = Session.getActiveUser().getEmail();
    if (!email) throw new Error('Não foi possível identificar sua conta Google.');

    var u = Db.indexBy(CONFIG.SHEETS.USUARIOS, 'email')[email];
    if (!u || u.ativo === false || String(u.ativo).toLowerCase() === 'false') {
      return { email: email, autorizado: false };
    }

    return {
      autorizado: true,
      id: u.id,
      email: email,
      nome: u.nome,
      perfil: u.perfil,
      supervisorEmail: u.supervisorEmail || '',
      equipeId: u.equipeId || '',
      permissoes: getPermissoesDoPerfil(u.perfil)
    };
  }

  /** Lança erro se o usuário não estiver autorizado */
  function exigir() {
    var u = usuarioAtual();
    if (!u.autorizado) throw new Error('Acesso negado. Solicite cadastro ao administrador (' + u.email + ').');
    return u;
  }

  /** Exige um perfil específico (ex.: apenas ADMIN) */
  function exigirPerfil(perfis) {
    var u = exigir();
    if (perfis.indexOf(u.perfil) === -1) throw new Error('Seu perfil não permite esta ação.');
    return u;
  }

  /**
   * Filtro de escopo de visualização.
   * Devolve uma função (row) => boolean que aplica a regra:
   *   ADMIN → tudo | SUPERVISOR → equipe | ATENDENTE → só ele.
   */
  function filtroEscopo(usuario, campoAtendente, campoSupervisor) {
    campoAtendente  = campoAtendente  || 'atendenteEmail';
    campoSupervisor = campoSupervisor || 'supervisorEmail';

    if (usuario.permissoes.escopo === 'ALL') return function () { return true; };

    if (usuario.permissoes.escopo === 'TEAM') {
      // Supervisor enxerga apenas registros ligados a ele
      var liderados = Db.readAll(CONFIG.SHEETS.USUARIOS)
        .filter(function (u) { return u.supervisorEmail === usuario.email; })
        .map(function (u) { return u.email; });
      return function (r) {
        return r[campoSupervisor] === usuario.email ||
               liderados.indexOf(r[campoAtendente]) !== -1;
      };
    }

    // SELF: apenas registros do próprio atendente
    return function (r) { return r[campoAtendente] === usuario.email; };
  }

  /** O usuário pode editar este registro? (regra de equipe/self) */
  function podeEditarRegistro(usuario, registro) {
    if (usuario.permissoes.editarQualquerRegistro) return true;
    if (usuario.permissoes.editarRegistrosDaEquipe) {
      return filtroEscopo(usuario)(registro);
    }
    return registro.atendenteEmail === usuario.email;
  }

  return {
    usuarioAtual: usuarioAtual,
    exigir: exigir,
    exigirPerfil: exigirPerfil,
    filtroEscopo: filtroEscopo,
    podeEditarRegistro: podeEditarRegistro
  };
})();
