/**
 * Books list shared state
 */

/** @type {Array} */
export const books = $state([]);

/** Currently loaded CID (-1 means not loaded) */
let loadedCid = $state(-1);

/**
 * Whether data needs to be loaded for the current CID
 * @param {number} cid
 * @returns {boolean}
 */
export function needsLoad(cid) {
  return loadedCid !== cid;
}

/**
 * Update the books list
 * @param {Array} list
 * @param {number} cid
 */
export function setBooks(list, cid) {
  books.length = 0;
  books.push(...list);
  loadedCid = cid;
}
