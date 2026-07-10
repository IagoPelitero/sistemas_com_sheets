/**
 * ============================================================
 * PortoBank Performance — Maintenance.gs
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
    const nome = 'PortoBank Performance — Audit ' +
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
const MIGRATION_FLAG_ = 'migracao.retidoIncentivo.v1';

/** Verificação barata (cache) + execução única da migração. */
function migrationEnsure_() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get(MIGRATION_FLAG_)) return;                 // já verificado nesta janela
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty(MIGRATION_FLAG_)) {
      migrateRetidoIncentivo_();
      props.setProperty(MIGRATION_FLAG_, nowIso_());
    }
    cache.put(MIGRATION_FLAG_, '1', 21600); // não reverificar por 6h
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
