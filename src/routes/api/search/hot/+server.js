import { json } from "@sveltejs/kit";
import { getTopSearchTerms } from "$lib/server/searchCache.js";

/**
 * GET /api/search/hot
 *
 * Returns hot search keywords ranked by actual user search frequency.
 * Data comes from KV where search terms are recorded and aggregated.
 * Returns an empty array if no search data has been recorded yet.
 *
 * Response format:
 *   Array<{ text: string, count: number }>
 */
export async function GET({ platform }) {
  try {
    const kv = platform?.env?.STONE_SEARCH_CACHE;

    if (kv) {
      const topTerms = await getTopSearchTerms(kv, 16);
      return json(topTerms);
    }

    // KV not available
    return json([]);
  } catch (e) {
    console.warn("[hotKeywords] Error:", e.message);
    return json([]);
  }
}
