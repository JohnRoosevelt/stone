import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

export async function GET({ params, url, platform }) {
  const db = getDB(platform);
  const bookId = parseInt(params.bookId);
  const lang = url.searchParams.get("lang") || "zh";
  const cid = parseInt(url.searchParams.get("cid") || "0");

  if (isNaN(bookId) || isNaN(cid)) {
    return json({ error: "Invalid bookId or cid" }, { status: 400 });
  }

  const { results } = await db
    .prepare(
      `
    SELECT chapter_id, title
    FROM chapters
    WHERE cid = ? AND book_id = ? AND lang_code = ?
    ORDER BY chapter_id
  `,
    )
    .bind(cid, bookId, lang)
    .all();

  return json(results);
}
