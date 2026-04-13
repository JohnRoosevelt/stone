// Search utility - full-text search across all cached books
import { search } from "$lib/db/dbManager.js";

/**
 * Search for a keyword across all cached books
 * @param {string} keyword - Search term
 * @param {object} options
 * @param {string} options.cid - Filter by cid (bible/sda/book)
 * @param {number} options.limit - Max results (default 50)
 * @returns {Promise<Array>} Array of { cid, bookId, chapterId, title, snippet }
 */
export async function searchText(keyword, { cid = null, limit = 50 } = {}) {
  try {
    const results = await search(keyword, cid, limit);
    return results;
  } catch (err) {
    console.error("[Search] Error:", err);
    return [];
  }
}

/**
 * Get all cached books
 */
export async function getCachedBooks() {
  const { getCachedBooks: _getCachedBooks } = await import("$lib/db/dbManager.js");
  try {
    return await _getCachedBooks();
  } catch (err) {
    console.error("[DB] Failed to get cached books:", err);
    return [];
  }
}
