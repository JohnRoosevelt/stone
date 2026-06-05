import { json, error } from "@sveltejs/kit";
import { getDB } from "$lib/server/db";

/** 判断是否包含 CJK 中文 */
function hasCJK(str) {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(str);
}

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

function buildFtsMatch(raw) {
  const words = raw
    .replace(/[*"()+\-~^]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  return words.map((w) => `"${w}"`).join(" AND ");
}

// ── KV cache helpers ──────────────────────────────────────────
//
// KV key 格式：
//   search:result:<lang>:<q>:<cid>:<bookId>  → JSON {total, hasMore, results, ts}
//   search:count:<lang>:<q>                 → 数字（真实累计被搜次数，每次 GET 都 +1）
//
// 计数语义：每次 search GET（包括 KV 命中）都 +1，**不设上限**。
// 这反映用户真实查询频率，用于 hot keyword ranking。

const RESULT_TTL_SECONDS = 24 * 60 * 60; // 24h

function resultKey(lang, q, cid, bookId) {
  return `search:result:${lang}:${q}:${cid ?? ""}:${bookId ?? ""}`;
}

function countKey(lang, q) {
  return `search:count:${lang}:${q}`;
}

/** Always bumps the keyword counter — both KV-hit and KV-miss paths call this. */
async function bumpCount(kv, lang, q) {
  if (!kv) return;
  try {
    // KV doesn't have a native INCR; put with read-modify-write. KV is
    // strongly consistent per-key so this is safe.
    const key = countKey(lang, q);
    const cur = (await kv.get(key)) || "0";
    const next = String(Number(cur) + 1);
    // No TTL on counters — they accumulate forever. Cheap (1 byte per key).
    await kv.put(key, next);
  } catch (e) {
    console.warn("[search] count bump failed:", e.message);
  }
}

export async function GET({ url, platform }) {
  const kv = platform?.env?.STONE_SEARCH_CACHE;
  const db = getDB(platform);

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

  // ── 1) Bump the keyword counter (every request, KV hit or miss) ──
  // Fire-and-await: cheap (one KV round-trip), and we want the counter
  // to reflect this request even if the cache write below is dropped.
  await bumpCount(kv, lang, q);

  // ── 2) Try KV cache (first page only — offset=0) ──
  if (kv && offset === 0) {
    try {
      const cached = await kv.get(resultKey(lang, q, cid, bookId), "json");
      if (cached && Array.isArray(cached.results)) {
        return json({
          total: cached.total,
          hasMore: cached.hasMore,
          results: cached.results.slice(0, limit),
          cached: true,
        });
      }
    } catch (e) {
      console.warn("[search] KV read failed:", e.message);
    }
  }

  // ── 3) Miss → query D1 ──
  try {
    const isCJKQuery = hasCJK(q);
    const params = [];
    const joins = [];
    const whereConditions = [];

    whereConditions.push("cp.lang_code = ?");
    params.push(lang);

    if (isCJKQuery) {
      whereConditions.push("cp.text_content LIKE ?");
      params.push(`%${q}%`);
    } else {
      const matchStr = buildFtsMatch(q);
      if (!matchStr) {
        return json({ error: "Invalid search terms" }, { status: 400 });
      }
      joins.push(`JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid`);
      whereConditions.push(`chapter_paragraphs_fts MATCH ?`);
      params.push(matchStr);
    }

    if (cid !== undefined || bookId !== undefined) {
      const range = await getRowidRange(db, { lang, cid, bookId });
      if (range) {
        whereConditions.push("cp.rowid >= ? AND cp.rowid <= ?");
        params.push(range.minRowid, range.maxRowid);
      }
    }

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
    for (const r of results) delete r._total;

    // ── 4) Write to KV cache (first page only, fire-and-forget) ──
    if (kv && offset === 0 && results.length > 0) {
      kv
        .put(
          resultKey(lang, q, cid, bookId),
          JSON.stringify({ total, hasMore, results, ts: Date.now() }),
          { expirationTtl: RESULT_TTL_SECONDS },
        )
        .catch((e) => console.warn("[search] KV write failed:", e.message));
    }

    return json({ total, hasMore, results, cached: false });
  } catch (e) {
    return json(
      { error: "Search failed", details: e.message },
      { status: 500 },
    );
  }
}
