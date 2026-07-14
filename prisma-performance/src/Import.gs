/**
 * ============================================================
 * Prisma Performance — Import.gs
 * ------------------------------------------------------------
 * Importação dos SISTEMAS ANTIGOS (SOMENTE ADMIN):
 *  - Vendas   → planilha antiga, aba "vendas_ativas"
 *               [Data, Produto, Protocolo, Email, Equipe, Quantidade]
 *  - Retenção → planilha antiga, aba "Dados"
 *               [Data, Email, Nome, Supervisor, Tipo, SubProduto,
 *                Resultado, Status]
 *
 * Garantias:
 *  - VALIDAÇÃO antes de gravar: data, usuário (por e-mail, precisa
 *    existir na aba Users) e produto/resultado mapeados; linhas
 *    inválidas são PULADAS e contadas por motivo — nada é gravado
 *    pela metade.
 *  - IDEMPOTENTE: cada linha importada carrega a etiqueta
 *    [import:<arquivo>:<linha>] no campo obs; reimportar a mesma
 *    planilha pula o que já entrou (zero duplicatas).
 *  - RECÁLCULO automático: como nada derivado é gravado, dashboards,
 *    ranking, metas e comissões passam a considerar os dados
 *    importados imediatamente (cache invalidado em lote).
 *  - REUTILIZÁVEL: novas importações são só uma nova entrada no
 *    mapa LEGACY_SOURCES_, sem mudança estrutural.
 * ============================================================
 */

/** Aba padrão de cada sistema antigo (pode ser sobrescrita no payload). */
const LEGACY_SOURCES_ = {
  vendas: { aba: 'vendas_ativas' },
  retencao: { aba: 'Dados' }
};

/** Massificados do sistema antigo → produtos de retenção atuais. */
const LEGACY_MASSIFICADO_MAP_ = {
  'sppr / bolsa protegida': 'Perda e Roubo',
  'identidade protegida': 'Identidade Protegida',
  'seguro re': 'RE',
  'martelinho de ouro': 'Martelinho',
  'vida': 'Vida',
  'seguro vida': 'Vida'
};

/**
 * Ponto de entrada da importação (SOMENTE ADMIN).
 * @param {Object} me
 * @param {Object} payload {tipo: 'vendas'|'retencao', url, aba?}
 * @return {Object} {importados, jaImportados, pulados, motivos{}, total}
 */
function importLegacy_(me, payload) {
  if (!isAdmin_(me)) throw new Error('Somente o ADMIN pode importar dados.');
  const fonte = LEGACY_SOURCES_[payload.tipo];
  if (!fonte) throw new Error("Tipo de importação inválido. Use 'vendas' ou 'retencao'.");

  const fileId = legacySheetId_(payload.url);
  let origem;
  try { origem = SpreadsheetApp.openById(fileId); }
  catch (e) { throw new Error('Não foi possível abrir a planilha antiga. Confira o link e se você tem acesso a ela.'); }

  const abaNome = String(payload.aba || fonte.aba).trim();
  const aba = origem.getSheetByName(abaNome);
  if (!aba) throw new Error('A aba "' + abaNome + '" não existe na planilha informada.');
  if (aba.getLastRow() < 2) return { importados: 0, jaImportados: 0, pulados: 0, motivos: {}, total: 0 };

  const valores = aba.getDataRange().getValues();
  const destino = payload.tipo === 'vendas' ? SHEETS.SALES : SHEETS.RETENTION;

  // Usuários por e-mail (para vincular cada registro antigo)
  const usersByEmail = {};
  readAll_(SHEETS.USERS).forEach(function (u) {
    usersByEmail[String(u.email).toLowerCase().trim()] = u;
  });

  // Etiquetas já importadas deste arquivo (idempotência)
  const tagPrefix = '[import:' + fileId + ':';
  const jaImportadas = {};
  readAll_(destino).forEach(function (r) {
    const m = String(r.obs || '').match(/\[import:[^\]]+\]/);
    if (m) jaImportadas[m[0]] = true;
  });

  const novos = [];
  const motivos = {};
  let jaImportados = 0;
  const pular = function (motivo) { motivos[motivo] = (motivos[motivo] || 0) + 1; };

  // Começa em 1 (linha 2 da planilha: pula o cabeçalho)
  for (let i = 1; i < valores.length; i++) {
    const linha = valores[i];
    const tag = tagPrefix + (i + 1) + ']';
    if (jaImportadas[tag]) { jaImportados++; continue; }

    const reg = payload.tipo === 'vendas'
      ? legacyVendaParse_(linha, usersByEmail, pular)
      : legacyRetencaoParse_(linha, usersByEmail, pular);
    if (!reg) continue;

    reg.id = uid_();
    reg.criadoEm = nowIso_();
    reg.obs = (reg.obs ? reg.obs + ' ' : '') + tag;
    novos.push(reg);
  }

  appendRows_(destino, novos);
  const pulados = Object.keys(motivos).reduce(function (a, k) { return a + motivos[k]; }, 0);
  audit_(me.email, 'IMPORT', payload.tipo + ': ' + novos.length + ' importado(s), ' +
    jaImportados + ' já existia(m), ' + pulados + ' pulado(s) — arquivo ' + fileId);

  return {
    importados: novos.length,
    jaImportados: jaImportados,
    pulados: pulados,
    motivos: motivos,
    total: valores.length - 1
  };
}

/** Extrai o ID do arquivo de uma URL do Google Sheets (ou aceita o ID puro). */
function legacySheetId_(url) {
  const s = String(url || '').trim();
  if (!s) throw new Error('Informe o link (URL) da planilha antiga.');
  const m = s.match(/\/d\/([-\w]{25,})/) || s.match(/^([-\w]{25,})$/);
  if (!m) throw new Error('Link inválido: cole a URL completa da planilha antiga.');
  return m[1];
}

/** Data legada (Date, dd/MM/yyyy ou yyyy-MM-dd) → 'yyyy-MM-dd' ou null. */
function legacyDateKey_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return toDateKey_(v);
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return br[3] + '-' + ('0' + br[2]).slice(-2) + '-' + ('0' + br[1]).slice(-2);
  return null;
}

/**
 * Linha do sistema antigo de VENDAS → registro de Sales.
 * [0]Data [1]Produto [2]Protocolo [3]Email [4]Equipe [5]Quantidade
 */
function legacyVendaParse_(linha, usersByEmail, pular) {
  const data = legacyDateKey_(linha[0]);
  if (!data) { pular('data inválida'); return null; }

  const user = usersByEmail[String(linha[3] || '').toLowerCase().trim()];
  if (!user) { pular('e-mail não cadastrado no sistema novo'); return null; }

  const produto = String(linha[1] || '').trim();
  if (!produto) { pular('produto vazio'); return null; }

  const qtd = parseInt(linha[5], 10);
  if (!qtd || qtd < 1) { pular('quantidade inválida'); return null; }

  const protocolo = String(linha[2] || '').trim();
  return {
    data: data, cpf: '', produto: produto, quantidade: qtd,
    obs: protocolo ? 'Protocolo antigo: ' + protocolo : '',
    userId: user.id, equipe: user.equipe
  };
}

/**
 * Linha do sistema antigo de RETENÇÃO → registro de Retention.
 * [0]Data [1]Email [2]Nome [3]Supervisor [4]Tipo [5]SubProduto [6]Resultado
 */
function legacyRetencaoParse_(linha, usersByEmail, pular) {
  const data = legacyDateKey_(linha[0]);
  if (!data) { pular('data inválida'); return null; }

  const user = usersByEmail[String(linha[1] || '').toLowerCase().trim()];
  if (!user) { pular('e-mail não cadastrado no sistema novo'); return null; }

  const tipo = String(linha[4] || '').trim();
  const sub = String(linha[5] || '').trim();
  const res = String(linha[6] || '').trim();
  const mapa = legacyRetencaoMap_(tipo, sub, res);
  if (!mapa) { pular('sem correspondência: ' + (tipo || '(vazio)') + (sub && sub !== '-' ? ' / ' + sub : '')); return null; }

  return {
    data: data, cpf: '', produto: mapa.produto, resultado: mapa.resultado,
    obs: '', userId: user.id, equipe: user.equipe
  };
}

/** Vocabulário antigo (Tipo/SubProduto/Resultado) → produto/resultado atuais. */
function legacyRetencaoMap_(tipo, sub, res) {
  const r = res.toLowerCase();

  if (tipo === 'Cartão de Crédito') {
    if (r.indexOf('argumenta') !== -1) return { produto: 'Cartão de Crédito', resultado: 'Retido por Argumentação' };
    if (r.indexOf('retido') !== -1) return { produto: 'Cartão de Crédito', resultado: 'Retido por Incentivo' };
    if (r.indexOf('cancel') !== -1) return { produto: 'Cartão de Crédito', resultado: 'Cancelado' };
    return null;
  }
  if (tipo === 'Conta Digital') {
    if (r.indexOf('retido') !== -1) return { produto: 'Conta Digital', resultado: 'Retido' };
    if (r.indexOf('cancel') !== -1) return { produto: 'Conta Digital', resultado: 'Cancelado' };
    return null;
  }
  if (tipo === 'Troca de Pontos') {
    if (r.indexOf('cashback') !== -1) return { produto: 'Cashback', resultado: 'Cashback' };
    if (r.indexOf('milhas') !== -1) return { produto: 'Cashback', resultado: 'Milhas' };
    return null;
  }
  if (tipo === 'Massificado') {
    const nome = LEGACY_MASSIFICADO_MAP_[sub.toLowerCase()];
    if (!nome) return null; // massificado sem correspondência no sistema novo
    const produto = MASSIFICADO_PREFIX + ' - ' + nome;
    if (r.indexOf('argumenta') !== -1) return { produto: produto, resultado: 'Retido por Argumentação' };
    if (r.indexOf('troca') !== -1 || r.indexOf('incentivo') !== -1) return { produto: produto, resultado: 'Retido por Incentivo' };
    if (r.indexOf('cancel') !== -1) return { produto: produto, resultado: 'Cancelado' };
    return null;
  }
  return null;
}
