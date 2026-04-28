import { browser } from "$app/environment";

export async function load({ params: { cid, bookId }, data }) {
  console.log({ cid, bookId, data });

  // todo:: in tauri, data is not available, .server.js is not called
  const { books, book } = data;

  if (!browser) {
    return { books, book, dirZh: null };
  }

  // load parquet content only in browser
  const { loadParquetContent } = await import("$lib/parquet");
  const dirZh = await loadParquetContent({ cid, bookId });

  return { book, dirZh };
}
