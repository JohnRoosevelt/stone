use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Read-write split database state.
/// - read_conn: independent Mutex-guarded read connection (non-blocking concurrent reads under WAL)
/// - write_conn: independent Mutex-guarded write connection (serialized writes)
///
/// SQLite WAL mode: reads do not block writes, and writes do not block reads.
pub struct DbState {
    pub read_conn: Arc<Mutex<Connection>>,
    pub write_conn: Arc<Mutex<Connection>>,
    pub db_path: PathBuf,
}

// ── Data models ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct Book {
    pub cid: i64,
    pub book_id: i64,
    pub name: String,
    pub title: Option<String>,
    pub abbreviation: Option<String>,
    pub section: Option<String>,
    pub featured: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct Chapter {
    pub chapter_id: i64,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct Paragraph {
    pub id: i64,
    pub num: Option<i64>,
    pub text_content: String,
    pub format: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub rowid: i64,
    pub cid: i64,
    pub book_id: i64,
    pub chapter_id: i64,
    pub id: i64,
    pub num: Option<i64>,
    pub text_content: String,
    pub format: Option<i64>,
    pub lang_code: String,
    pub chapter_title: String,
    pub book_name: String,
}

// ── New data models ─────────────────────────────────────────

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct Annotation {
    pub id: Option<i64>,
    pub cid: i64,
    pub book_id: i64,
    pub chapter_id: i64,
    pub lang_code: String,
    pub p_index: i64,
    pub start_offset: i64,
    pub length: i64,
    pub text: String,
    pub ann_type: String, // "underline-wavy", "underline", "bg", "text"
    pub color: String,
    pub created_at: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct ReadingProgress {
    pub id: Option<i64>,
    pub cid: i64,
    pub book_id: i64,
    pub lang_code: String,
    pub chapter_id: i64,
    pub scroll_percentage: i64,
    pub updated_at: Option<String>,
}

/// Initialize the database: create tables and FTS5 indexes.
/// Returns (write_conn, read_conn) for read-write split.
pub fn init_database(db_path: &PathBuf) -> Result<(Connection, Connection)> {
    // Write connection: handles DDL/DML changes
    let write_conn = Connection::open(db_path)?;
    write_conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    write_conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    write_conn.execute_batch(
        "
        -- book_base: language-independent book metadata
        CREATE TABLE IF NOT EXISTS book_base (
            cid       INTEGER NOT NULL,
            book_id   INTEGER NOT NULL,
            section   TEXT,
            featured  INTEGER,
            PRIMARY KEY (cid, book_id)
        ) STRICT, WITHOUT ROWID;

        -- book_i18n: book names / titles in multiple languages
        CREATE TABLE IF NOT EXISTS book_i18n (
            cid          INTEGER NOT NULL,
            book_id      INTEGER NOT NULL,
            lang_code    TEXT    NOT NULL,
            name         TEXT    NOT NULL,
            title        TEXT,
            abbreviation TEXT,
            PRIMARY KEY (cid, book_id, lang_code),
            FOREIGN KEY (cid, book_id) REFERENCES book_base(cid, book_id) ON DELETE CASCADE
        ) STRICT, WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_book_i18n_lookup ON book_i18n(lang_code, cid, book_id);

        -- chapters
        CREATE TABLE IF NOT EXISTS chapters (
            cid        INTEGER NOT NULL,
            book_id    INTEGER NOT NULL,
            chapter_id INTEGER NOT NULL,
            lang_code  TEXT    NOT NULL,
            title      TEXT    NOT NULL,
            PRIMARY KEY (cid, book_id, chapter_id, lang_code),
            FOREIGN KEY (cid, book_id, lang_code)
                REFERENCES book_i18n(cid, book_id, lang_code) ON DELETE CASCADE
        ) STRICT, WITHOUT ROWID;
        CREATE INDEX IF NOT EXISTS idx_chapters_lookup ON chapters(lang_code, cid, book_id);

        -- chapter_paragraphs: core paragraph data
        CREATE TABLE IF NOT EXISTS chapter_paragraphs (
            cid             INTEGER NOT NULL,
            book_id         INTEGER NOT NULL,
            chapter_id      INTEGER NOT NULL,
            id              INTEGER NOT NULL,
            num             INTEGER DEFAULT NULL,
            lang_code       TEXT    NOT NULL,
            text_content    TEXT    NOT NULL,
            format          INTEGER DEFAULT NULL,
            PRIMARY KEY (cid, book_id, chapter_id, id, lang_code),
            FOREIGN KEY (cid, book_id, chapter_id, lang_code)
                REFERENCES chapters(cid, book_id, chapter_id, lang_code) ON DELETE CASCADE
        ) STRICT;
        CREATE INDEX IF NOT EXISTS idx_paragraphs_lookup ON chapter_paragraphs(lang_code, book_id, chapter_id);
        CREATE INDEX IF NOT EXISTS idx_paragraphs_cid_book ON chapter_paragraphs(cid, book_id);

        -- FTS5 full-text search
        CREATE VIRTUAL TABLE IF NOT EXISTS chapter_paragraphs_fts USING fts5(
            text_content,
            content='chapter_paragraphs'
        );

        -- FTS sync triggers
        CREATE TRIGGER IF NOT EXISTS trg_paragraphs_ai AFTER INSERT ON chapter_paragraphs BEGIN
            INSERT INTO chapter_paragraphs_fts(rowid, text_content)
            VALUES (new.rowid, new.text_content);
        END;

        CREATE TRIGGER IF NOT EXISTS trg_paragraphs_ad AFTER DELETE ON chapter_paragraphs BEGIN
            INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
            VALUES('delete', old.rowid, old.text_content);
        END;

        CREATE TRIGGER IF NOT EXISTS trg_paragraphs_au AFTER UPDATE ON chapter_paragraphs BEGIN
            INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
            VALUES('delete', old.rowid, old.text_content);
            INSERT INTO chapter_paragraphs_fts(rowid, text_content)
            VALUES (new.rowid, new.text_content);
        END;
        "
    )?;

    // app_flags: application flags (e.g. initial import completion marker)
    write_conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS app_flags (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        ) STRICT, WITHOUT ROWID;",
    )?;

    // annotations: text marks (underline, highlight, background, text color)
    write_conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS annotations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            cid         INTEGER NOT NULL,
            book_id     INTEGER NOT NULL,
            chapter_id  INTEGER NOT NULL,
            lang_code   TEXT    NOT NULL,
            p_index     INTEGER NOT NULL,
            start_offset INTEGER NOT NULL,
            length      INTEGER NOT NULL,
            text        TEXT    NOT NULL,
            ann_type    TEXT    NOT NULL,
            color       TEXT    NOT NULL,
            created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        ) STRICT;
        CREATE INDEX IF NOT EXISTS idx_annotations_lookup ON annotations(cid, book_id, chapter_id, lang_code);",
    )?;

    // reading_progress: reading progress per book
    write_conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS reading_progress (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            cid               INTEGER NOT NULL,
            book_id           INTEGER NOT NULL,
            lang_code         TEXT    NOT NULL,
            chapter_id        INTEGER NOT NULL,
            scroll_percentage INTEGER NOT NULL DEFAULT 0,
            updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
            UNIQUE(cid, book_id, lang_code)
        ) STRICT;",
    )?;

    // Read connection: open the same database read-only for WAL concurrency
    let read_conn = Connection::open(db_path)?;
    read_conn.execute_batch("PRAGMA query_only=ON;")?;

    Ok((write_conn, read_conn))
}

/// Get all books for a given language, optionally filtered by CID
pub fn get_books(conn: &Connection, lang: &str, cid: Option<i64>) -> Result<Vec<Book>> {
    let mut sql = String::from(
        "SELECT i.cid, i.book_id, i.name, i.title, i.abbreviation, b.section, b.featured
         FROM book_i18n i
         JOIN book_base b ON i.cid = b.cid AND i.book_id = b.book_id
         WHERE i.lang_code = ?1",
    );
    if cid.is_some() {
        sql.push_str(" AND i.cid = ?2");
    }
    sql.push_str(" ORDER BY i.cid, i.book_id");

    let mut stmt = conn.prepare(&sql)?;

    // Use dynamic params to avoid closure type mismatch
    let params: Vec<Box<dyn rusqlite::types::ToSql>> = if let Some(cid_val) = cid {
        vec![Box::new(lang.to_string()), Box::new(cid_val)]
    } else {
        vec![Box::new(lang.to_string())]
    };
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(Book {
            cid: row.get(0)?,
            book_id: row.get(1)?,
            name: row.get(2)?,
            title: row.get(3)?,
            abbreviation: row.get(4)?,
            section: row.get(5)?,
            featured: row.get(6)?,
        })
    })?;

    let mut books = Vec::new();
    for row in rows {
        books.push(row?);
    }
    Ok(books)
}

/// Get chapters for a given book
pub fn get_chapters(conn: &Connection, cid: i64, book_id: i64, lang: &str) -> Result<Vec<Chapter>> {
    let mut stmt = conn.prepare(
        "SELECT chapter_id, title
         FROM chapters
         WHERE cid = ?1 AND book_id = ?2 AND lang_code = ?3
         ORDER BY chapter_id",
    )?;

    let rows = stmt.query_map(params![cid, book_id, lang], |row| {
        Ok(Chapter {
            chapter_id: row.get(0)?,
            title: row.get(1)?,
        })
    })?;

    let mut chapters = Vec::new();
    for row in rows {
        chapters.push(row?);
    }
    Ok(chapters)
}

/// Get paragraphs for a given chapter
pub fn get_paragraphs(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang: &str,
) -> Result<Vec<Paragraph>> {
    let mut stmt = conn.prepare(
        "SELECT id, num, text_content, format
         FROM chapter_paragraphs
         WHERE cid = ?1 AND book_id = ?2 AND chapter_id = ?3 AND lang_code = ?4
         ORDER BY id",
    )?;

    let rows = stmt.query_map(params![cid, book_id, chapter_id, lang], |row| {
        Ok(Paragraph {
            id: row.get(0)?,
            num: row.get(1)?,
            text_content: row.get(2)?,
            format: row.get(3)?,
        })
    })?;

    let mut paragraphs = Vec::new();
    for row in rows {
        paragraphs.push(row?);
    }
    Ok(paragraphs)
}

/// Check whether the query string contains CJK characters
fn has_cjk(s: &str) -> bool {
    s.chars().any(|c| {
        let cp = c as u32;
        (cp >= 0x4E00 && cp <= 0x9FFF)
            || (cp >= 0x3400 && cp <= 0x4DBF)
            || (cp >= 0x2E80 && cp <= 0x2EFF)
            || (cp >= 0x3000 && cp <= 0x303F)
    })
}

/// Build an FTS5 MATCH query (for non-CJK text)
fn build_fts_match(raw: &str) -> String {
    let cleaned: String = raw.chars().filter(|c| !r#"*"()+~^"#.contains(*c)).collect();
    let words: Vec<&str> = cleaned
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .collect();
    if words.is_empty() {
        return String::new();
    }
    words
        .iter()
        .map(|w| format!("\"{}\"", w))
        .collect::<Vec<_>>()
        .join(" AND ")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FullParagraph {
    pub c: String,
    pub p: Option<i64>,
    pub t: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FullChapter {
    pub n: String,
    pub ps: Vec<FullParagraph>,
}

/// Get the full book content (chapters + paragraphs) in the same format as R2 parquet
/// Lightweight struct for initial import: book ID and name only
#[derive(Debug, Serialize)]
pub struct BookForImport {
    pub cid: i64,
    pub book_id: i64,
    pub name: String,
}

pub fn get_full_book(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    lang: &str,
) -> Result<Vec<FullChapter>> {
    let mut ch_stmt = conn.prepare(
        "SELECT chapter_id, title FROM chapters WHERE cid=?1 AND book_id=?2 AND lang_code=?3 ORDER BY chapter_id"
    )?;
    let ch_rows = ch_stmt.query_map(params![cid, book_id, lang], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut chapters = Vec::new();
    for ch in ch_rows {
        let (ch_id, title) = ch?;
        let mut p_stmt = conn.prepare(
            "SELECT id, num, text_content, format FROM chapter_paragraphs WHERE cid=?1 AND book_id=?2 AND chapter_id=?3 AND lang_code=?4 ORDER BY id"
        )?;
        let p_rows = p_stmt.query_map(params![cid, book_id, ch_id, lang], |row| {
            Ok(FullParagraph {
                c: row.get::<_, String>(2)?,
                p: row.get::<_, Option<i64>>(1)?,
                t: row.get::<_, Option<i64>>(3)?,
            })
        })?;
        let mut ps = Vec::new();
        for p in p_rows {
            ps.push(p?);
        }
        chapters.push(FullChapter { n: title, ps });
    }
    Ok(chapters)
}

/// Save pre-parsed chapter data from the frontend to SQLite.
/// When append=false, old data is cleared before writing.
/// start_chapter_id: chapter ID offset for chunked imports.
pub fn save_book(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    lang: &str,
    chapters: Vec<FullChapter>,
    append: bool,
    start_chapter_id: i64,
) -> Result<(i64, i64), String> {
    if !append {
        conn.execute(
            "DELETE FROM chapter_paragraphs WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
            params![cid, book_id, lang],
        )
        .map_err(|e| format!("delete cp: {e}"))?;
        conn.execute(
            "DELETE FROM chapters WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
            params![cid, book_id, lang],
        )
        .map_err(|e| format!("delete ch: {e}"))?;
    }

    let mut ch_count = 0i64;
    let mut p_count = 0i64;
    for (idx, ch) in chapters.iter().enumerate() {
        let chapter_id = start_chapter_id + idx as i64;
        conn.execute(
            "INSERT OR REPLACE INTO chapters (cid,book_id,chapter_id,lang_code,title) VALUES (?1,?2,?3,?4,?5)",
            params![cid, book_id, chapter_id, lang, &ch.n],
        ).map_err(|e| format!("insert ch: {e}"))?;
        ch_count += 1;
        for (i, p) in ch.ps.iter().enumerate() {
            conn.execute(
                "INSERT OR REPLACE INTO chapter_paragraphs (cid,book_id,chapter_id,id,num,lang_code,text_content,format) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
                params![cid, book_id, chapter_id, (i + 1) as i64, p.p, lang, &p.c, p.t],
            ).map_err(|e| format!("insert cp: {e}"))?;
            p_count += 1;
        }
    }
    Ok((ch_count, p_count))
}

/// Check whether a book has chapter data in the local database
pub fn has_book_data(conn: &Connection, cid: i64, book_id: i64, lang: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM chapters WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
        params![cid, book_id, lang],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

/// Delete a book's local data (paragraphs + chapters)
pub fn delete_book_data(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    lang: &str,
) -> Result<(), String> {
    conn.execute(
        "DELETE FROM chapter_paragraphs WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
        params![cid, book_id, lang],
    )
    .map_err(|e| format!("e: {e}"))?;
    conn.execute(
        "DELETE FROM chapters WHERE cid=?1 AND book_id=?2 AND lang_code=?3",
        params![cid, book_id, lang],
    )
    .map_err(|e| format!("e: {e}"))?;
    Ok(())
}

/// 搜索
/// Check whether the initial import needs to run.
///
/// Returns true when:
/// - book_base has metadata (seed completed), AND
/// - `initial_import_done` flag is NOT set to "1".
///
/// This means it will also return true after a crash mid-import
/// (partially imported books + flag still "0"), allowing the
/// first-launch UI to resume and fill in the gaps.
pub fn needs_initial_import(conn: &Connection) -> Result<bool> {
    let has_books: i64 = conn
        .query_row("SELECT COUNT(*) FROM book_base", [], |row| row.get(0))
        .unwrap_or(0);
    if has_books == 0 {
        return Ok(false);
    }
    // Only skip if the flag is explicitly "1" (fully done)
    let flag: String = conn
        .query_row(
            "SELECT value FROM app_flags WHERE key='initial_import_done'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_default();
    Ok(flag != "1")
}

/// 标记首次导入已完成
pub fn mark_import_complete(conn: &Connection) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_flags (key, value) VALUES ('initial_import_done', '1')",
        [],
    )?;
    Ok(())
}

/// Reset the initial-import flag so the first-launch UI triggers again.
pub fn reset_import_flag(conn: &Connection) -> Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO app_flags (key, value) VALUES ('initial_import_done', '0')",
        [],
    )?;
    Ok(())
}

/// Get all book IDs that already have chapter data for a given language.
/// Used by the first-launch UI to skip already-imported books.
pub fn get_imported_book_ids(conn: &Connection, lang: &str) -> Result<Vec<(i64, i64)>> {
    let mut stmt = conn.prepare("SELECT DISTINCT cid, book_id FROM chapters WHERE lang_code=?1")?;
    let rows = stmt.query_map(params![lang], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
    })?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

/// Get book list for initial import (all books regardless of import status).
pub fn get_all_books_for_import(conn: &Connection, lang: &str) -> Result<Vec<(i64, i64, String)>> {
    let mut stmt = conn.prepare(
        "SELECT bb.cid, bb.book_id, bi.name
         FROM book_base bb
         JOIN book_i18n bi ON bi.cid = bb.cid AND bi.book_id = bb.book_id
         WHERE bi.lang_code = ?1
         ORDER BY bb.cid, bb.book_id",
    )?;
    let rows = stmt.query_map(params![lang], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;
    let mut result = Vec::new();
    for r in rows {
        result.push(r?);
    }
    Ok(result)
}

pub fn search(
    conn: &Connection,
    q: &str,
    lang: &str,
    cid: Option<i64>,
    limit: i64,
    offset: i64,
) -> Result<(Vec<SearchResult>, i64)> {
    let is_cjk = has_cjk(q);
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    let (where_clause, from_clause, order_clause) = if is_cjk {
        // CJK: use LIKE
        let mut where_sql = format!(
            "WHERE cp.lang_code = ?{} AND cp.text_content LIKE ?{}",
            params_vec.len() + 1,
            params_vec.len() + 2
        );
        params_vec.push(Box::new(lang.to_string()));
        params_vec.push(Box::new(format!("%{}%", q)));

        // CID filtering
        if let Some(c) = cid {
            where_sql.push_str(&format!(" AND cp.cid = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(c));
        }

        (
            where_sql,
            "FROM chapter_paragraphs cp".to_string(),
            "ORDER BY cp.cid, cp.book_id, cp.rowid".to_string(),
        )
    } else {
        // Non-CJK: use FTS5
        let match_str = build_fts_match(q);
        let mut where_sql = format!(
            "WHERE cp.lang_code = ?{} AND chapter_paragraphs_fts MATCH ?{}",
            params_vec.len() + 1,
            params_vec.len() + 2
        );
        params_vec.push(Box::new(lang.to_string()));
        params_vec.push(Box::new(match_str));

        // CID filtering
        if let Some(c) = cid {
            where_sql.push_str(&format!(" AND cp.cid = ?{}", params_vec.len() + 1));
            params_vec.push(Box::new(c));
        }

        (
            where_sql,
            "FROM chapter_paragraphs cp JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid"
                .to_string(),
            "ORDER BY cp.cid, cp.book_id, fts.rank".to_string(),
        )
    };

    let full_sql = format!(
        "SELECT cp.rowid, cp.cid, cp.book_id, cp.chapter_id, cp.id, cp.num,
                cp.text_content, cp.format, cp.lang_code,
                ch.title AS chapter_title, bi.name AS book_name
         {}
         JOIN chapters ch
           ON ch.cid = cp.cid AND ch.book_id = cp.book_id
          AND ch.chapter_id = cp.chapter_id AND ch.lang_code = cp.lang_code
         JOIN book_i18n bi
           ON bi.cid = cp.cid AND bi.book_id = cp.book_id AND bi.lang_code = cp.lang_code
         {}
         {}
         LIMIT ?{} OFFSET ?{}",
        from_clause,
        where_clause,
        order_clause,
        params_vec.len() + 1,
        params_vec.len() + 2
    );

    // Query total count first
    let count_sql = format!(
        "SELECT COUNT(*) FROM chapter_paragraphs cp {} {}",
        if is_cjk {
            ""
        } else {
            "JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid"
        },
        where_clause
    );

    let total: i64 = {
        let mut stmt = conn.prepare(&count_sql)?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        stmt.query_row(params_refs.as_slice(), |row| row.get(0))?
    };

    // Query paginated results
    let mut stmt = conn.prepare(&full_sql)?;
    let params_refs: Vec<&dyn rusqlite::types::ToSql> = {
        let mut p: Vec<&dyn rusqlite::types::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        p.push(&limit);
        p.push(&offset);
        p
    };

    let rows = stmt.query_map(params_refs.as_slice(), |row| {
        Ok(SearchResult {
            rowid: row.get(0)?,
            cid: row.get(1)?,
            book_id: row.get(2)?,
            chapter_id: row.get(3)?,
            id: row.get(4)?,
            num: row.get(5)?,
            text_content: row.get(6)?,
            format: row.get(7)?,
            lang_code: row.get(8)?,
            chapter_title: row.get(9)?,
            book_name: row.get(10)?,
        })
    })?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row?);
    }

    Ok((results, total))
}

/// Get the database file size in bytes
pub fn get_db_size(db_path: &std::path::Path) -> Result<u64, String> {
    std::fs::metadata(db_path)
        .map(|m| m.len())
        .map_err(|e| format!("{e}"))
}

/// Format file size as a human-readable string
pub fn format_size(bytes: u64) -> String {
    if bytes < 1024 {
        return format!("{bytes} B");
    }
    let kb = bytes as f64 / 1024.0;
    if kb < 1024.0 {
        return format!("{:.1} KB", kb);
    }
    let mb = kb / 1024.0;
    format!("{:.1} MB", mb)
}

// ── Annotations ──────────────────────────────────────────────────

pub fn save_annotation(conn: &Connection, ann: &Annotation) -> Result<i64, String> {
    let sql = "INSERT INTO annotations (cid, book_id, chapter_id, lang_code, p_index, start_offset, length, text, ann_type, color)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)";
    conn.execute(
        sql,
        params![
            ann.cid,
            ann.book_id,
            ann.chapter_id,
            ann.lang_code,
            ann.p_index,
            ann.start_offset,
            ann.length,
            ann.text,
            ann.ann_type,
            ann.color
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_annotation(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM annotations WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_annotations(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    chapter_id: i64,
    lang_code: &str,
) -> Result<Vec<Annotation>, String> {
    let sql = "SELECT id, cid, book_id, chapter_id, lang_code, p_index, start_offset, length, text, ann_type, color, created_at
               FROM annotations
               WHERE cid = ?1 AND book_id = ?2 AND chapter_id = ?3 AND lang_code = ?4
               ORDER BY id";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![cid, book_id, chapter_id, lang_code], |row| {
            Ok(Annotation {
                id: Some(row.get(0)?),
                cid: row.get(1)?,
                book_id: row.get(2)?,
                chapter_id: row.get(3)?,
                lang_code: row.get(4)?,
                p_index: row.get(5)?,
                start_offset: row.get(6)?,
                length: row.get(7)?,
                text: row.get(8)?,
                ann_type: row.get(9)?,
                color: row.get(10)?,
                created_at: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

// ── Reading Progress ────────────────────────────────────────────

pub fn save_reading_progress(conn: &Connection, rp: &ReadingProgress) -> Result<(), String> {
    let sql =
        "INSERT INTO reading_progress (cid, book_id, lang_code, chapter_id, scroll_percentage)
               VALUES (?1, ?2, ?3, ?4, ?5)
               ON CONFLICT(cid, book_id, lang_code) DO UPDATE SET
                   chapter_id = excluded.chapter_id,
                   scroll_percentage = excluded.scroll_percentage,
                   updated_at = datetime('now')";
    conn.execute(
        sql,
        params![
            rp.cid,
            rp.book_id,
            rp.lang_code,
            rp.chapter_id,
            rp.scroll_percentage
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_reading_progress(
    conn: &Connection,
    cid: i64,
    book_id: i64,
    lang_code: &str,
) -> Result<Option<ReadingProgress>, String> {
    let sql = "SELECT id, cid, book_id, lang_code, chapter_id, scroll_percentage, updated_at
               FROM reading_progress
               WHERE cid = ?1 AND book_id = ?2 AND lang_code = ?3";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(params![cid, book_id, lang_code], |row| {
            Ok(ReadingProgress {
                id: Some(row.get(0)?),
                cid: row.get(1)?,
                book_id: row.get(2)?,
                lang_code: row.get(3)?,
                chapter_id: row.get(4)?,
                scroll_percentage: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(Ok(rp)) => Ok(Some(rp)),
        Some(Err(e)) => Err(e.to_string()),
        None => Ok(None),
    }
}

pub fn get_all_reading_progress(conn: &Connection) -> Result<Vec<ReadingProgress>, String> {
    let sql = "SELECT id, cid, book_id, lang_code, chapter_id, scroll_percentage, updated_at
               FROM reading_progress ORDER BY updated_at DESC";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ReadingProgress {
                id: Some(row.get(0)?),
                cid: row.get(1)?,
                book_id: row.get(2)?,
                lang_code: row.get(3)?,
                chapter_id: row.get(4)?,
                scroll_percentage: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}
