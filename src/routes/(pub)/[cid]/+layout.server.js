const CID_MAP = { bible: 0, sda: 1, book: 2 };

export async function load({ params: { cid }, platform: { env } }) {
  const numericCid = CID_MAP[cid];
  if (numericCid === undefined) return { books: [] };

  const db = env?.DB;
  if (db) {
    try {
      const sql = `
        SELECT bb.book_id, bi.name, bi.title, bb.section, bb.featured
        FROM book_base bb
        JOIN book_i18n bi ON bi.cid = bb.cid AND bi.book_id = bb.book_id
        WHERE bb.cid = ? AND bi.lang_code = 'zh'
        ORDER BY bb.book_id
      `;
      const { results: books } = await db.prepare(sql).bind(numericCid).all();
      return { books };
    } catch (e) {
      console.log("[books] D1 error:", e.message);
    }
  }

  return { books: [] };
}
