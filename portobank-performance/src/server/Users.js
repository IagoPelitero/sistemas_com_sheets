/**
 * ============================================================
 * PortoBank Performance — Users.js
 * ------------------------------------------------------------
 * Responsabilidade única: cadastro de usuários, supervisores
 * e equipes. Somente ADMIN altera; o SUPERVISOR lê apenas os
 * próprios liderados.
 * ============================================================
 */

var Users = (function () {

  /** ADMIN: cria ou atualiza usuário (permissão nasce do e-mail + perfil) */
  function salvar(payload) {
    var u = Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    if (!payload.email) throw new Error('Informe o e-mail Google do usuário.');
    if (!CONFIG.PERMISSOES[payload.perfil]) throw new Error('Perfil inválido.');

    var existente = Db.indexBy(CONFIG.SHEETS.USUARIOS, 'email')[payload.email];
    if (existente && !payload.id) payload.id = existente.id;

    if (payload.id) {
      var res = Db.update(CONFIG.SHEETS.USUARIOS, payload.id, payload);
      Audit.registrarAlteracao(u.email, CONFIG.SHEETS.USUARIOS, payload.id, res.antes, res.depois);
      return res.depois;
    }
    payload.id = Db.nextId(CONFIG.SHEETS.USUARIOS);
    payload.ativo = true;
    payload.criadoEm = new Date();
    Db.insert(CONFIG.SHEETS.USUARIOS, payload);
    Audit.registrarAlteracao(u.email, CONFIG.SHEETS.USUARIOS, payload.id, null, payload);

    // Se o perfil for SUPERVISOR, espelha na aba Supervisores
    if (payload.perfil === CONFIG.PERFIS.SUPERVISOR) {
      Db.insert(CONFIG.SHEETS.SUPERVISORES, {
        id: Db.nextId(CONFIG.SHEETS.SUPERVISORES),
        email: payload.email, nome: payload.nome,
        equipeId: payload.equipeId || '', ativo: true
      });
    }
    return payload;
  }

  /** ADMIN: exclusão (lógica) de usuário */
  function excluir(id) {
    var u = Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    var res = Db.remove(CONFIG.SHEETS.USUARIOS, id);
    Audit.registrarAlteracao(u.email, CONFIG.SHEETS.USUARIOS, id, res.antes, res.depois);
    return true;
  }

  /** Lista usuários conforme escopo (ADMIN tudo; SUPERVISOR só a equipe) */
  function listar(opts) {
    var u = Auth.exigir();
    opts = opts || {};
    var filtro;
    if (u.permissoes.escopo === 'ALL') filtro = function () { return true; };
    else if (u.permissoes.escopo === 'TEAM') filtro = function (r) { return r.supervisorEmail === u.email || r.email === u.email; };
    else filtro = function (r) { return r.email === u.email; };

    return Db.query(CONFIG.SHEETS.USUARIOS, {
      filtro: filtro, busca: opts.busca, pagina: opts.pagina, porPagina: opts.porPagina
    });
  }

  /** ADMIN: cria equipe */
  function salvarEquipe(payload) {
    var u = Auth.exigirPerfil([CONFIG.PERFIS.ADMIN]);
    if (payload.id) {
      var res = Db.update(CONFIG.SHEETS.EQUIPES, payload.id, payload);
      Audit.registrarAlteracao(u.email, CONFIG.SHEETS.EQUIPES, payload.id, res.antes, res.depois);
      return res.depois;
    }
    payload.id = Db.nextId(CONFIG.SHEETS.EQUIPES);
    payload.ativo = true;
    Db.insert(CONFIG.SHEETS.EQUIPES, payload);
    Audit.registrarAlteracao(u.email, CONFIG.SHEETS.EQUIPES, payload.id, null, payload);
    return payload;
  }

  /** Página "Equipe": números agregados visíveis ao atendente (sem valores) */
  function minhaEquipe() {
    var u = Auth.exigir();
    var colegas = Db.readAll(CONFIG.SHEETS.USUARIOS).filter(function (x) {
      return x.equipeId && x.equipeId === u.equipeId && x.ativo !== false;
    });
    var comp = Utils.competenciaAtual();
    var totais = { quantidade: 0, retidas: 0, tratativas: 0 };

    colegas.forEach(function (c) {
      var m = Commission._metricas(c.email, comp).metricas;
      totais.quantidade += m.VENDAS_TOTAL + m.RETENCOES_TOTAL;
      totais.retidas += m.RETENCOES_TOTAL;
      totais.tratativas += m.TRATATIVAS_TOTAL;
    });

    return {
      equipeId: u.equipeId,
      membros: colegas.map(function (c) { return { nome: c.nome, perfil: c.perfil }; }),
      quantidadeTotal: totais.quantidade,
      percentualEquipe: totais.tratativas
        ? Utils.round2((totais.retidas / totais.tratativas) * 100) : 0
    };
  }

  return { salvar: salvar, excluir: excluir, listar: listar,
           salvarEquipe: salvarEquipe, minhaEquipe: minhaEquipe };
})();
