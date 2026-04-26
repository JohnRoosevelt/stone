export async function load({ params: { cid }, platform: { env } }) {
  const db = env?.DB;
  // console.log({ cid, env, db });
  if (db) {
    try {
      const sql = `SELECT book_id, name, tag, title FROM books WHERE cid = '${cid}' ORDER BY tag`;
      const { success, results: books } = await db.prepare(sql).all();
      // console.log({ success, books });
      return { books };
    } catch (e) {
      console.log("[books] D1 error:", e.message);
    }
  }

  return { books: [] };
}
