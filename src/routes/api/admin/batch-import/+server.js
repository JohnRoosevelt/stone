import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

export async function POST({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();

    const { lang_code, chapters } = body;

    if (!lang_code || !Array.isArray(chapters) || chapters.length === 0) {
      return json(
        { error: "Missing required fields: lang_code and chapters" },
        { status: 400 },
      );
    }

    const statements = [];
    let paragraphCount = 0;

    for (const chapter of chapters) {
      const { cid, book_id, chapter_id, title, paragraphs } = chapter;

      // Validate required chapter fields
      if (
        cid == null ||
        book_id == null ||
        chapter_id == null ||
        title == null
      ) {
        return json(
          { error: "Each chapter must have cid, book_id, chapter_id, title" },
          { status: 400 },
        );
      }

      // Add chapter INSERT statement
      const chapterStmt = db
        .prepare(
          `
          INSERT INTO chapters (cid, book_id, chapter_id, lang_code, title)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(cid, book_id, chapter_id, lang_code) DO UPDATE SET
            title = excluded.title
        `,
        )
        .bind(cid, book_id, chapter_id, lang_code, title);
      statements.push(chapterStmt);

      if (!Array.isArray(paragraphs)) continue;

      for (const paragraph of paragraphs) {
        const { paragraph_order, text_content, format } = paragraph;

        // Validate required paragraph fields
        if (paragraph_order == null || text_content == null) {
          return json(
            { error: "Each paragraph must have paragraph_order, text_content" },
            { status: 400 },
          );
        }

        // Add paragraph INSERT statement
        const paragraphStmt = db
          .prepare(
            `
            INSERT INTO chapter_paragraphs (cid, book_id, chapter_id, paragraph_order, lang_code, text_content, format)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cid, book_id, chapter_id, paragraph_order, lang_code) DO UPDATE SET
              text_content = excluded.text_content,
              format = excluded.format
          `,
          )
          .bind(
            cid,
            book_id,
            chapter_id,
            paragraph_order,
            lang_code,
            text_content,
            format ?? null,
          );
        statements.push(paragraphStmt);
        paragraphCount++;
      }
    }

    // Execute all statements in a single batch
    await db.batch(statements);

    return json({
      success: true,
      chapters: chapters.length,
      paragraphs: paragraphCount,
    });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
