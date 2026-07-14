/**
 * ============================================================
 * Prisma Performance — Cache.gs
 * ------------------------------------------------------------
 * Cache inteligente sobre CacheService.
 *
 * Estratégia:
 *  - Leituras sempre tentam o cache primeiro (readAll_).
 *  - Toda escrita invalida SOMENTE o cache da aba alterada.
 *  - Valores grandes são divididos em chunks de 90KB
 *    (limite do CacheService é 100KB por chave).
 *  - Um "version token" por aba permite invalidação O(1).
 * ============================================================
 */

const CACHE_PREFIX = 'pbp:';
const CHUNK_SIZE = 90 * 1024; // 90KB por chunk

/** Cache do script (compartilhado entre todos os usuários). */
function cache_() {
  return CacheService.getScriptCache();
}

/** Versão atual do cache de uma aba (muda a cada escrita). */
function cacheVersion_(sheetName) {
  const key = CACHE_PREFIX + 'v:' + sheetName;
  let v = cache_().get(key);
  if (!v) {
    v = String(Date.now());
    cache_().put(key, v, 21600); // 6h
  }
  return v;
}

/**
 * Recupera dados da aba do cache (ou null se ausente/expirado).
 * @param {string} sheetName
 * @return {Object[]|null}
 */
function cacheGet_(sheetName) {
  const c = cache_();
  const base = CACHE_PREFIX + cacheVersion_(sheetName) + ':' + sheetName;
  const meta = c.get(base + ':n');
  if (meta === null) return null;
  const n = parseInt(meta, 10);
  if (n === 0) return [];
  const keys = [];
  for (let i = 0; i < n; i++) keys.push(base + ':' + i);
  const parts = c.getAll(keys);
  let json = '';
  for (let i = 0; i < n; i++) {
    const part = parts[base + ':' + i];
    if (part === undefined || part === null) return null; // chunk perdido → recarrega da planilha
    json += part;
  }
  try { return JSON.parse(json); } catch (e) { return null; }
}

/**
 * Grava dados da aba no cache, em chunks.
 * @param {string} sheetName
 * @param {Object[]} rows
 */
function cachePut_(sheetName, rows) {
  const c = cache_();
  const base = CACHE_PREFIX + cacheVersion_(sheetName) + ':' + sheetName;
  const json = JSON.stringify(rows);
  const chunks = {};
  let n = 0;
  for (let i = 0; i < json.length; i += CHUNK_SIZE) {
    chunks[base + ':' + n] = json.slice(i, i + CHUNK_SIZE);
    n++;
  }
  chunks[base + ':n'] = String(n);
  c.putAll(chunks, CACHE_TTL);
}

/**
 * Invalida o cache de UMA aba (troca o version token) e o memo
 * da execução atual — a próxima leitura desta mesma chamada já
 * enxerga o dado recém-escrito.
 * Escritas nunca apagam caches de outras abas.
 * @param {string} sheetName
 */
function cacheInvalidate_(sheetName) {
  cache_().put(CACHE_PREFIX + 'v:' + sheetName, String(Date.now()), 21600);
  delete EXEC_ROWS_[sheetName];
}

/** Limpa todo o cache do sistema (uso administrativo). */
function cacheFlushAll_() {
  Object.keys(SHEETS).forEach(function (k) { cacheInvalidate_(SHEETS[k]); });
}

/**
 * Carimbo combinado das versões das abas de DADOS.
 * Usado pelo auto-refresh do cliente: muda sempre que qualquer
 * escrita relevante acontece. Lê SOMENTE o CacheService —
 * nunca toca a planilha, por isso é praticamente gratuito.
 */
function cacheStamp_() {
  return [SHEETS.SALES, SHEETS.RETENTION, SHEETS.GOALS, SHEETS.SETTINGS,
    SHEETS.PRODUCTS, SHEETS.USERS, SHEETS.TEAMS]
    .map(function (s) { return cacheVersion_(s); }).join('|');
}
