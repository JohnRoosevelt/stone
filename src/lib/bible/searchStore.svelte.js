/**
 * Search state shared storage (module-level)
 *
 * Cross-page (search input page ↔ search results page ↔ detail page) maintain search results and scroll position.
 * Use .svelte.js module-level $state to implement global reactive state.
 *
 * Caching strategy:
 *   Fetch 200 results per search, cache to Map by `${lang}|${q}|${cid}`.
 *   When the same search criteria is hit again, return cache directly without querying the database.
 *   Cache limit of 50 entries, evict the oldest when exceeded (FIFO).
 */

/** @typedef {{ rowid: number, cid: number, book_id: number, chapter_id: number, id: string, num: number | null, text_content: string, format: string, lang_code: string, chapter_title: string, book_name: string }} SearchResult */

/** @typedef {{ total: number, hasMore: boolean, results: SearchResult[] }} CacheEntry */

/**
 * Search scope options
 */
export const SCOPES = [
  { cid: 0, label: "圣经" },
  { cid: 1, label: "预言之灵" },
  { cid: 2, label: "书籍" },
];

/** Search history (max 20 entries) */
const HISTORY_MAX = 20;

export const searchHistory = $state(/** @type {string[]} */ ([]));

const PAGE_SIZE = 200;
const CACHE_MAX = 50;

/**
 * Search cache (module-level Map)
 * key = `${lang}|${q}|${cid}`   value = CacheEntry
 */
const searchCache = new Map();
/** FIFO eviction key queue */
const cacheKeys = [];

/**
 * Build cache key
 * @param {string} q
 * @param {number | undefined} cid
 * @param {string} [lang]
 * @returns {string}
 */
function cacheKey(q, cid, lang = "zh") {
  return `${lang}|${q}|${cid ?? ""}`;
}

/**
 * Write to cache (evict oldest when over limit)
 * @param {string} key
 * @param {CacheEntry} entry
 */
function setCache(key, entry) {
  if (searchCache.has(key)) {
    // Already exists, move to end of queue
    const idx = cacheKeys.indexOf(key);
    if (idx !== -1) cacheKeys.splice(idx, 1);
  }
  searchCache.set(key, entry);
  cacheKeys.push(key);
  // FIFO eviction
  while (cacheKeys.length > CACHE_MAX) {
    const oldest = cacheKeys.shift();
    searchCache.delete(oldest);
  }
}

/**
 * Search state
 */
export const searchState = $state({
  /** Search query */
  query: "",
  /** Scope filter cid */
  scopeCid: /** @type {number | undefined} */ (undefined),
  /** Search results list */
  results: /** @type {SearchResult[]} */ ([]),
  /** Total matches */
  total: 0,
  /** Whether there are more */
  hasMore: false,
  /** Current offset */
  offset: 0,
  /** Whether search has been executed */
  searched: false,
  /** Error message */
  error: "",
  /** Loading */
  loading: false,
  /** Loading more */
  loadingMore: false,
  /** Category collapse state */
  expanded: /** @type {Record<number, boolean>} */ ({}),
  /** Scroll position of search results page */
  scrollTop: 0,
});

/**
 * Reset search results (keep query and scopeCid)
 */
export function resetResults() {
  searchState.results = [];
  searchState.total = 0;
  searchState.hasMore = false;
  searchState.offset = 0;
  searchState.searched = false;
  searchState.error = "";
  searchState.loading = false;
  searchState.loadingMore = false;
  searchState.expanded = {};
  searchState.scrollTop = 0;
}

/**
 * Restore search results from cache
 * @param {string} q
 * @param {number | undefined} cid
 * @returns {boolean} Whether cache was hit
 */
function restoreFromCache(q, cid) {
  const key = cacheKey(q, cid);
  const cached = searchCache.get(key);
  if (!cached) return false;

  searchState.results = cached.results;
  searchState.total = cached.total;
  searchState.hasMore = cached.hasMore;
  searchState.offset = cached.results.length;
  searchState.query = q;
  searchState.scopeCid = cid;
  searchState.searched = true;
  searchState.error = "";
  return true;
}

/**
 * Write to cache (based on current search results)
 */
function saveToCache() {
  const key = cacheKey(searchState.query, searchState.scopeCid);
  setCache(key, {
    total: searchState.total,
    hasMore: searchState.hasMore,
    results: searchState.results,
  });
}

/**
 * Record search history (dedup, newest goes first)
 * @param {string} q
 */
function recordHistory(q) {
  const idx = searchHistory.indexOf(q);
  if (idx !== -1) searchHistory.splice(idx, 1);
  searchHistory.unshift(q);
  if (searchHistory.length > HISTORY_MAX) searchHistory.length = HISTORY_MAX;
}

/**
 * Execute search (append or refresh)
 * @param {string} q - Search query
 * @param {number | undefined} cid - Scope category
 * @param {boolean} [append] - Whether to append more results
 */
export async function doSearch(q, cid, append = false) {
  const trimmed = q.trim();
  if (!trimmed) return;

  // ── Non-append mode: try cache first ──
  if (!append) {
    if (restoreFromCache(trimmed, cid)) {
      searchState.loading = false;
      searchState.loadingMore = false;
      return;
    }

    searchState.loading = true;
    searchState.offset = 0;
    searchState.results = [];
    searchState.total = 0;
    searchState.hasMore = false;
    searchState.error = "";
    searchState.searched = true;
  } else {
    searchState.loadingMore = true;
  }

  try {
    // Tauri mode: use local SQLite search
    if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
      const { searchAPI } = await import("$lib/tauri");
      const data = await searchAPI(trimmed, {
        lang: "zh",
        cid: cid,
        limit: PAGE_SIZE,
        offset: searchState.offset,
      });
      if (!data || !data.results) {
        throw new Error("搜索返回结果为空");
      }
      const newResults = data.results ?? [];
      searchState.results = append
        ? [...searchState.results, ...newResults]
        : newResults;
      searchState.total = data.total ?? 0;
      searchState.hasMore = data.hasMore ?? false;
      searchState.query = trimmed;
      searchState.scopeCid = cid;
      searchState.offset = searchState.results.length;
      saveToCache();
      if (!append) {
        recordHistory(trimmed);
      }
      return;
    }

    // Web mode: original fetch logic
    const params = new URLSearchParams({
      q: trimmed,
      lang: "zh",
      limit: String(PAGE_SIZE),
      offset: String(searchState.offset),
    });
    if (cid !== undefined) {
      params.set("cid", String(cid));
    }
    const res = await fetch(`/api/search?${params}`);
    if (!res.ok) {
      let errMsg = "搜索请求失败";
      try {
        const err = await res.json();
        errMsg = err.error || err.details || errMsg;
      } catch (_) {
        /* Ignore JSON parse error */
      }
      throw new Error(errMsg);
    }
    const data = await res.json();
    const newResults = data.results ?? [];
    searchState.results = append
      ? [...searchState.results, ...newResults]
      : newResults;
    searchState.total = data.total ?? 0;
    searchState.hasMore = data.hasMore ?? false;
    searchState.query = trimmed;
    searchState.scopeCid = cid;
    // Update offset to current total results, ensuring next append starts from correct position
    searchState.offset = searchState.results.length;

    // ── Update cache on every request (initial & append) ──
    saveToCache();
    if (!append) {
      recordHistory(trimmed);
    }
  } catch (e) {
    console.error("[search] error:", e);
    searchState.error = e.message || "搜索出错，请稍后重试";
    if (!append) {
      searchState.results = [];
      searchState.total = 0;
      searchState.hasMore = false;
    }
  } finally {
    searchState.loading = false;
    searchState.loadingMore = false;
  }
}

/** Highlight matched terms */
export function highlightText(text, keyword) {
  if (!keyword || !text) return text;
  const words = keyword.trim().split(/\s+/).filter(Boolean);
  // Sort words longest to shortest, longer words first to avoid nesting
  const sorted = [...words].sort((a, b) => b.length - a.length);
  // Collect all match positions
  const ranges = [];
  for (const w of sorted) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  // Deduplicate and sort by position
  ranges.sort((a, b) => a.start - b.start);
  const unique = ranges.filter(
    (r, i) => i === 0 || r.start !== ranges[i - 1].start,
  );
  // Replace from back to front
  const mark =
    "<mark style='background:#b3e6b3;padding:0 2px;border-radius:2px'>";
  let result = text;
  for (let i = unique.length - 1; i >= 0; i--) {
    const { start, end } = unique[i];
    result =
      result.slice(0, start) +
      `${mark}${result.slice(start, end)}</mark>` +
      result.slice(end);
  }
  return result;
}

/**
 * Get text snippet near keyword
 *
 * When the paragraph is long, take about N characters before and after the first match position as a preview snippet,
 * ensuring the keyword is always visible, preventing it from being hidden after line-clamp truncation.
 *
 * @param {string} text - Original paragraph text
 * @param {string} keyword - Search keyword
 * @param {number} [before=60] - Characters to keep before match position
 * @param {number} [after=80] - Characters to keep after match position
 * @returns {string} Snippet with highlighted HTML
 */
export function getSnippet(text, keyword, before = 60, after = 80) {
  if (!keyword || !text) return text ?? "";

  const trimmed = keyword.trim();
  if (!trimmed) return text;

  const words = trimmed.split(/\s+/).filter(Boolean);

  // Find first match position (full phrase preferred)
  let idx = text.toLowerCase().indexOf(trimmed.toLowerCase());

  // Full phrase not found, search for first occurring word
  if (idx === -1) {
    for (const w of words) {
      const pos = text.toLowerCase().indexOf(w.toLowerCase());
      if (pos !== -1) {
        idx = pos;
        break;
      }
    }
  }

  // Still not found, return first after*2 characters (still try highlighting each word)
  if (idx === -1) {
    const short = text.slice(0, after * 2);
    return highlightText(short, keyword);
  }

  // Calculate snippet range
  const start = Math.max(0, idx - before);
  const end = Math.min(text.length, idx + trimmed.length + after);

  let snippet = text.slice(start, end);

  // Add ... at boundaries
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";

  return highlightText(snippet, keyword);
}
