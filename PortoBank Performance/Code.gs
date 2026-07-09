/**
 * ============================================================
 * PortoBank Performance — Code.gs
 * ------------------------------------------------------------
 * Ponto de entrada do Web App (doGet) e helper de includes.
 *
 * Publicação recomendada:
 *   Implantar → Novo app da web
 *   Executar como: "Usuário que acessa o app"
 *   Quem pode acessar: "Qualquer pessoa com conta Google"
 *   (ou restrito ao domínio da empresa)
 * ============================================================
 */

/**
 * Serve a aplicação (SPA).
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('PortoBank Performance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Inclui parciais HTML (Styles, App) no template principal.
 * @param {string} filename
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
