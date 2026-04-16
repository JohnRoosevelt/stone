import { browser } from "$app/environment";
import sda from "$lib/sda/sda.json";
import bible from "$lib/bible/bible.json";
import bookMeta from "$lib/book/book.json";

const BOOK_CATALOG = { bible, sda, book: bookMeta };

export async function load({ params: { cid, bookId } }) {
  if (!browser) {
    return { book: null, dirZh: null };
  }

  const catalog = BOOK_CATALOG[cid];
  const currentBook = catalog?.find((i) => i.id == bookId);

  const { loadParquetContent } = await import("$lib/parquet");
  const dirZh = await loadParquetContent(cid, bookId);

  return { book: currentBook, dirZh };
}
