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
  // motor: regra do Cartão de Crédito ('' = automático pelo cargo,
  // 'fone' ou 'digital') — definido SOMENTE pelo ADMIN
  [SHEETS.USERS]: ['id', 'nome', 'email', 'cargo', 'equipe', 'status', 'tema', 'motor', 'criadoEm', 'atualizadoEm'],
  [SHEETS.SALES]: ['id', 'data', 'cpf', 'produto', 'quantidade', 'obs', 'userId', 'equipe', 'criadoEm'],
  [SHEETS.RETENTION]: ['id', 'data', 'cpf', 'produto', 'resultado', 'obs', 'userId', 'equipe', 'criadoEm'],
  [SHEETS.GOALS]: ['id', 'tipo', 'alvoId', 'metaVendas', 'metaRetencaoCartao', 'metaRetencaoConta', 'mes', 'atualizadoEm'],
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
  'Cartão de Crédito': ['Retido por Incentivo', 'Retido por Argumentação', 'Cancelado'],
  'Conta Digital': ['Retido', 'Cancelado'],
  'Cashback': ['Cashback', 'Milhas'],
  'Massificado - Perda e Roubo': ['Retido por Argumentação', 'Retido por Incentivo', 'Cancelado'],
  'Massificado - Identidade Protegida': ['Retido por Argumentação', 'Retido por Incentivo', 'Cancelado'],
  'Massificado - Vida': ['Retido por Argumentação', 'Retido por Incentivo', 'Cancelado'],
  'Massificado - Martelinho': ['Retido por Argumentação', 'Retido por Incentivo', 'Cancelado'],
  'Massificado - RE': ['Retido por Argumentação', 'Retido por Incentivo', 'Cancelado']
};

/** Prefixo que identifica retenção de massificados. */
const MASSIFICADO_PREFIX = 'Massificado';

/**
 * Autonomia do atendente: quantos dos PRÓPRIOS lançamentos mais
 * recentes (vendas/retenções) ele pode excluir para corrigir erros.
 * Supervisor exclui qualquer lançamento da própria equipe; ADMIN, todos.
 */
const ENTRY_DELETE_LIMIT = 5;

/**
 * SEED de configurações de comissão.
 * Regras de Cartão de Crédito (FONE) seguem a especificação do sistema.
 * Demais regras seguem o PDF oficial "Programa de Remuneração
 * Variável" (vigência 01/01/2026) — tudo editável em Configurações.
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
  // ---- Cartão de Crédito (DIGITAL): valores DIRETOS ----
  // PDF 6.3.2: cada retenção por Argumentação vale R$1,50 e cada
  // retenção por Incentivo vale R$0,50 — sem conversão por pontos.
  'comissao.cartaoDigital.valorArgumentacao': '1.5',
  'comissao.cartaoDigital.valorIncentivo': '0.5',
  // ---- Cashback (PDF 6.3.2): prêmio fixo por faixa de conversão ----
  'comissao.cashback.faixas': JSON.stringify([
    { pct: 36, valor: 50 },
    { pct: 39, valor: 70 },
    { pct: 42, valor: 100 },
    { pct: 45, valor: 130 }
  ]),
  // ---- Teto de R$530: SOMENTE retenção de Cartão de Crédito
  //      do perfil DIGITAL (pontos arg+inc). Demais produtos e
  //      o fone ficam fora do teto ----
  'comissao.retencao.teto': '530',
  // ---- Volume mínimo de casos no mês para prêmios por FAIXA
  //      (fone/conta/cashback). Evita distorção de 1 caso = 100%
  //      = prêmio máximo. 0 = desativado ----
  'comissao.faixas.minimoCasos': '0',
  // ---- Conta Digital (PDF 6.6): prêmio fixo por % de retenção ----
  'comissao.contaDigital.faixas': JSON.stringify([
    { pct: 30, valor: 100 },
    { pct: 50, valor: 150 },
    { pct: 75, valor: 200 }
  ]),
  'comissao.contaDigital.bonus': JSON.stringify([
    { pct: 76, valor: 100 },
    { pct: 78, valor: 150 }
  ]),
  // ---- Vendas coletivas (PDF 6.3.1): R$/venda por faixa de
  //      atingimento da meta coletiva do mês.
  //      Faixas: [até 60% | 60–79,99% | 80–100% | acima de 100%]
  //      Sem teto de pagamento. ----
  'comissao.vendas.tabela': JSON.stringify({
    'Seguro Perda e Roubo':   [2.00, 2.50, 3.00, 4.00],
    'Adicional':              [1.00, 1.50, 2.00, 3.00],
    'Seguro Vida':            [1.00, 1.50, 2.00, 3.00],
    'Identidade Protegida':   [1.00, 1.50, 2.00, 3.00],
    'Seguro RE':              [1.00, 1.50, 2.00, 3.00],
    'Martelinho de Ouro':     [3.00, 3.50, 4.00, 5.00],
    'Guincho':                [3.00, 3.50, 4.00, 5.00],
    'Quitação fatura':        [2.00, 2.50, 3.00, 4.00]
  }),
  // ---- Retenção de Massificados (PDF 6.5): R$/retido por faixa
  //      de conversão, separado por Argumentação e Incentivo ----
  'comissao.massificados.faixasArg': JSON.stringify([15, 30, 50, 60]),
  'comissao.massificados.faixasInc': JSON.stringify([60, 65, 70, 75]),
  'comissao.massificados.arg': JSON.stringify({
    'Perda e Roubo':        [1.50, 2.00, 2.50, 3.00],
    'Identidade Protegida': [1.50, 2.00, 2.50, 3.00],
    'Vida':                 [1.50, 2.00, 2.50, 3.00],
    'Martelinho':           [1.00, 1.50, 2.00, 2.50],
    'RE':                   [1.00, 1.50, 2.00, 2.50]
  }),
  'comissao.massificados.inc': JSON.stringify({
    'Perda e Roubo':        [1.00, 1.25, 1.50, 2.00],
    'Identidade Protegida': [1.00, 1.25, 1.50, 2.00],
    'Vida':                 [1.00, 1.25, 1.50, 2.00],
    'RE':                   [1.00, 1.10, 1.25, 1.50],
    'Martelinho':           [1.00, 1.10, 1.20, 1.30]
  }),
  // ---- Metas padrão (vendas em QUANTIDADE; retenção em % POR PRODUTO) ----
  'meta.padrao.vendas': '50',
  'meta.padrao.retencaoCartao': '75',
  'meta.padrao.retencaoConta': '75',
  // ---- Sistema ----
  'sistema.nome': 'PortoBank Performance',
  'sistema.versao': '1.6.0'
};

/**
 * Produtos padrão (seed) — mix do PDF 6.3.1 + indicadores 
 * de valor fixo (CPCP e Upgrades).
 * Produtos da tabela de vendas coletivas têm o valor resolvido
 * pela faixa de atingimento; indicadores usam comissaoUnitaria.
 */
const DEFAULT_PRODUCTS = [
  { nome: 'Seguro Perda e Roubo', categoria: 'Massificado' },
  { nome: 'Adicional', categoria: 'Massificado' },
  { nome: 'Seguro Vida', categoria: 'Massificado' },
  { nome: 'Identidade Protegida', categoria: 'Massificado' },
  { nome: 'Seguro RE', categoria: 'Massificado' },
  { nome: 'Martelinho de Ouro', categoria: 'Massificado' },
  { nome: 'Guincho', categoria: 'Massificado' },
  { nome: 'Quitação fatura', categoria: 'Massificado' },
  // Indicadores de valor fixo (PDF):
  // CPCP pago somente com proposta formalizada após contato + envio do link.
  { nome: 'CPCP', categoria: 'Indicador', comissaoUnitaria: 30 },
  { nome: 'Upgrade Platinum', categoria: 'Indicador', comissaoUnitaria: 2 },
  { nome: 'Upgrade Black/Infinite', categoria: 'Indicador', comissaoUnitaria: 4 }
];

/** Temas disponíveis. */
const THEMES = ['portobank', 'rosa', 'brasil', 'dark'];

/** TTL do cache em segundos. */
const CACHE_TTL = 300; // 5 minutos (invalidado automaticamente em toda escrita)
