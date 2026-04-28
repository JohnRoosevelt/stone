import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

// 添加段落（需提供 book_id, cid, lang_code 冗余列）
async function addParagraph(
  db,
  { chapter_id, paragraph_order, book_id, cid, lang_code, text_content },
) {
  await db
    .prepare(
      `
    INSERT INTO chapter_paragraphs (chapter_id, paragraph_order, book_id, cid, lang_code, text_content)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(chapter_id, paragraph_order) DO UPDATE SET
      text_content = excluded.text_content
  `,
    )
    .bind(chapter_id, paragraph_order, book_id, cid, lang_code, text_content)
    .run();
  return { success: true };
}

// 更新段落（通过 id 或 chapter_id+paragraph_order）
async function updateParagraph(
  db,
  { id, chapter_id, paragraph_order, text_content },
) {
  if (id) {
    await db
      .prepare("UPDATE chapter_paragraphs SET text_content = ? WHERE id = ?")
      .bind(text_content, id)
      .run();
  } else if (chapter_id && paragraph_order) {
    await db
      .prepare(
        `
      UPDATE chapter_paragraphs SET text_content = ?
      WHERE chapter_id = ? AND paragraph_order = ?
    `,
      )
      .bind(text_content, chapter_id, paragraph_order)
      .run();
  } else {
    throw new Error("Must provide id or (chapter_id, paragraph_order)");
  }
  return { success: true };
}

// 删除段落
async function deleteParagraph(db, { id, chapter_id, paragraph_order }) {
  if (id) {
    await db
      .prepare("DELETE FROM chapter_paragraphs WHERE id = ?")
      .bind(id)
      .run();
  } else if (chapter_id && paragraph_order) {
    await db
      .prepare(
        "DELETE FROM chapter_paragraphs WHERE chapter_id = ? AND paragraph_order = ?",
      )
      .bind(chapter_id, paragraph_order)
      .run();
  } else {
    throw new Error("Must provide id or (chapter_id, paragraph_order)");
  }
  return { success: true };
}

// 查询段落列表
async function listParagraphs(db, { chapter_id, book_id, cid, lang_code }) {
  const conditions = [];
  const params = [];

  if (chapter_id !== undefined && chapter_id !== null) {
    conditions.push("chapter_id = ?");
    params.push(chapter_id);
  }
  if (book_id !== undefined && book_id !== null) {
    conditions.push("book_id = ?");
    params.push(book_id);
  }
  if (cid !== undefined && cid !== null) {
    conditions.push("cid = ?");
    params.push(cid);
  }
  if (lang_code) {
    conditions.push("lang_code = ?");
    params.push(lang_code);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const sql = `
    SELECT id, chapter_id, paragraph_order, book_id, cid, lang_code, text_content
    FROM chapter_paragraphs
    ${where}
    ORDER BY chapter_id, paragraph_order
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
    const chapter_id = url.searchParams.get("chapter_id")
      ? parseInt(url.searchParams.get("chapter_id"))
      : null;
    const book_id = url.searchParams.get("book_id")
      ? parseInt(url.searchParams.get("book_id"))
      : null;
    const cid = url.searchParams.get("cid")
      ? parseInt(url.searchParams.get("cid"))
      : null;
    const lang_code = url.searchParams.get("lang_code") || null;

    const paragraphs = await listParagraphs(db, {
      chapter_id,
      book_id,
      cid,
      lang_code,
    });
    return json(paragraphs);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function POST({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    if (
      !body.chapter_id ||
      !body.paragraph_order ||
      !body.book_id ||
      !body.cid ||
      !body.lang_code ||
      !body.text_content
    ) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }
    const result = await addParagraph(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function PUT({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    if (!body.text_content) {
      return json({ error: "text_content required" }, { status: 400 });
    }
    const result = await updateParagraph(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    const result = await deleteParagraph(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
