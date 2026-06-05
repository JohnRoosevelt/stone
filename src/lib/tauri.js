/**
 * Tauri 桥接模块
 *
 * 提供环境检测和统一 API 接口。
 * - Tauri 环境：使用 invoke() 调用 Rust 命令
 * - Web 环境：使用 fetch() 调用后端 API
 */

// SvelteKit `$env/static/public` 在 dev 模式无 .env 时会 throw SyntaxError
// (整个 virtual module 无 export 列表) — 用 import.meta.env + fallback
// 生产环境: 走 vite build 时的 .env / .env.production + adapter-cloudflare
// 静态替换 (PUBLIC_* 会被 tree-shake 进去 client bundle)
const PUBLIC_API_BASE =
  import.meta.env.PUBLIC_API_BASE || "https://lelexue.cn";

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
  const params = new URLSearchParams({
    q: String(q),
    lang,
    limit: String(limit),
    offset: String(offset),
  });
  if (cid !== undefined && cid !== null) params.set("cid", String(cid));

  if (isTauri()) {
    // Tauri 端: 本地 Rust SQLite 搜索 + 并行 fire-and-forget 关键词热度上报
    //   - 本地搜索 (Rust FTS5) 始终进行，不依赖网络
    //   - 网络 fetch `/api/search/track` 仅为了把 keyword 计数 +1 上传到 KV
    //   - 离线/网络失败时 catch，不影响本地结果
    // 这样 web + Android 的 keyword 热度都汇总到同一份 CF KV 计数。
    const base = PUBLIC_API_BASE || "https://lelexue.cn";

    // Fire-and-forget 热度上报（POST body 比 query 短，~80 bytes）。
    // 只在 `navigator.onLine === true` 时才发，避免无谓的 DNS / TCP。
    if (typeof navigator !== "undefined" && navigator.onLine) {
      fetch(`${base}/api/search/track`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: String(q), lang }),
        keepalive: true, // tab 关闭也能完成
      }).catch(() => {
        /* 网络失败 / 离线 — 本地搜索进度不受影响 */
      });
    }

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

  // Web 端: 走当前 origin（dev = miniflare KV, prod = CF 远端 KV）。
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return {
    total: data.total,
    results: data.results,
    hasMore: data.hasMore ?? false,
  };
}

// ── Tauri-only API stubs for web (避免 esbuild 静态 import 报错) ─────
//
// 这些函数在 Tauri/Android 端有真实实现, web 端不应被调用。
// 保留 stub 导出是必须的 — Article.svelte / +layout.js / tools/import
// 等组件会静态 import 它们, esbuild 解析失败会让整个 module 编译挂掉,
// 渲染不出来 → 划线工具栏 / 章节页 / 工具页全部失灵。
//
// 语义:
//   - getParagraphAnnotations: web 划线纯 DOM 不存 (CLAUDE.md #2), 永远空
//   - hasBookData:              web 永远走 R2 整本拉, 永远 false (CLAUDE.md #1)
export async function getParagraphAnnotations() {
  return [];
}

export async function hasBookData() {
  return false;
}
