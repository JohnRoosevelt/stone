// SQLite Database Manager - Main Thread API
// Communicates with sqlite.worker.js via postMessage

let worker = null;
const pendingRequests = new Map();
let requestId = 0;

/**
 * Get or create the SQLite worker
 */
function getWorker() {
  if (!worker) {
    worker = new Worker(
      new URL("./sqlite.worker.js", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (e) => {
      const { type, ...data } = e.data;

      // Check if this is a response to a pending request
      if (type === "response" || data.requestId !== undefined) {
        const id = data.requestId;
        const resolve = pendingRequests.get(id);
        if (resolve) {
          resolve(data);
          pendingRequests.delete(id);
        }
      }

      // Also dispatch event for listeners
      window.dispatchEvent(new CustomEvent("sqlite", { detail: { type, ...data } }));
    };

    worker.onerror = (err) => {
      console.error("[SQLite Worker Error]", err);
      // Reject all pending requests
      for (const [id, reject] of pendingRequests) {
        reject(err);
      }
      pendingRequests.clear();
    };
  }
  return worker;
}

/**
 * Send a message to the worker and wait for response
 */
function send(type, params = {}, waitForResponse = true) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const id = ++requestId;

    if (waitForResponse) {
      pendingRequests.set(id, resolve);
      // Timeout after 30s
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error(`Request ${type} timed out`));
        }
      }, 30000);
    }

    w.postMessage({ type, requestId: id, ...params });
  });
}

/**
 * Initialize the database
 */
export async function initDB() {
  return send("init", {}, false);
}

/**
 * Seed a book with chapters
 */
export async function seedBook(cid, bookId, bookName, tag, chapters) {
  return send("seedBook", { cid, bookId, bookName, tag, chapters });
}

/**
 * Check if a book is cached locally
 */
export async function isBookCached(cid, bookId) {
  const data = await send("isBookCached", { cid, bookId });
  return data.result;
}

/**
 * Get book directory (list of chapters without content)
 */
export async function getBookDir(cid, bookId) {
  const data = await send("getBookDir", { cid, bookId });
  return data.result || [];
}

/**
 * Get single chapter content
 */
export async function getChapter(cid, bookId, chapterId) {
  const data = await send("getChapter", { cid, bookId, chapterId });
  return data.result;
}

/**
 * Full-text search
 */
export async function search(keyword, { cid = null, limit = 50 } = {}) {
  const data = await send("search", { keyword, cid, limit });
  return data.results || [];
}

/**
 * Get all cached books
 */
export async function getCachedBooks() {
  const data = await send("getCachedBooks");
  return data.books || [];
}

/**
 * Delete a cached book
 */
export async function deleteBook(cid, bookId) {
  return send("deleteBook", { cid, bookId });
}

/**
 * Listen for worker events (e.g., seed progress)
 */
export function onEvent(type, callback) {
  const handler = (e) => {
    if (e.detail.type === type) {
      callback(e.detail);
    }
  };
  window.addEventListener("sqlite", handler);
  return () => window.removeEventListener("sqlite", handler);
}
