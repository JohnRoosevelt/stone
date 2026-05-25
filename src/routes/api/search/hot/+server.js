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

    console.log("[hotKeywords] KV available:", !!kv);
    console.log(
      "[hotKeywords] platform.env keys:",
      platform?.env ? Object.keys(platform.env) : "no platform.env",
    );

    if (kv) {
      console.log("[hotKeywords] Calling getTopSearchTerms...");
      const topTerms = await getTopSearchTerms(kv, 16);
      console.log(
        "[hotKeywords] getTopSearchTerms result:",
        JSON.stringify(topTerms),
      );
      return json(topTerms);
    }

    // KV not available
    console.warn(
      "[hotKeywords] KV namespace 'STONE_SEARCH_CACHE' is NOT available on platform.env",
    );
    return json([]);
  } catch (e) {
    console.warn("[hotKeywords] Error:", e.message);
    console.warn("[hotKeywords] Error stack:", e.stack);
    return json([]);
  }
}
