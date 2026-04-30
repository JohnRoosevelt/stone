import { browser } from "$app/environment";

export async function load({ params: { cid, bookId }, parent }) {
  const { books = [] } = await parent();

  const book = books.find((b) => b.book_id === Number(bookId)) ?? null;

  let chapters = [];

  if (browser) {
    // use loadR2Parquet get all book chapters
    const { loadR2Parquet } = await import("$lib/parquet");
    const data = await loadR2Parquet(`${cid}/${"zh"}/${bookId}`);
    chapters = data;
  }

  return { book, chapters };
}
