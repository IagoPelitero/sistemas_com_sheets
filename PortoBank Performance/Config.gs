/**
 * ============================================================
 * PortoBank Performance — Config.gs
 * ------------------------------------------------------------
 * Constantes globais, nomes de planilhas, cargos, permissões
 * e parâmetros padrão do sistema (seed).
 *
 * Toda alteração estrutural deve ser feita AQUI, nunca
 * espalhada pelos módulos.
 * ============================================================
 */

/** Nome das abas (sheets) usadas como banco de dados. */
const SHEETS = {
  USERS: 'Users',
  SALES: 'Sales',
  RETENTION: 'Retention',
  GOALS: 'Goals',
  SETTINGS: 'Settings',
  PRODUCTS: 'Products',
  TEAMS: 'Teams',
  REPORTS: 'Reports',
  AUDIT: 'Audit'
};

/** Cabeçalhos oficiais de cada aba. NUNCA reordenar sem migração. */
const HEADERS = {
  [SHEETS.USERS]: ['id', 'nome', 'email', 'cargo', 'equipe', 'status', 'tema', 'criadoEm', 'atualizadoEm'],
  [SHEETS.SALES]: ['id', 'data', 'cpf', 'produto', 'quantidade', 'obs', 'userId', 'equipe', 'criadoEm'],
  [SHEETS.RETENTION]: ['id', 'data', 'cpf', 'produto', 'resultado', 'obs', 'userId', 'equipe', 'criadoEm'],
  [SHEETS.GOALS]: ['id', 'tipo', 'alvoId', 'metaVendas', 'metaComissao', 'metaRetencao', 'mes', 'atualizadoEm'],
  [SHEETS.SETTINGS]: ['chave', 'valor', 'descricao', 'atualizadoEm'],
  [SHEETS.PRODUCTS]: ['id', 'nome', 'categoria', 'comissaoUnitaria', 'ativo'],
  [SHEETS.TEAMS]: ['id', 'nome', 'supervisorId', 'tipo', 'ativo'],
  [SHEETS.REPORTS]: ['id', 'tipo', 'solicitante', 'parametros', 'status', 'criadoEm'],
  [SHEETS.AUDIT]: ['id', 'quando', 'quem', 'acao', 'detalhe']
};

/** Cargos oficiais do sistema (exatamente como especificado). */
const ROLES = {
  ADMIN: 'ADMIN',
  SUP_VENDAS: 'Supervisor de vendas',
  SUP_RET_FONE: 'Supervisor de retenção e vendas fone',
  SUP_RET_DIGITAL: 'Supervisor de vendas e retenção digital',
  AT_VENDAS: 'Atendente de vendas',
  AT_VENDAS_RET_FONE: 'Atendente de vendas e retenção fone',
  AT_RET_DIGITAL: 'Atendente de retenção e vendas digital'
};

const SUPERVISOR_ROLES = [ROLES.SUP_VENDAS, ROLES.SUP_RET_FONE, ROLES.SUP_RET_DIGITAL];
const ATTENDANT_ROLES = [ROLES.AT_VENDAS, ROLES.AT_VENDAS_RET_FONE, ROLES.AT_RET_DIGITAL];

/**
 * Mapa de permissões por cargo.
 * Cada chave "pages" define quais abas do menu o cargo enxerga.
 */
const PERMISSIONS = {
  [ROLES.ADMIN]: {
    pages: ['dashboard', 'novaVenda', 'novaRetencao', 'equipe', 'ranking', 'gestao', 'relatorios', 'cadastro', 'configuracoes'],
    scope: 'all', canManageUsers: true, canEditGoals: true, canEditSettings: true, canReports: true
  },
  [ROLES.SUP_VENDAS]: {
    pages: ['dashboard', 'novaVenda', 'equipe', 'ranking', 'gestao', 'relatorios'],
    scope: 'team', canManageUsers: true, canEditGoals: true, canEditSettings: false, canReports: true
  },
  [ROLES.SUP_RET_FONE]: {
    pages: ['dashboard', 'novaVenda', 'novaRetencao', 'equipe', 'ranking', 'gestao', 'relatorios'],
    scope: 'team', canManageUsers: true, canEditGoals: true, canEditSettings: false, canReports: true
  },
  [ROLES.SUP_RET_DIGITAL]: {
    pages: ['dashboard', 'novaVenda', 'novaRetencao', 'equipe', 'ranking', 'gestao', 'relatorios'],
    scope: 'team', canManageUsers: true, canEditGoals: true, canEditSettings: false, canReports: true
  },
  [ROLES.AT_VENDAS]: {
    pages: ['dashboard', 'novaVenda', 'equipe', 'ranking'],
    scope: 'self', canManageUsers: false, canEditGoals: false, canEditSettings: false, canReports: false
  },
  [ROLES.AT_VENDAS_RET_FONE]: {
    pages: ['dashboard', 'novaVenda', 'novaRetencao', 'equipe', 'ranking'],
    scope: 'self', canManageUsers: false, canEditGoals: false, canEditSettings: false, canReports: false
  },
  [ROLES.AT_RET_DIGITAL]: {
    pages: ['dashboard', 'novaVenda', 'novaRetencao', 'equipe', 'ranking'],
    scope: 'self', canManageUsers: false, canEditGoals: false, canEditSettings: false, canReports: false
  }
};

/** Produtos de retenção e seus resultados válidos. */
const RETENTION_PRODUCTS = {
  'Cartão de Crédito': ['Retido', 'Cancelado', 'Retido por Argumentação'],
  'Conta Digital': ['Retido', 'Cancelado'],
  'Cashback': ['Cashback', 'Milhas'],
  'Massificado': ['Retido', 'Cancelado']
};

/**
 * SEED de configurações de comissão.
 * Regras de Cartão de Crédito seguem exatamente a especificação.
 * Comissões globais (Conta Digital, Retenção Massificados,
 * Milhas→Cashback, Venda Massificados) usam valores padrão
 * EDITÁVEIS em Configurações — ajustar conforme o PDF oficial.
 */
const DEFAULT_SETTINGS = {
  // ---- Cartão de Crédito (FONE): faixas de % retidos → R$ ----
  'comissao.cartaoFone.tiers': JSON.stringify([
    { pct: 73, valor: 150 },
    { pct: 74, valor: 180 },
    { pct: 75, valor: 200 }
  ]),
  // ---- Bônus por Argumentação (FONE) ----
  'comissao.cartaoFone.bonusArg': JSON.stringify([
    { min: 35, max: 37, valor: 100 },
    { min: 38, max: 39, valor: 150 },
    { min: 40, max: 40, valor: 200 }
  ]),
  // ---- Bônus Premium (FONE) ----
  'comissao.cartaoFone.bonusPremium': JSON.stringify([
    { retidos: 76, argumentacao: 42, valor: 100 },
    { retidos: 78, argumentacao: 44, valor: 200 }
  ]),
  // ---- Cartão de Crédito (DIGITAL): pontos ----
  'comissao.cartaoDigital.pontoIncentivo': '0.5',
  'comissao.cartaoDigital.pontoArgumentacao': '1.5',
  'comissao.cartaoDigital.valorPonto': '10', // R$ por ponto — editável (ajustar conforme PDF)
  // ---- Comissões globais (valores padrão — ajustar conforme PDF) ----
  'comissao.global.contaDigital': '5',        // R$ por retenção de Conta Digital
  'comissao.global.retencaoMassificados': '8',// R$ por massificado retido
  'comissao.global.conversaoMilhasCashback': '3', // R$ por conversão Milhas → Cashback
  'comissao.global.vendaMassificados': '12',  // R$ por venda de massificado
  // ---- Metas padrão ----
  'meta.padrao.vendas': '50',
  'meta.padrao.comissao': '1500',
  'meta.padrao.retencao': '75',
  // ---- Sistema ----
  'sistema.nome': 'PortoBank Performance',
  'sistema.versao': '1.0.0'
};

/** Produtos massificados padrão (seed). */
const DEFAULT_PRODUCTS = [
  { nome: 'Residencial', categoria: 'Massificado' },
  { nome: 'Auto Leve', categoria: 'Massificado' },
  { nome: 'Vida', categoria: 'Massificado' },
  { nome: 'Pet', categoria: 'Massificado' },
  { nome: 'Odonto', categoria: 'Massificado' },
  { nome: 'Cartão Protegido', categoria: 'Massificado' }
];

/** Temas disponíveis. */
const THEMES = ['portobank', 'rosa', 'brasil', 'dark'];

/** TTL do cache em segundos. */
const CACHE_TTL = 300; // 5 minutos (invalidado automaticamente em toda escrita)
