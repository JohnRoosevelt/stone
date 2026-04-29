import { validateCid } from "$lib/server/db";

export async function load({
  params: { cid, bookId, chapterId },
  platform: { env },
  parent,
}) {
  const numericCid = validateCid(cid);
  if (numericCid === undefined) return { titleZh: null, chapterZh: [] };

  const db = env?.DB;
  if (!db) return { titleZh: null, chapterZh: [] };

  try {
    // 从父 layout 的 dirZh 中按 chapterId 取章节标题
    const parentData = await parent();
    const dirZh = parentData.dirZh ?? [];
    const chapter = dirZh.find((ch) => ch.id === Number(chapterId));
    const titleZh = chapter?.n ?? String(chapterId);

    const { results: paragraphs } = await db
      .prepare(
        `
      SELECT id, num, text_content, format
      FROM chapter_paragraphs
      WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = 'zh'
      ORDER BY id
    `,
      )
      .bind(numericCid, Number(bookId), Number(chapterId))
      .all();

    // bible/sda/book 统一使用 { t, p, c } 格式
    const chapterZh = paragraphs.map((p) => ({
      t: p.format ?? 7,
      p: p.num ?? p.id,
      c: p.text_content,
    }));

    return { titleZh, chapterZh };
  } catch (e) {
    console.log("[chapter] D1 error:", e.message);
    return { titleZh: null, chapterZh: [] };
  }
}
