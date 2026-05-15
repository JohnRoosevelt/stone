/**
 * Cloudflare KV search cache
 *
 * Caches search results in Cloudflare KV to reduce D1 query load.
 * Cache key includes all query parameters (q, lang, cid, bookId, limit, offset),
 * so each search query + each pagination page is cached independently.
 * TTL is 30 days by default (maximum KV expiration).
 *
 * Cache invalidation:
 * - Automatic: entries expire after TTL via KV's expiration mechanism.
 * - Manual: after content updates, call `clearCache(kv)` to flush all search caches.
 */

/** Default cache TTL (seconds) — 30 days (KV maximum) */
const DEFAULT_TTL = 60 * 60 * 24 * 30; // 30 days

/** Cache key prefix — project-specific to avoid collisions across apps in the same KV namespace */
const KEY_PREFIX = "stone:search:";

/**
 * Build a KV cache key from search parameters
 *
 * @param {Object} params
 * @param {string} params.q - Search query
 * @param {string} params.lang - Language code
 * @param {number|undefined} params.cid - Category ID
 * @param {number|undefined} params.bookId - Book ID
 * @param {number} params.limit - Results per page
 * @param {number} params.offset - Pagination offset
 * @returns {string}
 */
export function buildCacheKey({ q, lang = "zh", cid, bookId, limit, offset }) {
  const parts = [
    "q=" + encodeURIComponent(q.trim().toLowerCase()),
    "lang=" + lang,
    cid !== undefined && cid !== null ? "cid=" + cid : "",
    bookId !== undefined && bookId !== null ? "bookId=" + bookId : "",
    "limit=" + limit,
    "offset=" + offset,
  ];
  return KEY_PREFIX + parts.filter(Boolean).join("&");
}

/**
 * Get search results from KV cache
 *
 * @param {import("@cloudflare/workers-types").KVNamespace} kv - Cloudflare KV namespace
 * @param {string} key - Cache key (from buildCacheKey)
 * @returns {Promise<Object|null>} Cached result or null if not found / expired
 */
export async function getFromCache(kv, key) {
  try {
    const cached = await kv.get(key, "json");
    return cached || null;
  } catch (e) {
    // Log but don't throw; fall through to D1 query
    console.warn("[searchCache] KV get error:", e.message);
    return null;
  }
}

/**
 * Save search results to KV cache
 *
 * @param {import("@cloudflare/workers-types").KVNamespace} kv - Cloudflare KV namespace
 * @param {string} key - Cache key (from buildCacheKey)
 * @param {Object} data - Search result data to cache
 * @param {number} [ttl=DEFAULT_TTL] - Cache TTL in seconds
 * @returns {Promise<void>}
 */
export async function setToCache(kv, key, data, ttl = DEFAULT_TTL) {
  try {
    await kv.put(key, JSON.stringify(data), {
      expirationTtl: ttl,
    });
  } catch (e) {
    // Log but don't throw; cache write failure is non-critical
    console.warn("[searchCache] KV put error:", e.message);
  }
}

/**
 * Delete all cached entries matching a prefix pattern
 *
 * Can be used when content is updated to invalidate related caches.
 * Note: KV list operation is limited; use with caution for large namespaces.
 *
 * @param {import("@cloudflare/workers-types").KVNamespace} kv
 * @param {string} [prefix=KEY_PREFIX] - Key prefix to delete
 * @returns {Promise<number>} Number of deleted keys
 */
export async function clearCache(kv, prefix = KEY_PREFIX) {
  let deleted = 0;
  try {
    let cursor;
    do {
      const list = await kv.list({ prefix, cursor });
      if (list.keys.length === 0) break;
      await Promise.all(list.keys.map((k) => kv.delete(k.name)));
      deleted += list.keys.length;
      cursor = list.cursor;
    } while (cursor);
  } catch (e) {
    console.warn("[searchCache] KV clear error:", e.message);
  }
  return deleted;
}
