/**
 * ============================================================
 * Prisma Performance — Maintenance.gs
 * ------------------------------------------------------------
 * Rotação da aba Audit: a cada 30 dias, os registros antigos
 * são movidos para uma NOVA planilha de arquivo (nada é
 * perdido) e a aba principal fica enxuta — evitando que o
 * crescimento contínuo da auditoria pese no Sheets.
 *
 * INSTALAÇÃO (uma única vez, pelo dono do projeto):
 *   No editor do Apps Script, execute a função
 *   auditRotationInstall() e autorize. Isso cria um gatilho
 *   que roda auditRotateJob() a cada 30 dias.
 *
 * O ADMIN também pode arquivar manualmente pelo sistema
 * (Configurações → Auditoria → "Arquivar agora").
 * ============================================================
 */

/** Dias de auditoria mantidos na planilha principal. */
const AUDIT_KEEP_DAYS = 30;

/**
 * Instala o gatilho de rotação (executar UMA vez no editor).
 * Remove gatilhos duplicados antes de criar.
 */
function auditRotationInstall() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'auditRotateJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('auditRotateJob').timeBased().everyDays(30).create();
}

/** Função chamada pelo gatilho de 30 dias. */
function auditRotateJob() {
  auditRotateNow_();
}

/**
 * Move registros de auditoria com mais de AUDIT_KEEP_DAYS para
 * uma nova planilha de arquivo. Executa sob lock; nunca perde
 * dados: primeiro grava no arquivo, só depois limpa a principal.
 * @return {Object} {linhas, url, nome} do arquivo gerado
 */
function auditRotateNow_() {
  return withLock_(function () {
    const sheet = ensureSheet_(SHEETS.AUDIT);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return { linhas: 0, url: '', nome: '' };

    const header = values[0];
    const cutoff = Date.now() - AUDIT_KEEP_DAYS * 24 * 60 * 60 * 1000;
    const old = [], recent = [];
    for (let i = 1; i < values.length; i++) {
      const quando = new Date(values[i][1]).getTime(); // coluna 'quando'
      (isNaN(quando) || quando < cutoff ? old : recent).push(values[i]);
    }
    if (!old.length) return { linhas: 0, url: '', nome: '' };

    // 1) Grava PRIMEIRO no arquivo novo (garantia contra perda)
    const nome = 'Prisma Performance — Audit ' +
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const arquivo = SpreadsheetApp.create(nome);
    const abaArq = arquivo.getSheets()[0].setName(SHEETS.AUDIT);
    abaArq.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    abaArq.getRange(2, 1, old.length, header.length).setValues(old);
    abaArq.setFrozenRows(1);

    // 2) Só então reescreve a aba principal com os registros recentes
    sheet.clearContents();
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    if (recent.length) sheet.getRange(2, 1, recent.length, header.length).setValues(recent);
    sheet.setFrozenRows(1);
    cacheInvalidate_(SHEETS.AUDIT);

    // 3) Registra a rotação (na auditoria e nas propriedades)
    const info = {
      quando: nowIso_(), linhas: old.length,
      url: arquivo.getUrl(), nome: nome
    };
    PropertiesService.getScriptProperties()
      .setProperty('audit.ultimaRotacao', JSON.stringify(info));
    audit_('sistema', 'AUDIT_ROTATE', old.length + ' registros arquivados em: ' + nome);

    return { linhas: old.length, url: info.url, nome: nome };
  });
}

/**
 * ------------------------------------------------------------
 * MIGRAÇÃO / SINCRONIZAÇÃO DE DADOS
 * ------------------------------------------------------------
 * Comissões, percentuais e indicadores NUNCA são gravados na
 * planilha: são recalculados a cada leitura a partir dos
 * registros brutos. Por isso, mudanças de regra (Configurações)
 * se aplicam retroativamente e de forma automática a todos os
 * dados existentes — sem necessidade de migração.
 *
 * Migração só é necessária quando muda o VOCABULÁRIO dos
 * registros brutos. Cada passo roda UMA única vez (marcado em
 * ScriptProperties) e é verificado de forma barata via
 * CacheService a cada sessão.
 */
/** Passos de migração — cada um roda UMA única vez, em ordem. */
const MIGRATIONS_ = [
  { flag: 'migracao.retidoIncentivo.v1', run: function () { migrateRetidoIncentivo_(); } },
  { flag: 'migracao.digitalDireto.v1', run: function () { migrateDigitalDireto_(); } },
  { flag: 'migracao.rebrandPrisma.v1', run: function () { migrateRebrandPrisma_(); } },
  { flag: 'migracao.nomenclaturaProdutos.v1', run: function () { migrateNomenclaturaProdutos_(); } }
];
const MIGRATION_CACHE_FLAG_ = 'migracao.verificada.v4';

/** Verificação barata (cache) + execução única das migrações. */
function migrationEnsure_() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get(MIGRATION_CACHE_FLAG_)) return;           // já verificado nesta janela
    const props = PropertiesService.getScriptProperties();
    MIGRATIONS_.forEach(function (m) {
      if (!props.getProperty(m.flag)) {
        m.run();
        props.setProperty(m.flag, nowIso_());
      }
    });
    cache.put(MIGRATION_CACHE_FLAG_, '1', 21600); // não reverificar por 6h
  } catch (e) { /* migração nunca derruba a operação */ }
}

/**
 * Sincroniza registros antigos com a nomenclatura atual:
 * Cartão de Crédito com resultado 'Retido' (legado) passa a
 * 'Retido por Incentivo'. Conta Digital NÃO é alterada
 * ('Retido' lá é retenção geral).
 */
function migrateRetidoIncentivo_() {
  withLock_(function () {
    const sheet = ensureSheet_(SHEETS.RETENTION);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const headers = headersOf_(sheet, SHEETS.RETENTION);
    const cProd = headers.indexOf('produto') + 1;
    const cRes = headers.indexOf('resultado') + 1;
    if (!cProd || !cRes) return;
    const prods = sheet.getRange(2, cProd, lastRow - 1, 1).getValues();
    const resRange = sheet.getRange(2, cRes, lastRow - 1, 1);
    const res = resRange.getValues();
    let mudou = 0;
    for (let i = 0; i < res.length; i++) {
      if (String(prods[i][0]) === 'Cartão de Crédito' && String(res[i][0]) === 'Retido') {
        res[i][0] = 'Retido por Incentivo'; mudou++;
      }
    }
    if (mudou) {
      resRange.setValues(res);
      cacheInvalidate_(SHEETS.RETENTION);
      audit_('sistema', 'MIGRACAO', mudou + " registro(s) de Cartão: 'Retido' → 'Retido por Incentivo'");
    }
  });
}

/**
 * Migra a comissão do Cartão DIGITAL de "pontos" para valores
 * financeiros DIRETOS (R$1,50/argumentação, R$0,50/incentivo):
 * remove as chaves antigas de pontos da aba Settings e insere as
 * novas chaves de valor direto, preservando tudo o mais.
 */
function migrateDigitalDireto_() {
  const oldKeys = [
    'comissao.cartaoDigital.pontoIncentivo',
    'comissao.cartaoDigital.pontoArgumentacao',
    'comissao.cartaoDigital.valorPonto'
  ];
  let removidas = 0;
  withLock_(function () {
    const sheet = ensureSheet_(SHEETS.SETTINGS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = keys.length - 1; i >= 0; i--) { // de baixo para cima (índices estáveis)
      if (oldKeys.indexOf(String(keys[i][0])) !== -1) {
        sheet.deleteRow(i + 2);
        removidas++;
      }
    }
  });
  cacheInvalidate_(SHEETS.SETTINGS);

  // Insere as novas chaves (se ausentes) para aparecerem em Configurações
  ['comissao.cartaoDigital.valorArgumentacao', 'comissao.cartaoDigital.valorIncentivo'].forEach(function (k) {
    const exists = readAll_(SHEETS.SETTINGS).some(function (r) { return String(r.chave) === k; });
    if (!exists) {
      appendRow_(SHEETS.SETTINGS, {
        chave: k, valor: DEFAULT_SETTINGS[k],
        descricao: settingDescription_(k), atualizadoEm: nowIso_()
      });
    }
  });
  if (removidas) {
    audit_('sistema', 'MIGRACAO', 'Cartão digital: pontos → valores diretos (' + removidas + ' chave(s) antiga(s) removida(s))');
  }
}

/**
 * REBRANDING (v2.0.0): atualiza dados gravados com a identidade
 * antiga para a atual — tema padrão dos usuários ('portobank' →
 * 'prisma') e o nome do sistema na aba Settings. Registros de
 * negócio (vendas, retenções, metas) não são tocados.
 */
function migrateRebrandPrisma_() {
  // Tema dos usuários
  let mudou = 0;
  withLock_(function () {
    const sheet = ensureSheet_(SHEETS.USERS);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const headers = headersOf_(sheet, SHEETS.USERS);
    const cTema = headers.indexOf('tema') + 1;
    if (!cTema) return;
    const range = sheet.getRange(2, cTema, lastRow - 1, 1);
    const temas = range.getValues();
    for (let i = 0; i < temas.length; i++) {
      if (String(temas[i][0]) === 'portobank') { temas[i][0] = 'prisma'; mudou++; }
    }
    if (mudou) range.setValues(temas);
  });
  if (mudou) cacheInvalidate_(SHEETS.USERS);

  // Nome do sistema em Settings
  const nomeRow = readAll_(SHEETS.SETTINGS).find(function (r) { return String(r.chave) === 'sistema.nome'; });
  if (nomeRow && String(nomeRow.valor) !== 'Prisma Performance') {
    withLock_(function () {
      const sheet = ensureSheet_(SHEETS.SETTINGS);
      const lastRow = sheet.getLastRow();
      const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = 0; i < keys.length; i++) {
        if (String(keys[i][0]) === 'sistema.nome') {
          sheet.getRange(i + 2, 2).setValue('Prisma Performance');
          sheet.getRange(i + 2, 4).setValue(nowIso_());
          break;
        }
      }
    });
    cacheInvalidate_(SHEETS.SETTINGS);
  }
  audit_('sistema', 'MIGRACAO', 'Rebranding: ' + mudou + ' tema(s) de usuário e nome do sistema atualizados para Prisma Performance');
}

/**
 * NOMENCLATURA DE PRODUTOS (v2.1.0): renomeia nos DADOS gravados
 * os produtos de retenção que mudaram de nome e ajusta as tabelas
 * de comissão salvas em Settings:
 *   Cashback           → Troca de Pontos
 *   Massificado - Vida → Massificado - Vida - Acidentes Pessoais Plus
 *   Massificado - RE   → Massificado - RE - Residencial Premiado
 * Nas tabelas comissao.massificados.arg/inc as chaves 'Vida' e 'RE'
 * são renomeadas PRESERVANDO os valores editados pelo ADMIN; a
 * entrada 'Perda e Roubo' sai da tabela de Incentivo (SPPR não
 * possui mais essa modalidade). Nada é apagado dos lançamentos.
 */
function migrateNomenclaturaProdutos_() {
  const renameProduto = {
    'Cashback': 'Troca de Pontos',
    'Massificado - Vida': 'Massificado - Vida - Acidentes Pessoais Plus',
    'Massificado - RE': 'Massificado - RE - Residencial Premiado'
  };

  // 1) Registros da aba Retention
  let mudou = 0;
  withLock_(function () {
    const sheet = ensureSheet_(SHEETS.RETENTION);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    const headers = headersOf_(sheet, SHEETS.RETENTION);
    const cProd = headers.indexOf('produto') + 1;
    if (!cProd) return;
    const range = sheet.getRange(2, cProd, lastRow - 1, 1);
    const prods = range.getValues();
    for (let i = 0; i < prods.length; i++) {
      const novo = renameProduto[String(prods[i][0])];
      if (novo) { prods[i][0] = novo; mudou++; }
    }
    if (mudou) range.setValues(prods);
  });
  if (mudou) cacheInvalidate_(SHEETS.RETENTION);

  // 2) Tabelas de comissão em Settings (preserva valores editados)
  const renameChave = { 'Vida': 'Vida - Acidentes Pessoais Plus', 'RE': 'RE - Residencial Premiado' };
  ['comissao.massificados.arg', 'comissao.massificados.inc'].forEach(function (key) {
    const row = readAll_(SHEETS.SETTINGS).find(function (r) { return String(r.chave) === key; });
    if (!row) return; // instalação nova: o seed já vem correto
    let tab;
    try { tab = JSON.parse(row.valor); } catch (e) { return; } // malformado: seed cobre via fallback
    let alterou = false;
    Object.keys(renameChave).forEach(function (antigo) {
      if (tab[antigo] !== undefined && tab[renameChave[antigo]] === undefined) {
        tab[renameChave[antigo]] = tab[antigo];
        delete tab[antigo];
        alterou = true;
      }
    });
    if (key === 'comissao.massificados.inc' && tab['Perda e Roubo'] !== undefined) {
      delete tab['Perda e Roubo']; // SPPR sem incentivo
      alterou = true;
    }
    if (alterou) {
      withLock_(function () {
        const sheet = ensureSheet_(SHEETS.SETTINGS);
        const lastRow = sheet.getLastRow();
        const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < keys.length; i++) {
          if (String(keys[i][0]) === key) {
            sheet.getRange(i + 2, 2).setValue(JSON.stringify(tab));
            sheet.getRange(i + 2, 4).setValue(nowIso_());
            break;
          }
        }
      });
      cacheInvalidate_(SHEETS.SETTINGS);
    }
  });

  audit_('sistema', 'MIGRACAO', 'Nomenclatura de produtos: ' + mudou +
    ' registro(s) renomeado(s) (Troca de Pontos / Vida APP / RE Premiado); SPPR sem Incentivo nas tabelas');
}

/**
 * Situação atual da auditoria (para o painel do ADMIN).
 * @return {Object} {linhasAtuais, manterDias, ultimaRotacao|null}
 */
function auditStatus_() {
  const linhas = Math.max(0, ensureSheet_(SHEETS.AUDIT).getLastRow() - 1);
  const raw = PropertiesService.getScriptProperties().getProperty('audit.ultimaRotacao');
  let ultima = null;
  try { ultima = raw ? JSON.parse(raw) : null; } catch (e) { /* ignora */ }
  return { linhasAtuais: linhas, manterDias: AUDIT_KEEP_DAYS, ultimaRotacao: ultima };
}
