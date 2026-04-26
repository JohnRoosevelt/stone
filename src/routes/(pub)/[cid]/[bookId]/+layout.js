import { browser } from "$app/environment";
import sda from "$lib/sda/sda.json";
import bible from "$lib/bible/bible.json";
import bookMeta from "$lib/book/book.json";

const BOOK_CATALOG = { bible, sda, book: bookMeta };

export async function load({ params: { cid, bookId }, data }) {
  console.log({ cid, bookId, data });

  // todo:: in tauri, data is not available, .server.js is not called
  const { books, book } = data;

  if (!browser) {
    return { books, book, dirZh: null };
  }

  // load parquet content only in browser
  const { loadParquetContent } = await import("$lib/parquet");
  const dirZh = await loadParquetContent(cid, bookId);

  return { book, dirZh };
}
