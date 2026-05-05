import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

/**
 * GET /api/admin/import?cid=0&lang=zh
 *
 * 一次查询返回所有书的章节数、段落数、导入状态
 */
export async function GET({ url, platform }) {
  try {
    const db = getDB(platform);
    const cid = parseInt(url.searchParams.get("cid"));
    const lang = url.searchParams.get("lang") || "zh";

    if (isNaN(cid)) {
      return json({ error: "cid required" }, { status: 400 });
    }

    const { results } = await db
      .prepare(
        `SELECT
          bb.cid,
          bb.book_id,
          bi.name,
          COALESCE(ch.chapter_count, 0) AS chapter_count,
          COALESCE(cp.paragraph_count, 0) AS paragraph_count
        FROM book_base bb
        JOIN book_i18n bi ON bi.cid = bb.cid AND bi.book_id = bb.book_id AND bi.lang_code = ?
        LEFT JOIN (
          SELECT cid, book_id, COUNT(*) AS chapter_count
          FROM chapters
          WHERE lang_code = ?
          GROUP BY cid, book_id
        ) ch ON ch.cid = bb.cid AND ch.book_id = bb.book_id
        LEFT JOIN (
          SELECT cid, book_id, COUNT(*) AS paragraph_count
          FROM chapter_paragraphs
          WHERE lang_code = ?
          GROUP BY cid, book_id
        ) cp ON cp.cid = bb.cid AND cp.book_id = bb.book_id
        WHERE bb.cid = ?
        ORDER BY bb.book_id`,
      )
      .bind(lang, lang, lang, cid)
      .all();

    return json({
      cid,
      lang,
      total: results.length,
      books: results.map((r) => ({
        book_id: r.book_id,
        name: r.name,
        chapters: Number(r.chapter_count),
        paragraphs: Number(r.paragraph_count),
      })),
    });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/import
 * Body: { cid, bookId, lang, chapters }
 *
 * 客户端已解析好 R2 parquet 数据，服务端只负责写入 D1。
 * chapters: [{ chapterId, title, paragraphs: [{ id, num, textContent, format }] }]
 */
export async function POST({ request, platform }) {
  try {
    const { cid, bookId, lang = "zh", chapters } = await request.json();
    if (cid == null || bookId == null || !chapters) {
      return json({ error: "cid, bookId, chapters required" }, { status: 400 });
    }

    const db = getDB(platform);
    // 清空旧数据
    await db
      .prepare(
        "DELETE FROM chapter_paragraphs WHERE cid = ? AND book_id = ? AND lang_code = ?",
      )
      .bind(cid, bookId, lang)
      .run();
    await db
      .prepare(
        "DELETE FROM chapters WHERE cid = ? AND book_id = ? AND lang_code = ?",
      )
      .bind(cid, bookId, lang)
      .run();

    // 批量构建所有 INSERT 语句
    const stmts = [];
    let chapterCount = 0;
    let paragraphCount = 0;

    for (const ch of chapters) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO chapters (cid, book_id, chapter_id, lang_code, title)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT DO NOTHING`,
          )
          .bind(
            cid,
            bookId,
            Number(ch.chapterId),
            lang,
            ch.title || `第 ${ch.chapterId} 章`,
          ),
      );
      chapterCount++;

      for (const p of ch.paragraphs || []) {
        stmts.push(
          db
            .prepare(
              `INSERT INTO chapter_paragraphs (cid, book_id, chapter_id, id, num, lang_code, text_content, format)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT DO NOTHING`,
            )
            .bind(
              cid,
              bookId,
              Number(ch.chapterId),
              p.id,
              p.num ?? null,
              lang,
              p.textContent,
              p.format ?? null,
            ),
        );
        paragraphCount++;
      }
    }

    await db.batch(stmts);

    return json({
      success: true,
      cid,
      bookId,
      lang,
      chapterCount,
      paragraphCount,
    });
  } catch (e) {
    console.error("[import] POST error:", e.stack || e.message);
    return json({ error: e.message }, { status: 500 });
  }
}
