import { dev } from "$app/environment";
// SQLite Database Manager - Main Thread API (Web Worker)
import SQLiteWorker from "./sqlite.worker.js?worker";

let worker = null;
const pendingRequests = new Map();

/**
 * Get or create the SQLite worker
 */
function getWorker() {
  if (!worker) {
    worker = new SQLiteWorker({ type: dev ? "module" : "classic" });

    worker.onmessage = (e) => {
      const { requestId, ...data } = e.data;

      if (data.type === "error") {
        console.error(
          "[dbManager] Worker error:",
          data.error,
          "|",
          data.action,
        );
        return;
      }

      const resolve = pendingRequests.get(requestId);
      if (resolve) {
        resolve(e.data);
        pendingRequests.delete(requestId);
      }
    };

    worker.onerror = (err) => {
      console.error("[dbManager] Worker error event:", err);
      for (const [requestId, reject] of pendingRequests) {
        reject(err);
      }
      pendingRequests.clear();
    };
  }
  return worker;
}

/**
 * Send message to worker
 */
function send(type, args = {}) {
  return new Promise((resolve, reject) => {
    const w = getWorker();
    const requestId = crypto.randomUUID();
    pendingRequests.set(requestId, resolve);

    // Timeout after 30s
    setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error(`Request ${type} timed out`));
      }
    }, 30000);

    w.postMessage({ type, requestId, ...args });
  });
}

/** Initialize */
export async function initSQLite() {
  return send("init");
}

/** Seed a book */
export async function seedBook(cid, bookId, bookName, tag, chapters) {
  return send("seedBook", { cid, bookId, bookName, tag, chapters });
}

/** Check if cached */
export async function isBookCached(cid, bookId) {
  const data = await send("isBookCached", { cid, bookId });
  return data.result;
}

/** Get directory */
export async function getBookDir(cid, bookId) {
  const data = await send("getBookDir", { cid, bookId });
  return data.result || [];
}

/** Get chapter */
export async function getChapter(cid, bookId, chapterId) {
  const data = await send("getChapter", { cid, bookId, chapterId });
  return data.result;
}

/** Full-text search */
export async function search(keyword, { cid = null, limit = 50 } = {}) {
  const data = await send("search", { keyword, cid, limit });
  return data.results || [];
}

/** Get all cached books */
export async function getCachedBooks() {
  const data = await send("getCachedBooks");
  return data.books || [];
}

/** Delete a book */
export async function deleteBook(cid, bookId) {
  return send("deleteBook", { cid, bookId });
}

/** Event listener stub */
export function onEvent(type, callback) {
  const handler = (e) => {
    if (e.detail.type === type) callback(e.detail);
  };
  window.addEventListener("sqlite", handler);
  return () => window.removeEventListener("sqlite", handler);
}
