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

export async function GET({ url, platform }) {
  try {
    const db = getDB(platform);
    const q = url.searchParams.get("q") || "";
    const lang = url.searchParams.get("lang") || "zh";
    const cidParam = url.searchParams.get("cid");
    const bookIdParam = url.searchParams.get("bookId");

    if (!q.trim()) {
      return json({ error: "Missing search query" }, { status: 400 });
    }

    const matchStr = buildMatchQuery(q);
    if (!matchStr) {
      return json({ error: "Invalid search terms" }, { status: 400 });
    }

    // 解析可选的整数参数
    const cid = cidParam ? parseInt(cidParam) : undefined;
    const bookId = bookIdParam ? parseInt(bookIdParam) : undefined;

    const params = [];
    const ftsJoins = [];
    const whereConditions = [];

    // ── FTS 全文匹配 ──
    // 用 JOIN 替代 IN (SELECT ...)，让 SQLite 优化器有更多选择
    ftsJoins.push(`JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid`);

    // FTS MATCH 条件
    whereConditions.push(`chapter_paragraphs_fts MATCH ?`);
    params.push(matchStr);

    // ── 语言过滤（总是有） ──
    whereConditions.push("cp.lang_code = ?");
    params.push(lang);

    // ── rowid 范围裁剪（可选） ──
    // 有语言 + 分类（或更精确范围）时，提前算出 rowid 区间，
    // 避免 FTS 命中大量其他分类的行却要全部回表
    if (cid !== undefined || bookId !== undefined) {
      const range = await getRowidRange(db, { lang, cid, bookId });
      if (range) {
        whereConditions.push("cp.rowid >= ? AND cp.rowid <= ?");
        params.push(range.minRowid, range.maxRowid);
      }
    }

    // ── 额外的过滤条件（索引可走 idx_paragraphs_lookup 前缀） ──
    if (cid !== undefined) {
      whereConditions.push("cp.cid = ?");
      params.push(cid);
    }
    if (bookId !== undefined) {
      whereConditions.push("cp.book_id = ?");
      params.push(bookId);
    }

    const joins = ftsJoins.join("\n");
    const where = whereConditions.length
      ? "WHERE " + whereConditions.join(" AND ")
      : "";

    const sql = `
      SELECT
        cp.rowid,
        cp.cid,
        cp.book_id,
        cp.chapter_id,
        cp.paragraph_order,
        cp.text_content,
        cp.format,
        cp.lang_code,
        ch.title AS chapter_title,
        bi.name AS book_name
      FROM chapter_paragraphs cp
      ${joins}
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
      ORDER BY fts.rank
      LIMIT 100
    `;

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
