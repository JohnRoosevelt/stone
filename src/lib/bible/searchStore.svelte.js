/**
 * 搜索状态共享存储（模块级）
 *
 * 跨页面（搜索输入页 ↔ 搜索结果页 ↔ 详情页）保持搜索结果和滚动位置。
 * 利用 .svelte.js 的模块级 $state 实现全局响应式状态。
 *
 * 缓存策略：
 *   每次搜索取 200 条，按 `${lang}|${q}|${cid}` 缓存到 Map 中。
 *   相同搜索条件再次命中时直接返回缓存，不查数据库。
 *   缓存上限 50 条，超出时淘汰最旧的条目（FIFO）。
 */

/** @typedef {{ rowid: number, cid: number, book_id: number, chapter_id: number, id: string, num: number | null, text_content: string, format: string, lang_code: string, chapter_title: string, book_name: string }} SearchResult */

/** @typedef {{ total: number, hasMore: boolean, results: SearchResult[] }} CacheEntry */

/**
 * 搜索范围选项
 */
export const SCOPES = [
  { cid: 0, label: "圣经" },
  { cid: 1, label: "预言之灵" },
  { cid: 2, label: "书籍" },
];

/** 搜索历史（最多 20 条） */
const HISTORY_MAX = 20;

export const searchHistory = $state(/** @type {string[]} */ ([]));

const PAGE_SIZE = 200;
const CACHE_MAX = 50;

/**
 * 搜索缓存（模块级 Map）
 * key = `${lang}|${q}|${cid}`   value = CacheEntry
 */
const searchCache = new Map();
/** FIFO 淘汰用的 key 队列 */
const cacheKeys = [];

/**
 * 构建缓存 key
 * @param {string} q
 * @param {number | undefined} cid
 * @param {string} [lang]
 * @returns {string}
 */
function cacheKey(q, cid, lang = "zh") {
  return `${lang}|${q}|${cid ?? ""}`;
}

/**
 * 写入缓存（超限时淘汰最旧）
 * @param {string} key
 * @param {CacheEntry} entry
 */
function setCache(key, entry) {
  if (searchCache.has(key)) {
    // 已存在，移到队列尾部
    const idx = cacheKeys.indexOf(key);
    if (idx !== -1) cacheKeys.splice(idx, 1);
  }
  searchCache.set(key, entry);
  cacheKeys.push(key);
  // FIFO 淘汰
  while (cacheKeys.length > CACHE_MAX) {
    const oldest = cacheKeys.shift();
    searchCache.delete(oldest);
  }
}

/**
 * 搜索状态
 */
export const searchState = $state({
  /** 搜索词 */
  query: "",
  /** 范围筛选 cid */
  scopeCid: /** @type {number | undefined} */ (undefined),
  /** 搜索结果列表 */
  results: /** @type {SearchResult[]} */ ([]),
  /** 匹配总数 */
  total: 0,
  /** 是否还有更多 */
  hasMore: false,
  /** 当前偏移量 */
  offset: 0,
  /** 是否已执行过搜索 */
  searched: false,
  /** 错误信息 */
  error: "",
  /** 正在加载 */
  loading: false,
  /** 正在加载更多 */
  loadingMore: false,
  /** 分类折叠状态 */
  expanded: /** @type {Record<number, boolean>} */ ({}),
  /** 搜索结果页的滚动位置 */
  scrollTop: 0,
});

/**
 * 重置搜索结果（保留 query 和 scopeCid）
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
 * 从缓存还原搜索结果
 * @param {string} q
 * @param {number | undefined} cid
 * @returns {boolean} 是否命中缓存
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
 * 写入缓存（基于当前搜索结果）
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
 * 记录搜索历史（去重，新搜的放最前面）
 * @param {string} q
 */
function recordHistory(q) {
  const idx = searchHistory.indexOf(q);
  if (idx !== -1) searchHistory.splice(idx, 1);
  searchHistory.unshift(q);
  if (searchHistory.length > HISTORY_MAX) searchHistory.length = HISTORY_MAX;
}

/**
 * 执行搜索（追加或刷新）
 * @param {string} q - 搜索词
 * @param {number | undefined} cid - 范围分类
 * @param {boolean} [append] - 是否追加更多结果
 */
export async function doSearch(q, cid, append = false) {
  const trimmed = q.trim();
  if (!trimmed) return;

  // ── 非追加模式：先尝试命中缓存 ──
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
        /* 忽略 JSON 解析错误 */
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
    // 更新 offset 为当前结果总数，确保下次追加从正确位置开始
    searchState.offset = searchState.results.length;

    // ── 非追加模式才写入缓存并记录历史 ──
    if (!append) {
      saveToCache();
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

/** 给匹配词高亮 */
export function highlightText(text, keyword) {
  if (!keyword || !text) return text;
  const words = keyword.trim().split(/\s+/).filter(Boolean);
  // 词从长到短排序，长词优先避免嵌套
  const sorted = [...words].sort((a, b) => b.length - a.length);
  // 收集所有匹配位置
  const ranges = [];
  for (const w of sorted) {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    let m;
    while ((m = re.exec(text)) !== null) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  // 去重并按位置排序
  ranges.sort((a, b) => a.start - b.start);
  const unique = ranges.filter(
    (r, i) => i === 0 || r.start !== ranges[i - 1].start,
  );
  // 从后往前替换
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
 * 取关键字附近的文本片段
 *
 * 当段落很长时，取第一个匹配位置前后各约 N 字作为预览片段，
 * 确保关键字始终可见，避免 line-clamp 截断后关键字被隐藏。
 *
 * @param {string} text - 原始段落文本
 * @param {string} keyword - 搜索关键字
 * @param {number} [before=60] - 匹配位置前保留字数
 * @param {number} [after=80] - 匹配位置后保留字数
 * @returns {string} 带高亮 HTML 的片段
 */
export function getSnippet(text, keyword, before = 60, after = 80) {
  if (!keyword || !text) return text ?? "";

  const trimmed = keyword.trim();
  if (!trimmed) return text;

  const words = trimmed.split(/\s+/).filter(Boolean);

  // 找到第一个匹配位置（完整短语优先）
  let idx = text.toLowerCase().indexOf(trimmed.toLowerCase());

  // 完整短语没找到，找第一个出现的单词
  if (idx === -1) {
    for (const w of words) {
      const pos = text.toLowerCase().indexOf(w.toLowerCase());
      if (pos !== -1) {
        idx = pos;
        break;
      }
    }
  }

  // 仍然没找到，返回前 after*2 字（仍然尝试高亮每个单词）
  if (idx === -1) {
    const short = text.slice(0, after * 2);
    return highlightText(short, keyword);
  }

  // 计算片段范围
  const start = Math.max(0, idx - before);
  const end = Math.min(text.length, idx + trimmed.length + after);

  let snippet = text.slice(start, end);

  // 边界加 ...
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";

  return highlightText(snippet, keyword);
}
