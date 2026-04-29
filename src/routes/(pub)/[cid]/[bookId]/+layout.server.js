import { validateCid } from "$lib/server/db";

export async function load({
  params: { cid, bookId },
  platform: { env },
  parent,
}) {
  const numericCid = validateCid(cid);
  if (numericCid === undefined) return { books: [], book: null, dirZh: [] };

  const db = env?.DB;
  if (!db) return { books: [], book: null, dirZh: [] };

  try {
    // 从父级 layout 获取书籍列表，避免重复查询
    const parentData = await parent();
    const books = parentData.books ?? [];

    // 获取当前书籍
    const book = books.find((b) => b.book_id === Number(bookId)) ?? null;

    // 从 D1 获取章节目录
    const { results: chapters } = await db
      .prepare(
        `
      SELECT chapter_id, title
      FROM chapters
      WHERE cid = ? AND book_id = ? AND lang_code = 'zh'
      ORDER BY chapter_id
    `,
      )
      .bind(numericCid, Number(bookId))
      .all();

    // 统一 dirZh 格式: { id, n } 对所有分类一致
    const dirZh = chapters.map((ch) => ({
      id: ch.chapter_id,
      n: String(ch.title),
    }));
    console.log({ dirZh });

    return { books, book, dirZh };
  } catch (e) {
    console.log("[book layout] D1 error:", e.message);
    return { books: [], book: null, dirZh: [] };
  }
}
