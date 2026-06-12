import { json } from "@sveltejs/kit";
import { getTopSearchTerms } from "$lib/server/searchCache.js";

/**
 * GET /api/search/hot/debug
 *
 * Diagnostic endpoint — returns raw KV state so you can see exactly
 * what the hot-keywords endpoint sees, including KV binding status,
 * raw key data, and the processed result side-by-side.
 */
export async function GET({ platform }) {
  const kv = platform?.env?.STONE_SEARCH_CACHE;

  const debug = {
    kvAvailable: !!kv,
    envKeys: platform?.env ? Object.keys(platform.env) : [],
    rawData: null,
    rawDataType: null,
    topTerms: [],
    error: null,
  };

  if (!kv) {
    debug.error = "KV namespace STONE_SEARCH_CACHE is NOT bound to this environment";
    return json(debug);
  }

  try {
    // Read raw KV data directly
    const raw = await kv.get("stone:search:hot:terms", "json");
    debug.rawData = raw;
    debug.rawDataType = typeof raw;

    // Run the normal processing
    debug.topTerms = await getTopSearchTerms(kv, 16);
  } catch (e) {
    debug.error = e.message;
  }

  return json(debug);
}
