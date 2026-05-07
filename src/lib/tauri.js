/**
 * Tauri 桥接模块
 *
 * 提供环境检测和统一 API 接口。
 * - Tauri 环境：使用 invoke() 调用 Rust 命令
 * - Web 环境：使用 fetch() 调用后端 API
 */

let _isTauri = null;

/**
 * 检测是否运行在 Tauri 环境中
 */
export function isTauri() {
  if (_isTauri !== null) return _isTauri;
  _isTauri =
    typeof window !== "undefined" &&
    typeof window.__TAURI_INTERNALS__ !== "undefined";
  return _isTauri;
}

/**
 * 安全的 invoke 调用（仅在 Tauri 环境）
 */
async function tauriInvoke(cmd, args) {
  if (!isTauri()) {
    throw new Error("Not in Tauri environment");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
}

// ── 书籍 API ────────────────────────────────────────────────

/**
 * 获取书籍列表
 * @param {string} lang - 语言代码
 * @param {number} [cid] - 分类 ID
 * @returns {Promise<Array>}
 */
export async function getBooks(lang = "zh", cid) {
  if (isTauri()) {
    return tauriInvoke("get_books", { lang, cid: cid ?? null });
  }
  const params = new URLSearchParams({ lang });
  const res = await fetch(`/api/books?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * 获取章节列表
 * @param {number} cid - 分类 ID
 * @param {number} bookId - 书籍 ID
 * @param {string} [lang] - 语言代码
 * @returns {Promise<Array>}
 */
export async function getChapters(cid, bookId, lang = "zh") {
  if (isTauri()) {
    return tauriInvoke("get_chapters", { cid, bookId, lang });
  }
  const params = new URLSearchParams({ cid, bookId, lang });
  const res = await fetch(`/api/admin/import?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.chapters || [];
}

/**
 * 获取段落内容
 * @param {number} cid - 分类 ID
 * @param {number} bookId - 书籍 ID
 * @param {number} chapterId - 章节 ID
 * @param {string} [lang] - 语言代码
 * @returns {Promise<Array>}
 */
export async function getParagraphs(cid, bookId, chapterId, lang = "zh") {
  if (isTauri()) {
    return tauriInvoke("get_paragraphs", { cid, bookId, chapterId, lang });
  }
  const params = new URLSearchParams({ cid, bookId, chapterId, lang });
  const res = await fetch(`/api/admin/import?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.paragraphs || [];
}

/**
 * 搜索
 * @param {string} q - 搜索关键词
 * @param {object} [opts]
 * @param {string} [opts.lang]
 * @param {number} [opts.cid]
 * @param {number} [opts.limit]
 * @param {number} [opts.offset]
 * @returns {Promise<{total: number, results: Array, hasMore: boolean}>}
 */
export async function searchAPI(q, { lang = "zh", cid, limit = 200, offset = 0 } = {}) {
  if (isTauri()) {
    const result = await tauriInvoke("search", {
      q,
      lang,
      cid: cid ?? null,
      limit,
      offset,
    });
    return {
      total: result.total,
      results: result.results,
      hasMore: offset + result.results.length < result.total,
    };
  }

  const params = new URLSearchParams({ q, lang, limit, offset });
  if (cid !== undefined && cid !== null) params.set("cid", String(cid));
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
