import { browser } from "$app/environment";

export async function load({ params: { cid, bookId }, parent }) {
  const { books = [] } = await parent();
  const book = books.find((b) => b.book_id === Number(bookId)) ?? null;
  let chapters = [];

  if (browser) {
    const { isTauri, hasBookData, getFullBook, importBook } =
      await import("$lib/tauri");

    if (isTauri()) {
      try {
        const has = await hasBookData(Number(cid), Number(bookId));
        console.log(`[book] cid=${cid} bookId=${bookId} local=${has}`);

        if (has) {
          chapters = await getFullBook(Number(cid), Number(bookId));
          console.log(`[book] SQLite: ${chapters.length} chapters`);
          return { book, chapters };
        }
      } catch (e) {
        console.warn("[book] SQLite error, fallback R2:", e?.message ?? e);
      }
    }

    // Load from R2
    console.log(`[book] cid=${cid} bookId=${bookId} → R2`);
    const { loadR2Parquet } = await import("$lib/parquet");
    chapters = await loadR2Parquet(`${cid}/zh/${bookId}`);
    console.log(`[book] R2: ${chapters.length} chapters`);

    // Tauri mode: auto-cache to local SQLite after R2 load (delayed, non-blocking)
    if (isTauri() && chapters.length > 0) {
      // Delay 500ms with setTimeout, wait for page to render before saving
      setTimeout(async () => {
        try {
          const has = await hasBookData(Number(cid), Number(bookId));
          if (has) return;

          console.log(`[book] auto-saving ${chapters.length} chapters...`);
          // Large book chunking: send 10 chapters at a time
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
  }

  return { book, chapters };
}
