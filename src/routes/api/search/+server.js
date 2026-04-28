import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

// 转义 FTS5 特殊字符，并构建 AND 查询
function buildMatchQuery(raw) {
  const words = raw
    .replace(/[*"()+\-~^]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  return words.map((w) => `"${w}"`).join(" AND ");
}

export async function GET({ url, platform }) {
  const db = getDB(platform);
  const q = url.searchParams.get("q") || "";
  const lang = url.searchParams.get("lang") || "zh";
  const cid = url.searchParams.get("cid");
  const bookId = url.searchParams.get("bookId");

  if (!q.trim()) {
    return json({ error: "Missing search query" }, { status: 400 });
  }

  const matchStr = buildMatchQuery(q);
  if (!matchStr) {
    return json({ error: "Invalid search terms" }, { status: 400 });
  }

  const conditions = [];
  const params = [];

  // 语言过滤（段落表冗余了 lang_code）
  conditions.push("cp.lang_code = ?");
  params.push(lang);

  if (cid) {
    conditions.push("cp.cid = ?");
    params.push(parseInt(cid));
  }
  if (bookId) {
    conditions.push("cp.book_id = ?");
    params.push(parseInt(bookId));
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const sql = `
    SELECT
      cp.id,
      cp.cid,
      cp.book_id,
      cp.chapter_id,
      cp.paragraph_order,
      cp.text_content,
      cp.format,
      ch.title AS chapter_title,
      bi.name AS book_name
    FROM chapter_paragraphs cp
    JOIN chapters ch ON cp.chapter_id = ch.id
    JOIN book_i18n bi ON cp.cid = bi.cid AND cp.book_id = bi.book_id AND cp.lang_code = bi.lang_code
    ${where}
    AND cp.id IN (
      SELECT rowid FROM chapter_paragraphs_fts
      WHERE chapter_paragraphs_fts MATCH ?
    )
    ORDER BY cp.cid, cp.book_id, cp.chapter_id, cp.paragraph_order
    LIMIT 50
  `;
  params.push(matchStr);

  try {
    const { results } = await db
      .prepare(sql)
      .bind(...params)
      .all();
    return json(results);
  } catch (e) {
    return json(
      { error: "Search failed", details: e.message },
      { status: 500 },
    );
  }
}
