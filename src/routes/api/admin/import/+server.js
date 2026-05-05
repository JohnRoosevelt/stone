import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

/**
 * GET /api/admin/import
 *
 * 多级查询：
 *   ?cid=0&lang=zh                   → 书籍列表（含章节/段落计数）
 *   ?cid=0&lang=zh&bookId=1          → 该书的章节列表
 *   ?cid=0&lang=zh&bookId=1&chapterId=1 → 该章的段落列表
 */
export async function GET({ url, platform }) {
  try {
    const db = getDB(platform);
    const cid = parseInt(url.searchParams.get("cid"));
    const lang = url.searchParams.get("lang") || "zh";

    if (isNaN(cid)) {
      return json({ error: "cid required" }, { status: 400 });
    }

    const bookId = url.searchParams.get("bookId");
    const chapterId = url.searchParams.get("chapterId");

    // ── 查询段落 ───────────────────────────────────────
    if (bookId != null && chapterId != null) {
      const { results } = await db
        .prepare(
          `SELECT id, num, text_content, format
           FROM chapter_paragraphs
           WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = ?
           ORDER BY id`,
        )
        .bind(cid, parseInt(bookId), parseInt(chapterId), lang)
        .all();

      return json({
        type: "paragraphs",
        cid,
        lang,
        bookId: parseInt(bookId),
        chapterId: parseInt(chapterId),
        total: results.length,
        paragraphs: results.map((r) => ({
          id: r.id,
          num: r.num,
          textContent: r.text_content,
          format: r.format,
        })),
      });
    }

    // ── 查询章节 ───────────────────────────────────────
    if (bookId != null) {
      const { results } = await db
        .prepare(
          `SELECT chapter_id, title
           FROM chapters
           WHERE cid = ? AND book_id = ? AND lang_code = ?
           ORDER BY chapter_id`,
        )
        .bind(cid, parseInt(bookId), lang)
        .all();

      // 同时统计段数
      const cpRows = await db
        .prepare(
          `SELECT chapter_id, COUNT(*) AS cnt
           FROM chapter_paragraphs
           WHERE cid = ? AND book_id = ? AND lang_code = ?
           GROUP BY chapter_id`,
        )
        .bind(cid, parseInt(bookId), lang)
        .all();

      const paraCountMap = {};
      for (const r of cpRows.results || []) {
        paraCountMap[r.chapter_id] = Number(r.cnt);
      }

      return json({
        type: "chapters",
        cid,
        lang,
        bookId: parseInt(bookId),
        total: results.length,
        chapters: results.map((r) => ({
          chapterId: r.chapter_id,
          title: r.title,
          paragraphs: paraCountMap[r.chapter_id] || 0,
        })),
      });
    }

    // ── 书籍列表 ───────────────────────────────────────
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
      type: "books",
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
 * Body: { cid, bookId, lang }
 *
 * 服务端从 R2 读取 parquet 数据，校验后写入 D1。
 * 不再依赖客户端传输整本书的章节/段落数据，避免请求体过大。
 */
export async function POST({ request, platform }) {
  try {
    const { cid, bookId, lang = "zh" } = await request.json();
    if (cid == null || bookId == null) {
      return json({ error: "cid, bookId required" }, { status: 400 });
    }

    const db = getDB(platform);

    // ── 1. 校验：该书在 book_base / book_i18n 中存在 ──────────
    const book = await db
      .prepare(
        `SELECT bb.cid, bb.book_id, bi.name
         FROM book_base bb
         JOIN book_i18n bi ON bi.cid = bb.cid AND bi.book_id = bb.book_id AND bi.lang_code = ?
         WHERE bb.cid = ? AND bb.book_id = ?`,
      )
      .bind(lang, cid, bookId)
      .first();

    if (!book) {
      return json(
        { error: `Book not found: cid=${cid}, bookId=${bookId}, lang=${lang}` },
        { status: 404 },
      );
    }

    // ── 2. 从 R2 读取 .parquet.zst 并解析 ────────────────────
    const { loadBookFromR2 } = await import("$lib/server/r2-parquet.js");
    const { chapters, chapterCount, paragraphCount } = await loadBookFromR2(
      platform,
      cid,
      lang,
      bookId,
    );

    console.log("[import] parsed from R2:", {
      chapterCount,
      paragraphCount,
      firstChapter: chapters[0]
        ? {
            chapterId: chapters[0].chapterId,
            title: chapters[0].title,
            paragraphs: chapters[0].paragraphs.length,
          }
        : null,
      lastChapter: chapters[chapters.length - 1]
        ? {
            chapterId: chapters[chapters.length - 1].chapterId,
            title: chapters[chapters.length - 1].title,
            paragraphs: chapters[chapters.length - 1].paragraphs.length,
          }
        : null,
      chapterIds: chapters
        .map((c) => c.chapterId)
        .slice(0, 30)
        .join(","),
    });

    if (chapterCount === 0) {
      return json({ error: "No chapters found in R2 data" }, { status: 400 });
    }

    // ── 3. 校验 & 清理数据 ──────────────────────────────────
    const cleanChapters = [];
    let skippedParagraphs = 0;

    for (const ch of chapters) {
      if (!ch.paragraphs || ch.paragraphs.length === 0) {
        console.log("[import] Skipping empty chapter:", ch.chapterId);
        continue;
      }

      // chapterId 兜底（parquet n 可能为 null/0）
      const chapterId = Number(ch.chapterId) > 0 ? Number(ch.chapterId) : 1;

      // 过滤空段落
      const cleanParagraphs = ch.paragraphs.filter((p) => {
        if (!p.textContent || p.textContent.trim() === "") {
          skippedParagraphs++;
          return false;
        }
        return true;
      });

      if (cleanParagraphs.length === 0) {
        console.log(
          "[import] Skipping chapter after filtering empty paragraphs:",
          chapterId,
        );
        continue;
      }

      cleanChapters.push({
        chapterId,
        title: ch.title || `第 ${chapterId} 章`,
        paragraphs: cleanParagraphs,
      });
    }

    if (cleanChapters.length === 0) {
      return json(
        { error: "No valid chapters after filtering" },
        { status: 400 },
      );
    }

    if (skippedParagraphs > 0) {
      console.log(
        "[import] Skipped",
        skippedParagraphs,
        "empty paragraphs during import",
      );
    }

    // ── 4. 清空旧数据（事务级） ──────────────────────────────
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

    // ── 5. 批量写入（使用 cleanChapters） ──────────────────
    const stmts = [];
    let insertedChapters = 0;
    let insertedParagraphs = 0;

    for (const ch of cleanChapters) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO chapters (cid, book_id, chapter_id, lang_code, title)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT DO NOTHING`,
          )
          .bind(cid, bookId, ch.chapterId, lang, ch.title),
      );
      insertedChapters++;

      for (const p of ch.paragraphs) {
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
              ch.chapterId,
              p.id,
              p.num ?? null,
              lang,
              p.textContent,
              p.format ?? null,
            ),
        );
        insertedParagraphs++;
      }
    }

    await db.batch(stmts);

    console.log("[import] Inserted:", {
      cid,
      bookId,
      lang,
      insertedChapters,
      insertedParagraphs,
      skippedParagraphs,
    });

    return json({
      success: true,
      cid,
      bookId,
      lang,
      bookName: book.name,
      chapterCount: insertedChapters,
      paragraphCount: insertedParagraphs,
      skippedParagraphs,
    });
  } catch (e) {
    console.error("[import] POST error:", e.stack || e.message);
    return json({ error: e.message }, { status: 500 });
  }
}
