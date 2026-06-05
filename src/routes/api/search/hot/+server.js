import { json } from "@sveltejs/kit";

/**
 * GET /api/search/hot
 *
 * Returns the top-N most-searched keywords (cumulative counts from
 * `search:count:<lang>:<q>` KV keys).
 *
 * Implementation: KV doesn't have a "scan by prefix" server-side aggregation,
 * so we list keys with the `list()` method and aggregate counts client-side.
 * Acceptable for the modest keyspace we expect (one entry per unique query).
 *
 * Query params:
 *   - limit:    max keywords to return (default 20, max 100)
 *   - lang:     filter by language (default "zh")
 */
export async function GET({ url, platform }) {
  const kv = platform?.env?.STONE_SEARCH_CACHE;
  if (!kv) {
    return json({ error: "KV not configured" }, { status: 503 });
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const lang = url.searchParams.get("lang") || "zh";
  const prefix = `search:count:${lang}:`;

  try {
    const out = [];
    let cursor;
    // Cap pages so a runaway keyspace can't DoS the request
    for (let page = 0; page < 50; page++) {
      const list = await kv.list({ prefix, cursor, limit: 1000 });
      for (const key of list.keys) {
        const q = key.name.slice(prefix.length);
        const cnt = Number((await kv.get(key.name)) || 0);
        if (q) out.push({ q, count: cnt });
      }
      if (!list.list_complete) {
        cursor = list.cursor;
      } else {
        break;
      }
    }

    out.sort((a, b) => b.count - a.count);
    return json({
      lang,
      total: out.length,
      hot: out.slice(0, limit),
    });
  } catch (e) {
    return json(
      { error: "Hot list failed", details: e.message },
      { status: 500 },
    );
  }
}
