/**
 * ============================================================
 * PortoBank Performance — Sales.js
 * ------------------------------------------------------------
 * Responsabilidade única: regras de negócio de VENDAS.
 * Validação, escopo de visualização, permissão de registro
 * por perfil e trilha de auditoria.
 * ============================================================
 */

var Sales = (function () {

  /** Valida o payload de venda antes de gravar */
  function validar_(v) {
    if (!v.data) throw new Error('Informe a data da venda.');
    if (!v.cliente) throw new Error('Informe o cliente.');
    if (!v.produto) throw new Error('Informe o produto.');
    if (CONFIG.PRODUTOS_VENDA.indexOf(v.produto) === -1)
      throw new Error('Produto não permitido em vendas: ' + v.produto);
    if (v.cpf && !Utils.cpfValido(v.cpf))
      throw new Error('CPF inválido.');
    if ([CONFIG.STATUS.CONCLUIDA, CONFIG.STATUS.CANCELADA].indexOf(v.status) === -1)
      throw new Error('Status inválido.');
  }

  /** Registrar nova venda */
  function registrar(payload) {
    var u = Auth.exigir();
    if (!u.permissoes.registrar || !u.permissoes.registrar.vendaCartao)
      throw new Error('Seu perfil não registra vendas.');

    var venda = {
      id: Db.nextId(CONFIG.SHEETS.VENDAS),
      data: payload.data,
      cliente: payload.cliente,
      cpf: Utils.limparCpf(payload.cpf),
      produto: payload.produto,
      tipo: payload.tipo || 'Cartão',
      // Atendentes têm canal fixo pelo perfil; ADMIN escolhe
      canal: u.permissoes.canalFixo || payload.canal,
      supervisorEmail: u.supervisorEmail || payload.supervisorEmail || '',
      atendenteEmail: (u.permissoes.escopo === 'SELF') ? u.email : (payload.atendenteEmail || u.email),
      status: payload.status || CONFIG.STATUS.CONCLUIDA,
      observacoes: payload.observacoes || '',
      criadoPor: u.email,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };
    validar_(venda);

    Db.insert(CONFIG.SHEETS.VENDAS, venda);
    Audit.registrarAlteracao(u.email, CONFIG.SHEETS.VENDAS, venda.id, null, venda, payload.ip);
    return venda;
  }

  /** Editar venda existente (respeita escopo do perfil) */
  function editar(id, changes, ip) {
    var u = Auth.exigir();
    var atual = Db.readAll(CONFIG.SHEETS.VENDAS).filter(function (r) { return r.id === id; })[0];
    if (!atual) throw new Error('Venda não encontrada.');
    if (!Auth.podeEditarRegistro(u, atual)) throw new Error('Você não pode editar esta venda.');

    changes.atualizadoEm = new Date();
    var res = Db.update(CONFIG.SHEETS.VENDAS, id, changes);
    Audit.registrarAlteracao(u.email, CONFIG.SHEETS.VENDAS, id, res.antes, res.depois, ip);
    return res.depois;
  }

  /** Listagem paginada respeitando o escopo do usuário */
  function listar(opts) {
    var u = Auth.exigir();
    opts = opts || {};
    var escopo = Auth.filtroEscopo(u);
    var filtroPeriodo = Utils.filtroPeriodo(opts.inicio, opts.fim, 'data');

    return Db.query(CONFIG.SHEETS.VENDAS, {
      filtro: function (r) { return escopo(r) && filtroPeriodo(r); },
      busca: opts.busca,
      pagina: opts.pagina,
      porPagina: opts.porPagina,
      ordenarPor: opts.ordenarPor || 'data',
      desc: opts.desc !== false
    });
  }

  return { registrar: registrar, editar: editar, listar: listar };
})();
