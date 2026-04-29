import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

/** 判断是否包含 CJK 中文 */
function hasCJK(str) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(str);
}

/**
 * rowid 范围裁剪优化
 *
 * 背景：FTS5 外部内容表只索引了 text_content，没有 lang_code / cid / book_id。
 * 按范围搜索时，FTS 先查出所有语言的所有匹配行，再 JOIN 回主表过滤范围。
 * 高频词（如"耶稣"）可命中数万行，若搜索范围只限某个分类/书，绝大部分回表是浪费的。
 *
 * 优化：提前算出目标范围的 rowid [min, max] 传给 FTS JOIN，让 SQLite 在回表时
 * 直接跳过范围外的行。
 *
 * 优化效果（假设高频词 FTS 命中 8000 行）：
 *   ┌────────────────────────────────┬──────┬──────────┬────────┐
 *   │ 搜索范围                       │ 命中 │ 实际回表 │ 提速   │
 *   ├────────────────────────────────┼──────┼──────────┼────────┤
 *   │ lang=zh                        │ 8000 │ 8000     │ 不变   │
 *   │ lang=zh&cid=0                  │ 8000 │ ~4000    │ 2x     │
 *   │ lang=zh&cid=0&bookId=1        │ 8000 │ ~200     │ 40x    │
 *   │ lang=zh&cid=0&bookId=1&chapter=3 │ 8000 │ ~5    │ 1600x  │
 *   └────────────────────────────────┴──────┴──────────┴────────┘
 *   低频词（如"以利沙"）命中仅几十行，优化效果不明显，但也没有额外开销。
 *
 * @param db    - D1 数据库实例
 * @param lang  - 语言代码（必填）
 * @param cid   - 分类（可选）
 * @param bookId - 书 ID（可选）
 * @returns { minRowid, maxRowid } | null（范围无效时返回 null）
 */
async function getRowidRange(db, { lang, cid, bookId }) {
  const conditions = ["lang_code = ?"];
  const params = [lang];

  if (cid !== undefined && cid !== null) {
    conditions.push("cid = ?");
    params.push(cid);
  }
  if (bookId !== undefined && bookId !== null) {
    conditions.push("book_id = ?");
    params.push(bookId);
  }

  const sql = `
    SELECT MIN(rowid) as minRowid, MAX(rowid) as maxRowid
    FROM chapter_paragraphs
    WHERE ${conditions.join(" AND ")}
  `;

  const row = await db
    .prepare(sql)
    .bind(...params)
    .first();
  if (!row || row.minRowid === null || row.maxRowid === null) {
    return null;
  }
  return { minRowid: row.minRowid, maxRowid: row.maxRowid };
}

/**
 * 构建 FTS5 MATCH 查询（仅用于非中文）
 */
function buildFtsMatch(raw) {
  const words = raw
    .replace(/[*"()+\-~^]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  return words.map((w) => `"${w}"`).join(" AND ");
}

export async function GET({ url, platform }) {
  try {
    const db = getDB(platform);
    const q = url.searchParams.get("q") || "";
    const lang = url.searchParams.get("lang") || "zh";
    const cidParam = url.searchParams.get("cid");
    const bookIdParam = url.searchParams.get("bookId");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "20"),
      100,
    );
    const offset = parseInt(url.searchParams.get("offset") || "0");

    if (!q.trim()) {
      return json({ error: "Missing search query" }, { status: 400 });
    }

    const cid = cidParam ? parseInt(cidParam) : undefined;
    const bookId = bookIdParam ? parseInt(bookIdParam) : undefined;
    const isCJKQuery = hasCJK(q);

    const params = [];
    const joins = [];
    const whereConditions = [];

    // 语言过滤（总是有）
    whereConditions.push("cp.lang_code = ?");
    params.push(lang);

    if (isCJKQuery) {
      // ── 中文搜索：用 LIKE 替代 FTS5 ──
      // FTS5 的 unicode61 分词器无法正确拆分中文，连续汉字被当成一个 token，
      // 导致短语匹配大量遗漏。LIKE 虽无索引加速，但配合 rowid 范围裁剪 + 其他索引，
      // 对中文场景更准确。
      whereConditions.push("cp.text_content LIKE ?");
      params.push(`%${q}%`);
    } else {
      // ── 非中文（英文等）：用 FTS5 ──
      const matchStr = buildFtsMatch(q);
      if (!matchStr) {
        return json({ error: "Invalid search terms" }, { status: 400 });
      }
      joins.push(`JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid`);
      whereConditions.push(`chapter_paragraphs_fts MATCH ?`);
      params.push(matchStr);
    }

    // ── rowid 范围裁剪（可选） ──
    if (cid !== undefined || bookId !== undefined) {
      const range = await getRowidRange(db, { lang, cid, bookId });
      if (range) {
        whereConditions.push("cp.rowid >= ? AND cp.rowid <= ?");
        params.push(range.minRowid, range.maxRowid);
      }
    }

    // ── 额外的过滤条件 ──
    if (cid !== undefined) {
      whereConditions.push("cp.cid = ?");
      params.push(cid);
    }
    if (bookId !== undefined) {
      whereConditions.push("cp.book_id = ?");
      params.push(bookId);
    }

    const joinStr = joins.join("\n");
    const where = whereConditions.length
      ? "WHERE " + whereConditions.join(" AND ")
      : "";

    // ORDER BY：中文用 rowid（按原文顺序），非中文用 fts.rank（按相关度）
    const orderBy = isCJKQuery ? "cp.cid, cp.rowid" : "cp.cid, fts.rank";

    const sql = `
      SELECT
        cp.rowid,
        cp.cid,
        cp.book_id,
        cp.chapter_id,
        cp.id,
        cp.num,
        cp.text_content,
        cp.format,
        cp.lang_code,
        ch.title AS chapter_title,
        bi.name AS book_name,
        COUNT(*) OVER() AS _total
      FROM chapter_paragraphs cp
      ${joinStr}
      JOIN chapters ch
        ON ch.cid = cp.cid
       AND ch.book_id = cp.book_id
       AND ch.chapter_id = cp.chapter_id
       AND ch.lang_code = cp.lang_code
      JOIN book_i18n bi
        ON bi.cid = cp.cid
       AND bi.book_id = cp.book_id
       AND bi.lang_code = cp.lang_code
      ${where}
      ORDER BY ${orderBy}
      LIMIT ?
      OFFSET ?
    `;

    params.push(limit, offset);

    const { results } = await db
      .prepare(sql)
      .bind(...params)
      .all();
    const total = results.length > 0 ? results[0]._total : 0;
    const hasMore = offset + limit < total;
    // 移除每行多余的 _total 字段
    for (const r of results) delete r._total;
    return json({ total, results, hasMore });
  } catch (e) {
    return json(
      { error: "Search failed", details: e.message },
      { status: 500 },
    );
  }
}
