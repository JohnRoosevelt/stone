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

// ── Initial Import ────────────────────────────────────────────

export async function needsInitialImport() {
  if (isTauri()) return tauriInvoke("needs_initial_import", {});
  return false;
}

export async function getAllBooksForImport(lang = "zh") {
  if (isTauri()) return tauriInvoke("get_all_books_for_import", { lang });
  return [];
}

export async function getImportedBooks(lang = "zh") {
  if (isTauri()) return tauriInvoke("get_imported_books", { lang });
  return [];
}

export async function markImportComplete() {
  if (isTauri()) return tauriInvoke("mark_import_complete", {});
}

export async function resetInitialImport() {
  if (isTauri()) return tauriInvoke("reset_initial_import", {});
}

// ── Annotations ────────────────────────────────────────────────────

export async function getAnnotations(cid, bookId, chapterId, lang = "zh") {
  if (!isTauri()) return [];
  return tauriInvoke("get_annotations", { cid, bookId, chapterId, lang });
}

export async function saveAnnotation(annotation) {
  if (!isTauri()) return -1;
  return tauriInvoke("save_annotation", { annotation });
}

export async function deleteAnnotation(id) {
  if (!isTauri()) return;
  return tauriInvoke("delete_annotation", { id });
}

// ── Reading Progress ───────────────────────────────────────────────

export async function saveReadingProgress(progress) {
  if (!isTauri()) return;
  return tauriInvoke("save_reading_progress", { progress });
}

export async function getReadingProgress(cid, bookId, lang = "zh") {
  if (!isTauri()) return null;
  return tauriInvoke("get_reading_progress", { cid, bookId, lang });
}

export async function getAllReadingProgress() {
  if (!isTauri()) return [];
  return tauriInvoke("get_all_reading_progress", {});
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
