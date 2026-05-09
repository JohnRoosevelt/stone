import { browser } from "$app/environment";

// This route contains dynamic Bible content (chapters/paragraphs) loaded from
// R2 or local SQLite — not prerenderable. Must be explicitly set here because
// the root layout has prerender = true which would otherwise cause crawl errors.
export const prerender = false;

async function scheduleAutoSave(cid, bookId, chapters) {
  setTimeout(async () => {
    try {
      const { hasBookData } = await import("$lib/tauri");
      if (await hasBookData(Number(cid), Number(bookId))) return;

      console.log(`[book] auto-saving ${chapters.length} chapters...`);
      const chunkSize = 10;
      for (let i = 0; i < chapters.length; i += chunkSize) {
        const chunk = chapters.slice(i, i + chunkSize);
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("save_book", {
          cid: Number(cid),
          bookId: Number(bookId),
          lang: "zh",
          chapters: chunk,
          append: i > 0,
          startChapterId: i + 1,
        });
      }
      console.log(`[book] saved to local`);
    } catch (e) {
      console.warn("[book] auto-save failed:", e?.message ?? e);
    }
  }, 500);
}

export async function load({ params: { cid, bookId }, parent }) {
  if (!browser) return { book: null, chapters: [] };

  const { isTauri, getBooks, hasBookData, getFullBook } =
    await import("$lib/tauri");

  if (isTauri()) {
    // ── Tauri: book + chapters from local SQLite, fallback to R2 ──
    const books = await getBooks("zh", Number(cid));
    const book = books.find((b) => b.book_id === Number(bookId)) ?? null;

    // Try local SQLite content first
    try {
      if (await hasBookData(Number(cid), Number(bookId))) {
        const chapters = await getFullBook(Number(cid), Number(bookId));
        return { book, chapters };
      }
    } catch (e) {
      console.warn("[book] SQLite error, fallback R2:", e?.message ?? e);
    }

    // Fallback to R2
    const { loadR2Parquet } = await import("$lib/parquet");
    const chapters = await loadR2Parquet(`${cid}/zh/${bookId}`);

    // Auto-cache to local SQLite (delayed, non-blocking)
    if (chapters.length > 0) scheduleAutoSave(cid, bookId, chapters);

    return { book, chapters };
  }

  // ── Web (Cloudflare): book from server data, chapters from R2 ──
  const { books = [] } = await parent();
  const book = books.find((b) => b.book_id === Number(bookId)) ?? null;

  const { loadR2Parquet } = await import("$lib/parquet");
  const chapters = await loadR2Parquet(`${cid}/zh/${bookId}`);

  return { book, chapters };
}
