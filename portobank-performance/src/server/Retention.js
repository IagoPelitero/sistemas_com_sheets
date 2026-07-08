/**
 * ============================================================
 * PortoBank Performance — Retention.js
 * ------------------------------------------------------------
 * Responsabilidade única: regras de negócio de RETENÇÕES.
 * Cada perfil só registra os produtos que sua matriz permite:
 *   - Vendas Digital ............... Retenção Conta
 *   - Vendas+Retenção Digital ...... Retenção Conta e Cartão
 *   - Retenção+Vendas Fone ......... Retenção Conta e Cartão
 * ============================================================
 */

var Retention = (function () {

  function podeRegistrarProduto_(u, produto) {
    var p = u.permissoes.registrar || {};
    if (produto === 'Conta')  return !!p.retencaoConta;
    if (produto === 'Cartão') return !!p.retencaoCartao;
    return false;
  }

  function validar_(r) {
    if (!r.data) throw new Error('Informe a data.');
    if (!r.cliente) throw new Error('Informe o cliente.');
    if (CONFIG.PRODUTOS_RETENCAO.indexOf(r.produto) === -1)
      throw new Error('Produto de retenção inválido: ' + r.produto);
    if (CONFIG.TIPOS_RETENCAO.indexOf(r.tipoRetencao) === -1)
      throw new Error('Tipo de retenção inválido.');
    if (r.cpf && !Utils.cpfValido(r.cpf)) throw new Error('CPF inválido.');
    if (r.valorConcedido && isNaN(Number(r.valorConcedido)))
      throw new Error('Valor concedido deve ser numérico.');
  }

  /** Registrar nova retenção */
  function registrar(payload) {
    var u = Auth.exigir();
    if (!podeRegistrarProduto_(u, payload.produto))
      throw new Error('Seu perfil não registra retenção de ' + payload.produto + '.');

    var ret = {
      id: Db.nextId(CONFIG.SHEETS.RETENCOES),
      data: payload.data,
      cliente: payload.cliente,
      cpf: Utils.limparCpf(payload.cpf),
      produto: payload.produto,
      tipoRetencao: payload.tipoRetencao,
      motivoCancelamento: payload.motivoCancelamento || '',
      motivoRetencao: payload.motivoRetencao || '',
      valorConcedido: Number(payload.valorConcedido || 0),
      canal: u.permissoes.canalFixo || payload.canal,
      supervisorEmail: u.supervisorEmail || payload.supervisorEmail || '',
      atendenteEmail: (u.permissoes.escopo === 'SELF') ? u.email : (payload.atendenteEmail || u.email),
      status: payload.status || CONFIG.STATUS.CONCLUIDA,
      criadoPor: u.email,
      criadoEm: new Date(),
      atualizadoEm: new Date()
    };
    validar_(ret);

    Db.insert(CONFIG.SHEETS.RETENCOES, ret);
    Audit.registrarAlteracao(u.email, CONFIG.SHEETS.RETENCOES, ret.id, null, ret, payload.ip);
    return ret;
  }

  /** Editar retenção (respeita escopo) */
  function editar(id, changes, ip) {
    var u = Auth.exigir();
    var atual = Db.readAll(CONFIG.SHEETS.RETENCOES).filter(function (r) { return r.id === id; })[0];
    if (!atual) throw new Error('Retenção não encontrada.');
    if (!Auth.podeEditarRegistro(u, atual)) throw new Error('Você não pode editar esta retenção.');

    changes.atualizadoEm = new Date();
    var res = Db.update(CONFIG.SHEETS.RETENCOES, id, changes);
    Audit.registrarAlteracao(u.email, CONFIG.SHEETS.RETENCOES, id, res.antes, res.depois, ip);
    return res.depois;
  }

  /** Listagem paginada com escopo */
  function listar(opts) {
    var u = Auth.exigir();
    opts = opts || {};
    var escopo = Auth.filtroEscopo(u);
    var filtroPeriodo = Utils.filtroPeriodo(opts.inicio, opts.fim, 'data');

    return Db.query(CONFIG.SHEETS.RETENCOES, {
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
