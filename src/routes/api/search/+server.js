import { json } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";
import {
  buildCacheKey,
  getFromCache,
  setToCache,
} from "$lib/server/searchCache.js";

/** Check if text contains CJK Chinese characters */
function hasCJK(str) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(str);
}

/**
 * rowid range pruning optimization
 *
 * Background: FTS5 external content table only indexes text_content, not lang_code / cid / book_id.
 * When searching with scoping, FTS first finds all matching rows across all languages,
 * then JOINs back to the main table for filtering. High-frequency words (e.g. "Jesus")
 * can match tens of thousands of rows; if the scope is limited to a specific category/book,
 * most of the back-joins are wasteful.
 *
 * Optimization: Pre-calculate the target scope's rowid [min, max] and pass it to the FTS JOIN,
 * allowing SQLite to skip out-of-range rows during back-join.
 *
 * Effect (assuming a high-frequency word matches 8000 FTS rows):
 *   ┌────────────────────────────────┬──────┬──────────┬────────┐
 *   │ Search Scope                   │ Hits │ Back-join│ Speedup│
 *   ├────────────────────────────────┼──────┼──────────┼────────┤
 *   │ lang=zh                        │ 8000 │ 8000     │ none   │
 *   │ lang=zh&cid=0                  │ 8000 │ ~4000    │ 2x     │
 *   │ lang=zh&cid=0&bookId=1        │ 8000 │ ~200     │ 40x    │
 *   │ lang=zh&cid=0&bookId=1&chapter=3 │ 8000 │ ~5    │ 1600x  │
 *   └────────────────────────────────┴──────┴──────────┴────────┘
 *   Low-frequency words (e.g. "Elisha") only hit dozens of rows,
 *   so the optimization is less noticeable but has no extra overhead.
 *
 * @param db    - D1 database instance
 * @param lang  - Language code (required)
 * @param cid   - Category ID (optional)
 * @param bookId - Book ID (optional)
 * @returns { minRowid, maxRowid } | null (null if scope is invalid)
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
 * Build FTS5 MATCH query (for non-Chinese only)
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
    const kv = platform?.env?.STONE_SEARCH_CACHE;

    const q = url.searchParams.get("q") || "";
    const lang = url.searchParams.get("lang") || "zh";
    const cidParam = url.searchParams.get("cid");
    const bookIdParam = url.searchParams.get("bookId");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "200"),
      200,
    );
    const offset = parseInt(url.searchParams.get("offset") || "0");

    if (!q.trim()) {
      return json({ error: "Missing search query" }, { status: 400 });
    }

    const cid = cidParam ? parseInt(cidParam) : undefined;
    const bookId = bookIdParam ? parseInt(bookIdParam) : undefined;
    const isCJKQuery = hasCJK(q);

    // ── Try KV cache first ──
    if (kv) {
      const cacheKey = buildCacheKey({ q, lang, cid, bookId, limit, offset });
      const cached = await getFromCache(kv, cacheKey);
      if (cached) {
        console.log("[search] KV cache hit:", cacheKey);
        return json(cached);
      }
    }

    const params = [];
    const joins = [];
    const whereConditions = [];

    // Language filtering (always present)
    whereConditions.push("cp.lang_code = ?");
    params.push(lang);

    if (isCJKQuery) {
      // ── Chinese search: use LIKE instead of FTS5 ──
      // FTS5's unicode61 tokenizer cannot correctly split Chinese text;
      // consecutive Chinese characters are treated as a single token,
      // causing significant phrase matching misses. While LIKE lacks index acceleration,
      // combined with rowid range pruning + other indexes, it's more accurate for Chinese.
      whereConditions.push("cp.text_content LIKE ?");
      params.push(`%${q}%`);
    } else {
      // ── Non-Chinese (English etc.): use FTS5 ──
      const matchStr = buildFtsMatch(q);
      if (!matchStr) {
        return json({ error: "Invalid search terms" }, { status: 400 });
      }
      joins.push(`JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid`);
      whereConditions.push(`chapter_paragraphs_fts MATCH ?`);
      params.push(matchStr);
    }

    // ── rowid range pruning (optional) ──
    if (cid !== undefined || bookId !== undefined) {
      const range = await getRowidRange(db, { lang, cid, bookId });
      if (range) {
        whereConditions.push("cp.rowid >= ? AND cp.rowid <= ?");
        params.push(range.minRowid, range.maxRowid);
      }
    }

    // ── Additional filter conditions ──
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

    // ORDER BY: Chinese uses rowid (original order), non-Chinese uses fts.rank (relevance)
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
    // Remove redundant _total field from each row
    for (const r of results) delete r._total;

    const response = { total, results, hasMore };

    // ── Store in KV cache (fire-and-forget; don't block response) ──
    if (kv) {
      const cacheKey = buildCacheKey({ q, lang, cid, bookId, limit, offset });
      // Write asynchronously to not delay response
      setToCache(kv, cacheKey, response).catch((e) =>
        console.warn("[search] KV cache write error:", e.message),
      );
    }

    return json(response);
  } catch (e) {
    return json(
      { error: "Search failed", details: e.message },
      { status: 500 },
    );
  }
}
