-- Migration number: 0001 	 2026-04-28T06:50:25.300Z
-- Initialize database schema: book_base, book_i18n, chapters, chapter_paragraphs, FTS5

-- ------------------------------------------------------------
-- Book base (language independent)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_base (
    cid       INTEGER NOT NULL,  -- 0=bible, 1=sda, 2=book
    book_id   INTEGER NOT NULL,
    section   TEXT,              -- bible 专用: '旧约'/'新约'
    featured  INTEGER,           -- sda/general: 1=推荐
    PRIMARY KEY (cid, book_id)
) STRICT, WITHOUT ROWID;

-- ------------------------------------------------------------
-- Book i18n (multi-language names, titles, abbreviation)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_i18n (
    cid          INTEGER NOT NULL,
    book_id      INTEGER NOT NULL,
    lang_code    TEXT    NOT NULL,  -- 'zh', 'en'...
    name         TEXT    NOT NULL,
    title        TEXT,              -- group title (e.g., '旧约', 'A', 'B'...)
    abbreviation TEXT,              -- short name, optional
    PRIMARY KEY (cid, book_id, lang_code),
    FOREIGN KEY (cid, book_id) REFERENCES book_base(cid, book_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_book_i18n_lang ON book_i18n(lang_code);

-- ------------------------------------------------------------
-- Chapters
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapters (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    cid        INTEGER NOT NULL,
    book_id    INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL,
    lang_code  TEXT    NOT NULL,
    title      TEXT    NOT NULL,
    UNIQUE(cid, book_id, chapter_id, lang_code),
    FOREIGN KEY (cid, book_id, lang_code)
        REFERENCES book_i18n(cid, book_id, lang_code) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_chapters_book_cid ON chapters(book_id, cid);

-- ------------------------------------------------------------
-- Paragraphs (with redundant book/cid/lang for efficient filtering)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapter_paragraphs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id      INTEGER NOT NULL,
    paragraph_order INTEGER NOT NULL,
    book_id         INTEGER NOT NULL,
    cid             INTEGER NOT NULL,
    lang_code       TEXT    NOT NULL,
    text_content    TEXT    NOT NULL,
    UNIQUE(chapter_id, paragraph_order),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_paragraphs_book ON chapter_paragraphs(book_id);
CREATE INDEX IF NOT EXISTS idx_paragraphs_cid_book ON chapter_paragraphs(cid, book_id);

-- ------------------------------------------------------------
-- Full-text search virtual table (FTS5 supported by D1)
-- ------------------------------------------------------------
CREATE VIRTUAL TABLE IF NOT EXISTS chapter_paragraphs_fts USING fts5(
    text_content,
    content='chapter_paragraphs',
    content_rowid='id'
);

-- ------------------------------------------------------------
-- FTS sync triggers
-- ------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS trg_paragraphs_ai AFTER INSERT ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(rowid, text_content)
    VALUES (new.id, new.text_content);
END;

CREATE TRIGGER IF NOT EXISTS trg_paragraphs_ad AFTER DELETE ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
    VALUES('delete', old.id, old.text_content);
END;

CREATE TRIGGER IF NOT EXISTS trg_paragraphs_au AFTER UPDATE ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
    VALUES('delete', old.id, old.text_content);
    INSERT INTO chapter_paragraphs_fts(rowid, text_content)
    VALUES (new.id, new.text_content);
END;
