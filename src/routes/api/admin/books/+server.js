import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

// 查询书籍列表
async function listBooks(db, { cid, lang, q }) {
  let sql, params;

  if (q) {
    sql = `
      SELECT bb.cid, bb.book_id, bb.section, bb.featured,
             bi.lang_code, bi.name, bi.title, bi.abbreviation
      FROM book_base bb
      JOIN book_i18n bi ON bi.cid = bb.cid AND bi.book_id = bb.book_id
      WHERE bb.cid = ? AND bi.lang_code = ? AND bi.name LIKE ?
      ORDER BY bb.book_id
    `;
    params = [cid, lang, `%${q}%`];
  } else {
    sql = `
      SELECT bb.cid, bb.book_id, bb.section, bb.featured,
             bi.lang_code, bi.name, bi.title, bi.abbreviation
      FROM book_base bb
      JOIN book_i18n bi ON bi.cid = bb.cid AND bi.book_id = bb.book_id
      WHERE bb.cid = ? AND bi.lang_code = ?
      ORDER BY bb.book_id
    `;
    params = [cid, lang];
  }

  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all();
  return results;
}

// 添加书籍
async function addBook(
  db,
  { cid, book_id, section, featured, lang_code, name, title },
) {
  await db
    .prepare(
      `
    INSERT OR IGNORE INTO book_base (cid, book_id, section, featured) VALUES (?, ?, ?, ?)
  `,
    )
    .bind(cid, book_id, section || null, featured ?? null)
    .run();

  await db
    .prepare(
      `
    INSERT INTO book_i18n (cid, book_id, lang_code, name, title)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(cid, book_id, lang_code) DO UPDATE SET
      name = excluded.name,
      title = excluded.title
  `,
    )
    .bind(cid, book_id, lang_code, name, title || null)
    .run();

  return { success: true };
}

// 更新书籍
async function updateBook(
  db,
  { cid, book_id, section, featured, lang_code, name, title },
) {
  // 更新基础信息
  await db
    .prepare(
      `
    UPDATE book_base SET section = ?, featured = ? WHERE cid = ? AND book_id = ?
  `,
    )
    .bind(section || null, featured ?? null, cid, book_id)
    .run();

  // 更新多语言信息（如果提供）
  if (lang_code && name) {
    await db
      .prepare(
        `
      INSERT INTO book_i18n (cid, book_id, lang_code, name, title)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cid, book_id, lang_code) DO UPDATE SET
        name = excluded.name,
        title = excluded.title
    `,
      )
      .bind(cid, book_id, lang_code, name, title || null)
      .run();
  }

  return { success: true };
}

// 删除书籍（级联删除关联的书籍多语言、章节、段落）
async function deleteBook(db, { cid, book_id }) {
  await db
    .prepare(
      `
    DELETE FROM book_base WHERE cid = ? AND book_id = ?
  `,
    )
    .bind(cid, book_id)
    .run();
  return { success: true };
}

export async function GET({ url, platform }) {
  try {
    const db = getDB(platform);
    const cid = parseInt(url.searchParams.get("cid"));
    const lang = url.searchParams.get("lang") || "zh";
    const q = url.searchParams.get("q") || "";

    if (isNaN(cid)) {
      return json({ error: "cid is required" }, { status: 400 });
    }

    const books = await listBooks(db, { cid, lang, q });
    return json(books);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function POST({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    if (!body.cid || !body.book_id || !body.lang_code || !body.name) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }
    const result = await addBook(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function PUT({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    if (body.cid == null || body.book_id == null) {
      return json({ error: "cid and book_id required" }, { status: 400 });
    }
    const result = await updateBook(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE({ request, platform }) {
  try {
    const db = getDB(platform);
    const body = await request.json();
    if (body.cid == null || body.book_id == null) {
      return json({ error: "cid and book_id required" }, { status: 400 });
    }
    const result = await deleteBook(db, body);
    return json(result);
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
