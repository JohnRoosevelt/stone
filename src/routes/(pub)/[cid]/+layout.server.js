import { validateCid } from "$lib/config";

// Tauri: prerender __data.json (avoid JSON parse error in static SPA)
// Cloudflare: dynamic D1 query at runtime
export const prerender = !!process.env.TAURI;

export async function load({ params: { cid }, platform }) {
  // Browser: platform is undefined, returns { books: [] }, $effect handles loading
  // Server (Cloudflare SSR): queries D1 directly
  const numericCid = validateCid(cid);
  if (numericCid === undefined) return { books: [] };

  const db = platform?.env?.DB;
  if (db) {
    try {
      const sql = `
        SELECT bb.book_id, bi.name, bi.title, bi.abbreviation, bb.section, bb.featured
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
