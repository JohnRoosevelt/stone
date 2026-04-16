import { browser } from "$app/environment";
import { PUBLIC_R2 } from "$env/static/public";
import sda from "$lib/sda/sda.json";
import bible from "$lib/bible/bible.json";
import bookMeta from "$lib/book/book.json";

const BOOK_CATALOG = { bible, sda, book: bookMeta };

async function fetchJson(cid, bookId) {
  const res = await fetch(`${PUBLIC_R2}/${cid}/zh/${bookId}.json`);
  return res.json();
}

export async function load({ fetch, params: { cid, bookId } }) {
  if (!browser) {
    return { book: null, dirZh: null };
  }

  const catalog = BOOK_CATALOG[cid];
  const currentBook = catalog?.find((i) => i.id == bookId);

  let dirZh;
  if (cid === "book") {
    const { loadParquetContent } = await import("$lib/parquet");
    dirZh = await loadParquetContent(cid, bookId);
  } else {
    dirZh = await fetchJson(cid, bookId);
  }

  return { book: currentBook, dirZh };
}
