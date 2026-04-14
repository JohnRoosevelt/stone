import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

const DB_VERSION = 1;
let sqlite3 = null;
let db = null;

// Message handler
self.onmessage = async (e) => {
  const { type, requestId, ...args } = e.data;
  try {
    switch (type) {
      case "init":
        const rz = await initDB();
        postMessage({ type, requestId, ...rz });
        break;
      case "seedBook":
        await seedBook(
          args.cid,
          args.bookId,
          args.bookName,
          args.tag,
          args.chapters,
        );
        break;
      case "isBookCached":
        postMessage({
          type: "isBookCached",
          requestId,
          result: await isBookCached(args.cid, args.bookId),
        });
        break;
      case "getBookDir":
        postMessage({
          type: "bookDir",
          requestId,
          result: await getBookDir(args.cid, args.bookId),
        });
        break;
      case "getChapter":
        postMessage({
          type: "chapter",
          requestId,
          result: await getChapter(args.cid, args.bookId, args.chapterId),
        });
        break;
      case "search":
        postMessage({
          type: "searchResults",
          requestId,
          results: await search(args.keyword, args.cid, args.limit),
        });
        break;
      case "getCachedBooks":
        postMessage({
          type: "cachedBooks",
          requestId,
          books: await getCachedBooks(),
        });
        break;
      case "deleteBook":
        await deleteBook(args.cid, args.bookId);
        break;
      default:
        postMessage({ type: "error", requestId, error: `Unknown: ${type}` });
    }
  } catch (err) {
    console.error("[SQLite-W]", err);
    postMessage({ type: "error", requestId, error: err.message, action: type });
  }
};

/**
 * Initialize SQLite database
 */
async function initDB() {
  console.log("Loading and initializing SQLite3 module...");
  if (db) return;
  try {
    sqlite3 = await sqlite3InitModule();
    const version = sqlite3.version.libVersion;
    console.log("Running SQLite3 version", version);

    const hasOPFS =
      "opfs" in sqlite3 &&
      typeof SharedArrayBuffer !== "undefined" &&
      typeof Atomics !== "undefined";
    console.log("SQLite:", { hasOPFS });

    if (hasOPFS) {
      db = new sqlite3.oo1.OpfsDb("/stone.db");
    } else {
      db = new sqlite3.oo1.DB("/stone.db", "ct");
    }
    console.log("SQLite:", db);
    return { version, hasOPFS };
    // db.exec(`
    //   CREATE TABLE IF NOT EXISTS books (
    //     cid TEXT NOT NULL, bookId TEXT NOT NULL, name TEXT, tag TEXT,
    //     PRIMARY KEY (cid, bookId)
    //   )
    // `);
    // db.exec(`
    //   CREATE TABLE IF NOT EXISTS chapters (
    //     id INTEGER PRIMARY KEY AUTOINCREMENT,
    //     cid TEXT NOT NULL, bookId TEXT NOT NULL, chapterId INTEGER NOT NULL,
    //     title TEXT, content TEXT,
    //     UNIQUE(cid, bookId, chapterId)
    //   )
    // `);
    // db.exec(`
    //   CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(
    //     title, content, content='chapters', content_rowid='id'
    //   )
    // `);
    // db.exec(`CREATE TRIGGER IF NOT EXISTS chapters_ai AFTER INSERT ON chapters
    //   BEGIN INSERT INTO chapters_fts(rowid, title, content)
    //   VALUES (new.id, new.title, new.content); END`);
    // db.exec(`CREATE TRIGGER IF NOT EXISTS chapters_ad AFTER DELETE ON chapters
    //   BEGIN INSERT INTO chapters_fts(chapters_fts, rowid, title, content)
    //   VALUES ('delete', old.id, old.title, old.content); END`);
    // db.exec(`CREATE TRIGGER IF NOT EXISTS chapters_au AFTER UPDATE ON chapters
    //   BEGIN INSERT INTO chapters_fts(chapters_fts, rowid, title, content)
    //   VALUES ('delete', old.id, old.title, old.content);
    //   INSERT INTO chapters_fts(rowid, title, content)
    //   VALUES (new.id, new.title, new.content); END`);
    // db.exec(`PRAGMA user_version = ${DB_VERSION}`);
  } catch (e) {
    console.error("[SQLite-W]", e);
  }
}

/** Seed book */
async function seedBook(cid, bookId, bookName, tag, chapters) {
  if (!db) await initDB();
  db.exec("BEGIN");
  try {
    db.exec(
      `INSERT OR REPLACE INTO books (cid, bookId, name, tag) VALUES ($cid, $bookId, $name, $tag)`,
      { bind: { $cid: cid, $bookId, $name: bookName || "", $tag: tag || "" } },
    );
    db.exec(`DELETE FROM chapters WHERE cid = $cid AND bookId = $bookId`, {
      bind: { $cid: cid, $bookId },
    });
    const stmt = db.prepare(
      `INSERT INTO chapters (cid, bookId, chapterId, title, content) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const ch of chapters) {
      stmt
        .bind([cid, bookId, ch.chapterId, ch.title || "", ch.content || ""])
        .step()
        .reset();
    }
    stmt.finalize();
    db.exec("COMMIT");
    postMessage({ type: "seeded", cid, bookId, chapterCount: chapters.length });
  } catch (err) {
    db.exec("ROLLBACK");
    postMessage({ type: "error", error: err.message });
  }
}

/** Check if book cached */
async function isBookCached(cid, bookId) {
  if (!db) await initDB();
  return (
    db.selectValue(`SELECT COUNT(*) FROM books WHERE cid = ? AND bookId = ?`, {
      bind: [cid, bookId],
    }) > 0
  );
}

/** Get book directory */
async function getBookDir(cid, bookId) {
  if (!db) await initDB();
  return db.selectObjects(
    `SELECT chapterId, title FROM chapters WHERE cid = ? AND bookId = ? ORDER BY chapterId`,
    { bind: [cid, bookId] },
  );
}

/** Get chapter */
async function getChapter(cid, bookId, chapterId) {
  if (!db) await initDB();
  const rows = db.selectObjects(
    `SELECT chapterId, title, content FROM chapters WHERE cid = ? AND bookId = ? AND chapterId = ?`,
    { bind: [cid, bookId, chapterId] },
  );
  return rows[0] || null;
}

/** Full-text search */
async function search(keyword, cid = null, limit = 50) {
  if (!db) await initDB();
  let sql, params;
  if (cid) {
    sql = `SELECT c.cid, c.bookId, c.chapterId, c.title,
      snippet(chapters_fts, 1, '<mark>', '</mark>', '...', 30) as snippet
      FROM chapters_fts JOIN chapters c ON c.id = chapters_fts.rowid
      WHERE c.cid = ? LIMIT ?`;
    params = [cid, limit];
  } else {
    sql = `SELECT c.cid, c.bookId, c.chapterId, c.title,
      snippet(chapters_fts, 1, '<mark>', '</mark>', '...', 30) as snippet
      FROM chapters_fts JOIN chapters c ON c.id = chapters_fts.rowid
      LIMIT ?`;
    params = [limit];
  }
  return db.selectObjects(sql, { bind: params });
}

/** Get cached books */
async function getCachedBooks() {
  if (!db) await initDB();
  return db.selectObjects(
    `SELECT cid, bookId, name, tag FROM books ORDER BY cid, bookId`,
  );
}

/** Delete book */
async function deleteBook(cid, bookId) {
  if (!db) await initDB();
  db.exec(`DELETE FROM chapters WHERE cid = ? AND bookId = ?`, {
    bind: [cid, bookId],
  });
  db.exec(`DELETE FROM books WHERE cid = ? AND bookId = ?`, {
    bind: [cid, bookId],
  });
}
