/**
 * ============================================================
 * PortoBank Performance — Config.js
 * ------------------------------------------------------------
 * Responsabilidade única: centralizar TODAS as constantes do
 * sistema. Nenhum outro arquivo deve conter "strings mágicas".
 * Nenhuma regra de negócio vive aqui — apenas configuração.
 * ============================================================
 */

var CONFIG = {

  /** Nome exibido no app e nos relatórios */
  APP_NAME: 'PortoBank Performance',
  APP_SUBTITLE: 'Gestão de Vendas, Retenção e Comissionamento para N1, N2 e N2 digital',

  /**
   * ID da planilha-banco. Deixe vazio para o Setup criar uma nova
   * automaticamente na primeira execução (o ID é gravado em
   * PropertiesService e reutilizado depois).
   */
  SPREADSHEET_ID: '',

  /** Chave usada em PropertiesService para guardar o ID da planilha */
  PROP_SSID: 'PBP_SPREADSHEET_ID',

  /** Tempo padrão de cache de leitura (segundos) */
  CACHE_TTL: 120,

  /** Tamanho de página padrão para listagens */
  PAGE_SIZE: 25,

  /** Abas (tabelas) do banco Google Sheets */
  SHEETS: {
    USUARIOS:        'Usuarios',
    SUPERVISORES:    'Supervisores',
    EQUIPES:         'Equipes',
    PRODUTOS:        'Produtos',
    METAS:           'Metas',
    REGRAS_COMISSAO: 'RegrasComissao',   // motor DIGITAL
    REGRAS_FONE:     'RegrasFone',       // motor FONE (regras distintas)
    REGRAS_RETENCAO: 'RegrasRetencao',
    BONIFICACOES:    'Bonificacoes',
    FAIXAS:          'Faixas',
    VENDAS:          'Vendas',
    RETENCOES:       'Retencoes',
    COMISSOES:       'Comissoes',
    AUDITORIA:       'Auditoria',
    LOGS:            'Logs',
    CONFIGURACOES:   'Configuracoes',
    CAMPANHAS:       'Campanhas'
  },

  /** Perfis de usuário (permissões atribuídas pelo e-mail Google) */
  PERFIS: {
    ADMIN:                 'ADMIN',
    SUPERVISOR:            'SUPERVISOR',
    AT_VENDAS_DIGITAL:     'ATENDENTE_VENDAS_DIGITAL',
    AT_VENDAS_RET_DIGITAL: 'ATENDENTE_VENDAS_RETENCAO_DIGITAL',
    AT_RET_VENDAS_FONE:    'ATENDENTE_RETENCAO_VENDAS_FONE'
  },

  /** Canais de atendimento */
  CANAIS: { DIGITAL: 'Digital', FONE: 'Fone' },

  /** Status possíveis de registros operacionais */
  STATUS: { CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada' },

  /** Produtos permitidos em VENDAS (o cadastro fino fica na aba Produtos) */
  PRODUTOS_VENDA: ['Cartão de Crédito', 'Seguros', 'Upgrade', 'Serviços'],

  /** Produtos permitidos em RETENÇÕES */
  PRODUTOS_RETENCAO: ['Conta', 'Cartão'],

  /** Tipos de retenção */
  TIPOS_RETENCAO: ['Argumentação', 'Cashback', 'Incentivo Financeiro'],

  /**
   * Matriz de capacidade por perfil.
   * O que cada perfil PODE FAZER (ações) e VER (escopo).
   * Escopos: ALL = tudo | TEAM = sua equipe | SELF = apenas ele mesmo
   */
  PERMISSOES: {
    ADMIN: {
      escopo: 'ALL',
      registrar: { vendaCartao: true, retencaoConta: true, retencaoCartao: true },
      editarQualquerRegistro: true,
      gerenciarUsuarios: true,
      gerenciarRegras: true,
      verComissaoDeTerceiros: true,
      exportar: true
    },
    SUPERVISOR: {
      escopo: 'TEAM',
      registrar: { vendaCartao: false, retencaoConta: false, retencaoCartao: false },
      editarQualquerRegistro: false,   // apenas registros da própria equipe
      editarRegistrosDaEquipe: true,
      gerenciarUsuarios: false,
      gerenciarRegras: false,
      verComissaoDeTerceiros: true,    // somente dos seus liderados (escopo TEAM)
      exportar: true
    },
    ATENDENTE_VENDAS_DIGITAL: {
      escopo: 'SELF',
      registrar: { vendaCartao: true, retencaoConta: true, retencaoCartao: false },
      canalFixo: 'Digital',
      verComissaoDeTerceiros: false,
      exportar: false
    },
    ATENDENTE_VENDAS_RETENCAO_DIGITAL: {
      escopo: 'SELF',
      registrar: { vendaCartao: true, retencaoConta: true, retencaoCartao: true },
      canalFixo: 'Digital',
      verComissaoDeTerceiros: false,
      exportar: false
    },
    ATENDENTE_RETENCAO_VENDAS_FONE: {
      escopo: 'SELF',
      registrar: { vendaCartao: true, retencaoConta: true, retencaoCartao: true },
      canalFixo: 'Fone',
      motorComissao: 'FONE',           // usa o motor de regras FONE
      verComissaoDeTerceiros: false,
      exportar: false
    }
  }
};

/** Atalho global de leitura da matriz de permissões */
function getPermissoesDoPerfil(perfil) {
  return CONFIG.PERMISSOES[perfil] || null;
}
