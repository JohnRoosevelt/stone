import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

export async function GET({ url, platform }) {
  const db = getDB(platform);
  const lang = url.searchParams.get("lang") || "zh";

  const { results } = await db
    .prepare(
      `
    SELECT i.cid, i.book_id, i.name, i.title, b.section, b.featured
    FROM book_i18n i
    JOIN book_base b ON i.cid = b.cid AND i.book_id = b.book_id
    WHERE i.lang_code = ?
    ORDER BY i.cid, i.book_id
  `,
    )
    .bind(lang)
    .all();

  return json(results);
}
