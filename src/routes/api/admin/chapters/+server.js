import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

// 添加章节
async function addChapter(db, { cid, book_id, chapter_id, lang_code, title }) {
  await db
    .prepare(
      `
    INSERT INTO chapters (cid, book_id, chapter_id, lang_code, title)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cid, book_id, chapter_id, lang_code) DO UPDATE SET
      title = excluded.title
  `,
    )
    .bind(cid, book_id, chapter_id, lang_code, title)
    .run();
  return { success: true };
}

// 更新章节标题（通过复合主键）
async function updateChapter(
  db,
  { cid, book_id, chapter_id, lang_code, title },
) {
  if (
    cid !== undefined &&
    cid !== null &&
    book_id !== undefined &&
    book_id !== null &&
    chapter_id !== undefined &&
    chapter_id !== null &&
    lang_code
  ) {
    await db
      .prepare(
        "UPDATE chapters SET title = ? WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = ?",
      )
      .bind(title, cid, book_id, chapter_id, lang_code)
      .run();
  } else {
    throw new Error("Must provide (cid, book_id, chapter_id, lang_code)");
  }
  return { success: true };
}

// 删除章节（级联删除段落，由 ON DELETE CASCADE 自动处理）
async function deleteChapter(db, { cid, book_id, chapter_id, lang_code }) {
  if (
    cid !== undefined &&
    cid !== null &&
    book_id !== undefined &&
    book_id !== null &&
    chapter_id !== undefined &&
    chapter_id !== null &&
    lang_code
  ) {
    await db
      .prepare(
        "DELETE FROM chapters WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = ?",
      )
      .bind(cid, book_id, chapter_id, lang_code)
      .run();
  } else {
    throw new Error("Must provide (cid, book_id, chapter_id, lang_code)");
  }
  return { success: true };
}

// 查询章节列表
async function listChapters(db, { cid, book_id, lang_code }) {
  const conditions = [];
  const params = [];

  if (cid !== undefined && cid !== null) {
    conditions.push("cid = ?");
    params.push(cid);
  }
  if (book_id !== undefined && book_id !== null) {
    conditions.push("book_id = ?");
    params.push(book_id);
  }
  if (lang_code) {
    conditions.push("lang_code = ?");
    params.push(lang_code);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const sql = `
    SELECT cid, book_id, chapter_id, lang_code, title
    FROM chapters
    ${where}
    ORDER BY cid, book_id, chapter_id
  `;

  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all();
  return results;
}

export async function GET({ url, platform }) {
  try {
    const db = getDB(platform);
    const cid = url.searchParams.get("cid")
      ? parseInt(url.searchParams.get("cid"))
      : null;
    const book_id = url.searchParams.get("book_id")
      ? parseInt(url.searchParams.get("book_id"))
      : null;
    const lang_code = url.searchParams.get("lang_code") || null;

    const chapters = await listChapters(db, { cid, book_id, lang_code });
    return json(chapters);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function POST({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    if (
      body.cid === undefined ||
      body.cid === null ||
      body.book_id === undefined ||
      body.book_id === null ||
      body.chapter_id === undefined ||
      body.chapter_id === null ||
      !body.lang_code ||
      !body.title
    ) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }
    const result = await addChapter(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function PUT({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    if (!body.title) {
      return json({ error: "title required" }, { status: 400 });
    }
    const result = await updateChapter(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    const result = await deleteChapter(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
