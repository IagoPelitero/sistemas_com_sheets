/**
 * ============================================================
 * PortoBank Performance — Utils.gs
 * ------------------------------------------------------------
 * Funções utilitárias + camada de acesso a dados (DB).
 * TODO acesso à planilha passa por aqui — os demais módulos
 * nunca chamam SpreadsheetApp diretamente para CRUD.
 * ============================================================
 */

/** Retorna a planilha ativa (banco de dados). */
function getDb_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Garante que a aba exista com os cabeçalhos corretos.
 * @param {string} name Nome da aba (ver SHEETS).
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function ensureSheet_(name) {
  const db = getDb_();
  let sheet = db.getSheetByName(name);
  if (!sheet) {
    sheet = db.insertSheet(name);
    sheet.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Gera um ID único usando SOMENTE caracteres hexadecimais (0-9, a-f):
 * 12 dígitos hex aleatórios do UUID + timestamp em hexadecimal.
 * Ex.: "3fa8c21b9de40197f4a2c8e1"
 */
function uid_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12) + Date.now().toString(16);
}

/** Data/hora atual em ISO. */
function nowIso_() {
  return new Date().toISOString();
}

/**
 * Lê TODAS as linhas de uma aba como objetos — com cache.
 * Esta é a ÚNICA função de leitura em massa do sistema.
 * @param {string} sheetName
 * @return {Object[]} linhas como objetos {header: valor}
 */
function readAll_(sheetName) {
  const cached = cacheGet_(sheetName);
  if (cached) return cached;

  const sheet = ensureSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { cachePut_(sheetName, []); return []; }

  const headers = HEADERS[sheetName];
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const rows = values.map(function (r) {
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = r[i]; });
    return obj;
  });
  cachePut_(sheetName, rows);
  return rows;
}

/**
 * Acrescenta uma linha (objeto) a uma aba, com Lock e
 * invalidação de cache.
 * @param {string} sheetName
 * @param {Object} obj
 */
function appendRow_(sheetName, obj) {
  withLock_(function () {
    const sheet = ensureSheet_(sheetName);
    const row = HEADERS[sheetName].map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
    sheet.appendRow(row);
  });
  cacheInvalidate_(sheetName);
}

/**
 * Atualiza a linha cujo campo `id` corresponda.
 * @param {string} sheetName
 * @param {string} id
 * @param {Object} patch Campos a alterar.
 * @return {boolean} true se encontrou e atualizou.
 */
function updateRowById_(sheetName, id, patch) {
  let updated = false;
  withLock_(function () {
    const sheet = ensureSheet_(sheetName);
    const headers = HEADERS[sheetName];
    const idCol = headers.indexOf('id') + 1;
    const rowIndex = findRowIndexById_(sheet, idCol, id);
    if (rowIndex === -1) return;
    const range = sheet.getRange(rowIndex, 1, 1, headers.length);
    const current = range.getValues()[0];
    headers.forEach(function (h, i) {
      if (patch[h] !== undefined) current[i] = patch[h];
    });
    range.setValues([current]);
    updated = true;
  });
  if (updated) cacheInvalidate_(sheetName);
  return updated;
}

/**
 * EXCLUI DEFINITIVAMENTE a linha (deleteRow) — sem soft delete,
 * sem lixo de dados.
 * @param {string} sheetName
 * @param {string} id
 * @return {boolean}
 */
function deleteRowById_(sheetName, id) {
  let deleted = false;
  withLock_(function () {
    const sheet = ensureSheet_(sheetName);
    const idCol = HEADERS[sheetName].indexOf('id') + 1;
    const rowIndex = findRowIndexById_(sheet, idCol, id);
    if (rowIndex === -1) return;
    sheet.deleteRow(rowIndex);
    deleted = true;
  });
  if (deleted) cacheInvalidate_(sheetName);
  return deleted;
}

/**
 * Localiza o índice (1-based) da linha pelo id usando busca
 * apenas na coluna de id (leitura mínima, sem varrer a planilha).
 */
function findRowIndexById_(sheet, idCol, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

/**
 * Executa uma função com LockService (evita corrida em escrita
 * concorrente — preparado para centenas de usuários).
 */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000); // até 20s
  try { return fn(); } finally { lock.releaseLock(); }
}

/** Registra evento de auditoria (best-effort, não bloqueia). */
function audit_(quem, acao, detalhe) {
  try {
    appendRow_(SHEETS.AUDIT, {
      id: uid_(), quando: nowIso_(), quem: quem, acao: acao, detalhe: detalhe || ''
    });
  } catch (e) { /* auditoria nunca derruba a operação principal */ }
}

/** Normaliza data (Date|string) para 'yyyy-MM-dd'. */
function toDateKey_(v) {
  const d = (v instanceof Date) ? v : new Date(v);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

/** Data no padrão brasileiro 'dd/MM/yyyy' (fuso do projeto). */
function toDateBR_(v) {
  const str = String(v);
  // 'yyyy-MM-dd' puro: formata direto, sem criar Date (evita
  // deslocamento de fuso que faria o dia voltar/avançar)
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  const d = (v instanceof Date) ? v : new Date(v);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}

/** Chave de mês 'yyyy-MM'. */
function toMonthKey_(v) {
  return toDateKey_(v).slice(0, 7);
}

/** Percentual seguro (evita divisão por zero). */
function pct_(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

/** Valida CPF (apenas formato: 11 dígitos). */
function isValidCpf_(cpf) {
  return /^\d{11}$/.test(String(cpf).replace(/\D/g, ''));
}
