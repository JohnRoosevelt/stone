export async function load({ params: { cid, bookId }, data }) {
  // data 来自 +layout.server.js，包含 books, book, dirZh
  // dirZh 从 D1 加载，不再需要 R2 parquet
  const { books, book, dirZh } = data;
  return { books, book, dirZh };
}
