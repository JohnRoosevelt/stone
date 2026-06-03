//! Schema bootstrap: create tables, indexes, and FTS5 sync triggers.

use rusqlite::{Connection, Result};
use std::path::PathBuf;

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
        ",
    )?;

    // app_flags: application flags (e.g. initial import completion marker)
    write_conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS app_flags (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        ) STRICT, WITHOUT ROWID;",
    )?;

    // annotations: text marks (underline, highlight, background, text color).
    //
    // New schema (per-segment → per-paragraph): one row per paragraph. The
    // `segments` column stores a JSON array of {start, end, style, color}
    // entries, where start/end are character offsets into the paragraph text.
    //
    // Per the spec, we ignore previous "dirty" data and don't try to migrate
    // it: the old `annotations` table (one row per marked span with ann_type
    // as a string column) is dropped on init. Users will lose old highlights
    // but keep the new clean shape.
    write_conn.execute_batch(
        "DROP TABLE IF EXISTS annotations;
         CREATE TABLE annotations (
             id          INTEGER PRIMARY KEY AUTOINCREMENT,
             cid         INTEGER NOT NULL,
             book_id     INTEGER NOT NULL,
             chapter_id  INTEGER NOT NULL,
             lang_code   TEXT    NOT NULL,
             p_index     INTEGER NOT NULL,
             segments    TEXT    NOT NULL DEFAULT '[]',
             updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
             UNIQUE (cid, book_id, chapter_id, lang_code, p_index)
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
            updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
        ) STRICT;
        CREATE INDEX IF NOT EXISTS idx_progress_lookup ON reading_progress(lang_code, cid, book_id);",
    )?;

    // Read connection: separate handle so reads can run concurrent with writes
    let read_conn = Connection::open(db_path)?;
    read_conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    Ok((write_conn, read_conn))
}
