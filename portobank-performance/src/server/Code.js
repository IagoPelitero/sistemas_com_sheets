/**
 * ============================================================
 * PortoBank Performance — Code.js
 * ------------------------------------------------------------
 * Responsabilidade única: ponto de entrada do Web App e
 * fachada da API. O front-end SÓ conversa com as funções
 * api_* deste arquivo (via google.script.run) — nunca acessa
 * módulos internos diretamente.
 *
 * Cada função api_* devolve { ok, dados | erro } para que o
 * front trate falhas sem quebrar o atendimento.
 * ============================================================
 */

/** Serve a SPA */
function doGet() {
  return HtmlService.createTemplateFromFile('client/Index')
    .evaluate()
    .setTitle(CONFIG.APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Inclui parciais HTML (CSS/JS) dentro do template principal */
function include(arquivo) {
  return HtmlService.createHtmlOutputFromFile(arquivo).getContent();
}

/** Envelopa qualquer chamada de negócio com tratamento de erro padrão */
function api_(fn) {
  try {
    return { ok: true, dados: fn() };
  } catch (e) {
    return { ok: false, erro: e.message || String(e) };
  }
}

/* ------------------- Sessão / contexto ------------------- */
function api_contexto() {
  return api_(function () {
    var u = Auth.usuarioAtual();
    return {
      usuario: u,
      app: { nome: CONFIG.APP_NAME, subtitulo: CONFIG.APP_SUBTITLE },
      catalogos: {
        produtosVenda: CONFIG.PRODUTOS_VENDA,
        produtosRetencao: CONFIG.PRODUTOS_RETENCAO,
        tiposRetencao: CONFIG.TIPOS_RETENCAO,
        canais: [CONFIG.CANAIS.DIGITAL, CONFIG.CANAIS.FONE],
        status: [CONFIG.STATUS.CONCLUIDA, CONFIG.STATUS.CANCELADA],
        perfis: Object.keys(CONFIG.PERMISSOES)
      }
    };
  });
}

/* ------------------------ Dashboard ---------------------- */
function api_dashboard()                { return api_(function () { return Dashboard.carregar(); }); }

/* ------------------------- Vendas ------------------------ */
function api_vendaRegistrar(payload)    { return api_(function () { return Sales.registrar(payload); }); }
function api_vendaEditar(id, changes)   { return api_(function () { return Sales.editar(id, changes); }); }
function api_vendasListar(opts)         { return api_(function () { return Sales.listar(opts); }); }

/* ------------------------ Retenções ---------------------- */
function api_retencaoRegistrar(payload) { return api_(function () { return Retention.registrar(payload); }); }
function api_retencaoEditar(id, ch)     { return api_(function () { return Retention.editar(id, ch); }); }
function api_retencoesListar(opts)      { return api_(function () { return Retention.listar(opts); }); }

/* ------------------------ Comissões ---------------------- */
function api_minhaComissao(comp)        { return api_(function () { return Commission.minhaComissao(comp); }); }
function api_comissaoDe(email, comp)    { return api_(function () { return Commission.comissaoDe(email, comp); }); }
function api_consolidarComissoes(comp)  { return api_(function () { return Commission.consolidar(comp); }); }

/* -------------------------- Metas ------------------------ */
function api_metaSalvar(payload)        { return api_(function () { return Goals.salvar(payload); }); }
function api_metasListar(opts)          { return api_(function () { return Goals.listar(opts); }); }
function api_progresso(comp)            { return api_(function () { return Goals.progresso(comp); }); }

/* ------------------------- Ranking ----------------------- */
function api_rankingIndividual(comp)    { return api_(function () { return Ranking.individual(comp); }); }
function api_rankingEquipes(comp)       { return api_(function () { return Ranking.equipes(comp); }); }
function api_rankingSupervisores(comp)  { return api_(function () { return Ranking.supervisores(comp); }); }

/* -------------------- Usuários / Equipe ------------------ */
function api_usuarioSalvar(payload)     { return api_(function () { return Users.salvar(payload); }); }
function api_usuarioExcluir(id)         { return api_(function () { return Users.excluir(id); }); }
function api_usuariosListar(opts)       { return api_(function () { return Users.listar(opts); }); }
function api_equipeSalvar(payload)      { return api_(function () { return Users.salvarEquipe(payload); }); }
function api_minhaEquipe()              { return api_(function () { return Users.minhaEquipe(); }); }

/* ---------------------- Configurações -------------------- */
function api_configListar(tabela, opts) { return api_(function () { return Settings.listar(tabela, opts); }); }
function api_configSalvar(tabela, p)    { return api_(function () { return Settings.salvar(tabela, p); }); }
function api_configExcluir(tabela, id)  { return api_(function () { return Settings.excluir(tabela, id); }); }
function api_configSchema(tabela)       { return api_(function () { return Settings.schema(tabela); }); }
function api_configSet(chave, valor, d) { return api_(function () { return Settings.set(chave, valor, d); }); }

/* ------------------------ Relatórios --------------------- */
function api_exportCsv(opts)            { return api_(function () { return Reports.exportarCsv(opts); }); }
function api_exportExcel(opts)          { return api_(function () { return Reports.exportarExcel(opts); }); }
function api_exportPdf(opts)            { return api_(function () { return Reports.exportarPdf(opts); }); }

/* ---------------------- Administração -------------------- */
/** Executar UMA vez no editor do Apps Script para criar o banco */
function setupInicial() { return Setup.criarBanco(); }
function verificarBanco() { return Setup.verificarBanco(); }
