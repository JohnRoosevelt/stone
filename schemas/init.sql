-- ============================================================
-- Project Stone: Complete Initialization SQL
-- Tables: book_base, book_i18n, chapters, chapter_paragraphs
-- Includes full Chinese book list with abbreviation support
-- ============================================================

-- Clean up
DROP TABLE IF EXISTS chapter_paragraphs;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS book_i18n;
DROP TABLE IF EXISTS book_base;
DROP TABLE IF EXISTS chapter_paragraphs_fts;

-- ------------------------------------------------------------
-- Book base info (language independent)
-- ------------------------------------------------------------
CREATE TABLE book_base (
    cid       INTEGER NOT NULL,  -- 0=bible, 1=sda, 2=book
    book_id   INTEGER NOT NULL,
    section   TEXT,              -- bible 专用: '旧约'/'新约'
    featured  INTEGER,           -- sda/general: 1=推荐
    PRIMARY KEY (cid, book_id)
) STRICT, WITHOUT ROWID;


-- ------------------------------------------------------------
-- Book i18n (multi-language names, titles, abbreviation)
-- ------------------------------------------------------------
CREATE TABLE book_i18n (
    cid          INTEGER NOT NULL,
    book_id      INTEGER NOT NULL,
    lang_code    TEXT    NOT NULL,  -- 'zh', 'en'...
    name         TEXT    NOT NULL,
    title        TEXT,              -- group title (e.g., '旧约')
    abbreviation TEXT,              -- short name, optional
    PRIMARY KEY (cid, book_id, lang_code),
    FOREIGN KEY (cid, book_id) REFERENCES book_base(cid, book_id) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- Index for listing books by language
CREATE INDEX idx_book_i18n_lang ON book_i18n(lang_code);

-- ------------------------------------------------------------
-- Chapters
-- ------------------------------------------------------------
CREATE TABLE chapters (
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

CREATE INDEX idx_chapters_book_cid ON chapters(book_id, cid);

-- ------------------------------------------------------------
-- Paragraphs (with redundant book/cid/lang for efficient filtering)
-- ------------------------------------------------------------
CREATE TABLE chapter_paragraphs (
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

CREATE INDEX idx_paragraphs_book ON chapter_paragraphs(book_id);
CREATE INDEX idx_paragraphs_cid_book ON chapter_paragraphs(cid, book_id);

-- ------------------------------------------------------------
-- Full-text search virtual table
-- ------------------------------------------------------------
CREATE VIRTUAL TABLE chapter_paragraphs_fts USING fts5(
    text_content,
    content='chapter_paragraphs',
    content_rowid='id'
);

-- ------------------------------------------------------------
-- FTS sync triggers
-- ------------------------------------------------------------
CREATE TRIGGER trg_paragraphs_ai AFTER INSERT ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(rowid, text_content)
    VALUES (new.id, new.text_content);
END;

CREATE TRIGGER trg_paragraphs_ad AFTER DELETE ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
    VALUES('delete', old.id, old.text_content);
END;

CREATE TRIGGER trg_paragraphs_au AFTER UPDATE ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
    VALUES('delete', old.id, old.text_content);
    INSERT INTO chapter_paragraphs_fts(rowid, text_content)
    VALUES (new.id, new.text_content);
END;



-- ============================================================
-- End of init.sql
-- ============================================================
