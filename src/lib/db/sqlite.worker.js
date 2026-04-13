import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

// Database version - increment to force re-seed
const DB_VERSION = 1;

let sqlite3 = null;
let db = null;

/**
 * Initialize SQLite with OPFS
 */
async function initDB() {
  if (db) return db;

  // Initialize SQLite WASM
  sqlite3 = await sqlite3InitModule({
    print: (text) => console.log("[SQLite]", text),
    printErr: (text) => console.error("[SQLite]", text),
  });

  // Open database on OPFS (persistent storage)
  db = new sqlite3.oo1.OpfsDb("/stone.db");

  // Check version
  const version = db.selectValue("PRAGMA user_version") || 0;

  if (version < DB_VERSION) {
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS books (
        cid TEXT NOT NULL,
        bookId TEXT NOT NULL,
        name TEXT,
        tag TEXT,
        PRIMARY KEY (cid, bookId)
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS chapters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cid TEXT NOT NULL,
        bookId TEXT NOT NULL,
        chapterId INTEGER NOT NULL,
        title TEXT,
        content TEXT,
        UNIQUE(cid, bookId, chapterId)
      )
    `);

    // FTS5 virtual table for full-text search
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chapters_fts USING fts5(
        title,
        content,
        content='chapters',
        content_rowid='id'
      )
    `);

    // Triggers to keep FTS index in sync
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS chapters_ai AFTER INSERT ON chapters BEGIN
        INSERT INTO chapters_fts(rowid, title, content)
        VALUES (new.id, new.title, new.content);
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS chapters_ad AFTER DELETE ON chapters BEGIN
        INSERT INTO chapters_fts(chapters_fts, rowid, title, content)
        VALUES ('delete', old.id, old.title, old.content);
      END
    `);

    db.exec(`
      CREATE TRIGGER IF NOT EXISTS chapters_au AFTER UPDATE ON chapters BEGIN
        INSERT INTO chapters_fts(chapters_fts, rowid, title, content)
        VALUES ('delete', old.id, old.title, old.content);
        INSERT INTO chapters_fts(rowid, title, content)
        VALUES (new.id, new.title, new.content);
      END
    `);

    db.exec(`PRAGMA user_version = ${DB_VERSION}`);
    postMessage({ type: "init", message: "Database schema created" });
  } else {
    postMessage({ type: "init", message: "Database already initialized" });
  }

  return db;
}

/**
 * Seed database with book data
 */
async function seedBook(cid, bookId, bookName, tag, chapters) {
  if (!db) await initDB();

  db.exec("BEGIN");

  try {
    // Insert book
    db.exec(
      `INSERT OR REPLACE INTO books (cid, bookId, name, tag) VALUES ($cid, $bookId, $name, $tag)`,
      { bind: { $cid: cid, $bookId, $name: bookName || "", $tag: tag || "" } },
    );

    // Clear existing chapters for this book
    db.exec(`DELETE FROM chapters WHERE cid = $cid AND bookId = $bookId`, {
      bind: { $cid: cid, $bookId },
    });

    // Insert chapters using prepared statement
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
    postMessage({
      type: "seeded",
      cid,
      bookId,
      chapterCount: chapters.length,
      message: `Seeded ${chapters.length} chapters`,
    });
  } catch (err) {
    db.exec("ROLLBACK");
    postMessage({ type: "error", error: err.message });
  }
}

/**
 * Check if a book is cached
 */
async function isBookCached(cid, bookId) {
  if (!db) await initDB();
  const count =
    db.selectValue(`SELECT COUNT(*) FROM books WHERE cid = ? AND bookId = ?`, {
      bind: [cid, bookId],
    }) || 0;
  return count > 0;
}

/**
 * Get book directory (list of chapters)
 */
async function getBookDir(cid, bookId) {
  if (!db) await initDB();
  return db.selectObjects(
    `SELECT chapterId, title FROM chapters WHERE cid = ? AND bookId = ? ORDER BY chapterId`,
    { bind: [cid, bookId] },
  );
}

/**
 * Get single chapter
 */
async function getChapter(cid, bookId, chapterId) {
  if (!db) await initDB();
  const rows = db.selectObjects(
    `SELECT chapterId, title, content FROM chapters WHERE cid = ? AND bookId = ? AND chapterId = ?`,
    { bind: [cid, bookId, chapterId] },
  );
  return rows[0] || null;
}

/**
 * Full-text search across all books or specific cid
 */
async function search(keyword, cid = null, limit = 50) {
  if (!db) await initDB();

  let sql;
  let params;

  if (cid) {
    sql = `
      SELECT c.cid, c.bookId, c.chapterId, c.title,
             snippet(chapters_fts, 1, '<mark>', '</mark>', '...', 30) as snippet
      FROM chapters_fts
      JOIN chapters c ON c.id = chapters_fts.rowid
      WHERE c.cid = ?
      LIMIT ?
    `;
    params = [cid, limit];
  } else {
    sql = `
      SELECT c.cid, c.bookId, c.chapterId, c.title,
             snippet(chapters_fts, 1, '<mark>', '</mark>', '...', 30) as snippet
      FROM chapters_fts
      JOIN chapters c ON c.id = chapters_fts.rowid
      LIMIT ?
    `;
    params = [limit];
  }

  return db.selectObjects(sql, { bind: params });
}

/**
 * Get cached books list
 */
async function getCachedBooks() {
  if (!db) await initDB();
  return db.selectObjects(
    `SELECT cid, bookId, name, tag FROM books ORDER BY cid, bookId`,
  );
}

/**
 * Delete a cached book
 */
async function deleteBook(cid, bookId) {
  if (!db) await initDB();
  db.exec(`DELETE FROM chapters WHERE cid = ? AND bookId = ?`, {
    bind: [cid, bookId],
  });
  db.exec(`DELETE FROM books WHERE cid = ? AND bookId = ?`, {
    bind: [cid, bookId],
  });
  postMessage({ type: "deleted", cid, bookId });
}

// Message handler
self.onmessage = async (e) => {
  const { type, ...args } = e.data;

  try {
    switch (type) {
      case "init":
        await initDB();
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
        const cached = await isBookCached(args.cid, args.bookId);
        postMessage({
          type: "isBookCached",
          cid: args.cid,
          bookId: args.bookId,
          result: cached,
        });
        break;

      case "getBookDir":
        const dir = await getBookDir(args.cid, args.bookId);
        postMessage({
          type: "bookDir",
          cid: args.cid,
          bookId: args.bookId,
          result: dir,
        });
        break;

      case "getChapter":
        const chapter = await getChapter(args.cid, args.bookId, args.chapterId);
        postMessage({
          type: "chapter",
          cid: args.cid,
          bookId: args.bookId,
          chapterId: args.chapterId,
          result: chapter,
        });
        break;

      case "search":
        const results = await search(args.keyword, args.cid, args.limit);
        postMessage({
          type: "searchResults",
          keyword: args.keyword,
          cid: args.cid,
          results,
        });
        break;

      case "getCachedBooks":
        const books = await getCachedBooks();
        postMessage({ type: "cachedBooks", books });
        break;

      case "deleteBook":
        await deleteBook(args.cid, args.bookId);
        break;

      default:
        postMessage({ type: "error", error: `Unknown message type: ${type}` });
    }
  } catch (err) {
    postMessage({ type: "error", error: err.message, action: type });
  }
};
