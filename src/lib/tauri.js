let _isTauri = null;

export function isTauri() {
  if (_isTauri !== null) return _isTauri;
  _isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
  return _isTauri;
}

async function tauriInvoke(cmd, args) {
  if (!isTauri()) throw new Error("Not in Tauri environment");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(cmd, args);
}

// ── Books ────────────────────────────────────────────────────

export async function getBooks(lang = "zh", cid) {
  if (isTauri()) return tauriInvoke("get_books", { lang, cid: cid ?? null });
  const res = await fetch(`/api/books?lang=${lang}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getChapters(cid, bookId, lang = "zh") {
  if (isTauri()) return tauriInvoke("get_chapters", { cid, bookId, lang });
  const res = await fetch(
    `/api/admin/import?cid=${cid}&bookId=${bookId}&lang=${lang}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.chapters || [];
}

export async function getParagraphs(cid, bookId, chapterId, lang = "zh") {
  if (isTauri())
    return tauriInvoke("get_paragraphs", { cid, bookId, chapterId, lang });
  const res = await fetch(
    `/api/admin/import?cid=${cid}&bookId=${bookId}&chapterId=${chapterId}&lang=${lang}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data.paragraphs || [];
}

// ── Data Import ────────────────────────────────────────────────

export async function hasBookData(cid, bookId, lang = "zh") {
  if (!isTauri()) return false;
  return tauriInvoke("has_book_data", { cid, bookId, lang });
}

export async function getFullBook(cid, bookId, lang = "zh") {
  if (isTauri()) return tauriInvoke("get_full_book", { cid, bookId, lang });
  throw new Error("getFullBook only available in Tauri mode");
}

export async function deleteBookData(cid, bookId, lang = "zh") {
  if (isTauri()) return tauriInvoke("delete_book_data", { cid, bookId, lang });
  throw new Error("deleteBookData only available in Tauri mode");
}

export async function getDbSize() {
  if (isTauri()) return tauriInvoke("get_db_size", {});
  return "N/A";
}

// ── Search ────────────────────────────────────────────────────

export async function searchAPI(
  q,
  { lang = "zh", cid, limit = 200, offset = 0 } = {},
) {
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
  const params = new URLSearchParams({
    q,
    lang,
    limit: String(limit),
    offset: String(offset),
  });
  if (cid !== undefined && cid !== null) params.set("cid", String(cid));
  const res = await fetch(`/api/search?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
