import { json } from "@sveltejs/kit";
import { recordSearchTerm } from "$lib/server/searchCache.js";

/**
 * GET /api/search/track?q=耶稣
 *
 * Lightweight endpoint to record a search term for hot keyword aggregation.
 * Called by the client after every initial search (regardless of cache hit/miss).
 * No D1 query, no cache lookup — just a KV increment.
 */
export async function GET({ url, platform }) {
  const q = url.searchParams.get("q");
  if (!q?.trim()) return json({ ok: false });

  const kv = platform?.env?.STONE_SEARCH_CACHE;
  if (!kv) return json({ ok: false });

  await recordSearchTerm(kv, q.trim()).catch((e) =>
    console.warn("[track] record error:", e.message),
  );

  return json({ ok: true });
}
