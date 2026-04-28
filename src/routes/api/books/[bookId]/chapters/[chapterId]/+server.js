import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

export async function GET({ params, url, platform }) {
  const db = getDB(platform);
  const bookId = parseInt(params.bookId);
  const chapterId = parseInt(params.chapterId);
  const lang = url.searchParams.get("lang") || "zh";
  const cid = parseInt(url.searchParams.get("cid") || "0");

  if (isNaN(bookId) || isNaN(chapterId) || isNaN(cid)) {
    return json({ error: "Invalid parameters" }, { status: 400 });
  }

  // 利用冗余列直接查询段落表，避免 JOIN
  const { results } = await db
    .prepare(
      `
    SELECT paragraph_order, text_content, format
    FROM chapter_paragraphs
    WHERE cid = ? AND book_id = ? AND lang_code = ? AND chapter_id = (
      SELECT id FROM chapters
      WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = ?
      LIMIT 1
    )
    ORDER BY paragraph_order
  `,
    )
    .bind(cid, bookId, lang, cid, bookId, chapterId, lang)
    .all();

  return json(results);
}
