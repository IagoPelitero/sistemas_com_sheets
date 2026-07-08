/**
 * ============================================================
 * PortoBank Performance — Setup.js
 * ------------------------------------------------------------
 * Responsabilidade única: criar/verificar a estrutura do banco
 * (abas + cabeçalhos) no Google Sheets.
 *
 * Nenhum dado de regra é fixado em código: as abas de regras
 * nascem vazias e são preenchidas pelas telas de Configurações.
 * ============================================================
 */

var Setup = (function () {

  /** Cabeçalhos de cada aba. Sheets = tabelas; linha 1 = schema. */
  var SCHEMA = {
    Usuarios: ['id', 'email', 'nome', 'perfil', 'supervisorEmail', 'equipeId', 'ativo', 'criadoEm'],
    Supervisores: ['id', 'email', 'nome', 'equipeId', 'ativo'],
    Equipes: ['id', 'nome', 'canal', 'supervisorEmail', 'ativo'],
    Produtos: ['id', 'nome', 'categoria', 'aplicaVenda', 'aplicaRetencao', 'ativo'],
    Metas: ['id', 'competencia', 'equipeId', 'supervisorEmail', 'atendenteEmail', 'canal',
            'produto', 'tipo', 'metaQuantidade', 'metaPercentual', 'ativo'],
    // Motor DIGITAL — cada linha é uma regra parametrizável
    RegrasComissao: ['id', 'nome', 'canal', 'produto', 'tipo', 'metrica',
                     'faixaMin', 'faixaMax', 'valor', 'unidade', 'prioridade',
                     'vigenciaInicio', 'vigenciaFim', 'ativo'],
    // Motor FONE — estrutura própria (percentualMin/Max + valor + tipo + produto + canal)
    RegrasFone: ['id', 'nome', 'produto', 'tipo', 'canal',
                 'percentualMin', 'percentualMax', 'valor', 'unidade',
                 'vigenciaInicio', 'vigenciaFim', 'ativo'],
    RegrasRetencao: ['id', 'nome', 'produto', 'tipoRetencao', 'valorMaximoConcedido',
                     'pontuacao', 'ativo'],
    Bonificacoes: ['id', 'nome', 'condicaoMetrica', 'condicaoMin', 'condicaoMax',
                   'valor', 'unidade', 'canal', 'produto', 'vigenciaInicio', 'vigenciaFim', 'ativo'],
    Faixas: ['id', 'nome', 'metrica', 'percentualMin', 'percentualMax', 'multiplicador', 'ativo'],
    Vendas: ['id', 'data', 'cliente', 'cpf', 'produto', 'tipo', 'canal',
             'supervisorEmail', 'atendenteEmail', 'status', 'observacoes',
             'criadoPor', 'criadoEm', 'atualizadoEm'],
    Retencoes: ['id', 'data', 'cliente', 'cpf', 'produto', 'tipoRetencao',
                'motivoCancelamento', 'motivoRetencao', 'valorConcedido', 'canal',
                'supervisorEmail', 'atendenteEmail', 'status',
                'criadoPor', 'criadoEm', 'atualizadoEm'],
    Comissoes: ['id', 'competencia', 'atendenteEmail', 'canal', 'valorCalculado',
                'detalheJson', 'calculadoEm'],
    Auditoria: ['id', 'usuario', 'data', 'hora', 'tabela', 'registroId',
                'campoAlterado', 'valorAnterior', 'novoValor', 'ip'],
    Logs: ['id', 'usuario', 'data', 'hora', 'acao', 'detalhe'],
    Configuracoes: ['chave', 'valor', 'descricao', 'atualizadoPor', 'atualizadoEm'],
    Campanhas: ['id', 'nome', 'descricao', 'inicio', 'fim', 'canal', 'produto',
                'bonusValor', 'bonusUnidade', 'ativo']
  };

  /** Cria a planilha-banco completa e devolve o ID */
  function criarBanco() {
    var ss = SpreadsheetApp.create(CONFIG.APP_NAME + ' — Banco de Dados');
    var primeira = ss.getSheets()[0];

    Object.keys(SCHEMA).forEach(function (nome, i) {
      var sh = (i === 0) ? primeira.setName(nome) : ss.insertSheet(nome);
      var headers = SCHEMA[nome];
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, headers.length)
        .setBackground('#001E64').setFontColor('#FFFFFF').setFontWeight('bold');
    });

    PropertiesService.getScriptProperties()
      .setProperty(CONFIG.PROP_SSID, ss.getId());

    // Primeiro usuário = quem executou o setup, como ADMIN
    var email = Session.getActiveUser().getEmail();
    if (email) {
      ss.getSheetByName('Usuarios').appendRow([
        'USU-000001', email, email.split('@')[0], CONFIG.PERFIS.ADMIN,
        '', '', true, new Date()
      ]);
    }
    return ss.getId();
  }

  /** Confere se todas as abas existem (uso em manutenção) */
  function verificarBanco() {
    var ss = Db._ss();
    var faltando = Object.keys(SCHEMA).filter(function (n) { return !ss.getSheetByName(n); });
    faltando.forEach(function (nome) {
      var sh = ss.insertSheet(nome);
      sh.getRange(1, 1, 1, SCHEMA[nome].length).setValues([SCHEMA[nome]]);
      sh.setFrozenRows(1);
    });
    return faltando;
  }

  return { criarBanco: criarBanco, verificarBanco: verificarBanco, SCHEMA: SCHEMA };
})();
