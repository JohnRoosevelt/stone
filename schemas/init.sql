-- ============================================================
-- Project Stone: Complete Initialization SQL
-- Tables: book_base, book_i18n, chapters, chapter_paragraphs
-- Includes full Chinese book list with abbreviation support
-- ============================================================

-- Clean up
DROP TABLE IF EXISTS chapter_paragraphs_fts;
DROP TRIGGER IF EXISTS trg_paragraphs_ai;
DROP TRIGGER IF EXISTS trg_paragraphs_ad;
DROP TRIGGER IF EXISTS trg_paragraphs_au;
DROP TABLE IF EXISTS chapter_paragraphs;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS book_i18n;
DROP TABLE IF EXISTS book_base;

-- ============================================================
-- book_base: 书籍基础信息（语言无关）
-- 行数极少（<200），PK 已足够，无需额外索引
-- ============================================================
CREATE TABLE book_base (
    cid       INTEGER NOT NULL,  -- 0=bible, 1=sda, 2=book
    book_id   INTEGER NOT NULL,
    section   TEXT,              -- bible 专用: '旧约'/'新约'
    featured  INTEGER,           -- sda/general: 1=推荐
    PRIMARY KEY (cid, book_id)
) STRICT, WITHOUT ROWID;


-- ============================================================
-- book_i18n: 书籍多语言名称/标题
-- PK: (cid, book_id, lang_code) — 按分类+书+语言精确查找
-- FK: → book_base, CASCADE 删除书时自动清理
-- ============================================================
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

-- idx_book_i18n_lookup: 覆盖最常用的书籍列表查询
--   WHERE lang_code = ? AND cid = ? ORDER BY book_id
--   WHERE lang_code = ?                  ← 前缀匹配
--   WHERE lang_code = ? AND cid = ?      ← 前缀匹配
-- 注：WITHOUT ROWID 表的二级索引存的是 PK 副本，name 不在索引中，仍需回 PK 树
-- 替代原 idx_book_i18n_lang(lang_code)，新增 cid 让分类过滤走索引下推
CREATE INDEX idx_book_i18n_lookup ON book_i18n(lang_code, cid, book_id);


-- ============================================================
-- chapters: 章节表
-- PK: (cid, book_id, chapter_id, lang_code) — 复合自然主键，无需自增 id
-- FK: → book_i18n, CASCADE 删除书籍译本时自动清理
-- WITHOUT ROWID: 省去隐式 rowid，主键即行地址，查询更快
-- ============================================================
CREATE TABLE chapters (
    cid        INTEGER NOT NULL,
    book_id    INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL,
    lang_code  TEXT    NOT NULL,
    title      TEXT    NOT NULL,
    PRIMARY KEY (cid, book_id, chapter_id, lang_code),
    FOREIGN KEY (cid, book_id, lang_code)
        REFERENCES book_i18n(cid, book_id, lang_code) ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

-- idx_chapters_lookup: 覆盖章节列表查询
--   WHERE cid = ? AND book_id = ? AND lang_code = ? ORDER BY chapter_id
--      → 索引 (lang_code, cid, book_id) 可精确命中，但 chapter_id 不在索引中
--      → 只需按 chapter_id 回表排序
--   WHERE cid = ? AND lang_code = ?
--      → 原 PK 无法单独跳跃 lang_code，此索引解决
--   WHERE lang_code = ?
--      → 前缀匹配
CREATE INDEX idx_chapters_lookup ON chapters(lang_code, cid, book_id);

-- idx_chapters_book_cid: 覆盖按书+分类的查询（如管理后台批量操作）
--   WHERE book_id = ? AND cid = ?
CREATE INDEX idx_chapters_book_cid ON chapters(book_id, cid);


-- ============================================================
-- chapter_paragraphs: 段落表（核心数据表，行数最多）
-- PK: (cid, book_id, chapter_id, paragraph_order, lang_code)
--      — 包含 lang_code，确保中英文段落互不覆盖
-- FK: → chapters, CASCADE 删除章节时自动清理段落
-- STRICT: 严格类型约束
-- ============================================================
CREATE TABLE chapter_paragraphs (
    cid             INTEGER NOT NULL,
    book_id         INTEGER NOT NULL,
    chapter_id      INTEGER NOT NULL,
    paragraph_order INTEGER NOT NULL,
    lang_code       TEXT    NOT NULL,
    text_content    TEXT    NOT NULL,
    format          INTEGER DEFAULT NULL,
    PRIMARY KEY (cid, book_id, chapter_id, paragraph_order, lang_code),
    FOREIGN KEY (cid, book_id, chapter_id, lang_code)
        REFERENCES chapters(cid, book_id, chapter_id, lang_code) ON DELETE CASCADE
) STRICT;

-- idx_paragraphs_lookup: 最常用查询 — 查看某语言某本书某章的段落
--   WHERE lang_code = ? AND book_id = ? AND chapter_id = ? ORDER BY paragraph_order
--      → 精确等值命中 3 列，覆盖全部 WHERE 条件，只需按 paragraph_order 排序
--   WHERE lang_code = ? AND book_id = ?                          ← 前缀匹配
--   WHERE lang_code = ?                                          ← 前缀匹配
CREATE INDEX idx_paragraphs_lookup ON chapter_paragraphs(lang_code, book_id, chapter_id);

-- idx_paragraphs_book: 管理操作 — 按书删除/统计
--   WHERE book_id = ?
-- idx_paragraphs_lookup 以 lang_code 开头，无法覆盖独立的 book_id 查询
CREATE INDEX idx_paragraphs_book ON chapter_paragraphs(book_id);

-- idx_paragraphs_cid_book: 管理操作 — 按分类+书批量处理
--   WHERE cid = ? AND book_id = ?
CREATE INDEX idx_paragraphs_cid_book ON chapter_paragraphs(cid, book_id);


-- ============================================================
-- FTS5 全文搜索
-- content='chapter_paragraphs': 外部内容表，数据存主表，FTS 只存索引
-- 隐式 rowid 关联: fts.rowid = chapter_paragraphs.rowid
-- ============================================================
CREATE VIRTUAL TABLE chapter_paragraphs_fts USING fts5(
    text_content,
    content='chapter_paragraphs'
);

-- FTS 同步触发器：段落增/删/改时自动更新 FTS 索引
CREATE TRIGGER trg_paragraphs_ai AFTER INSERT ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(rowid, text_content)
    VALUES (new.rowid, new.text_content);
END;

CREATE TRIGGER trg_paragraphs_ad AFTER DELETE ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
    VALUES('delete', old.rowid, old.text_content);
END;

CREATE TRIGGER trg_paragraphs_au AFTER UPDATE ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
    VALUES('delete', old.rowid, old.text_content);
    INSERT INTO chapter_paragraphs_fts(rowid, text_content)
    VALUES (new.rowid, new.text_content);
END;



-- ============================================================
-- 查询友好度总结
-- ============================================================
--
-- ✅ 最优查询（索引精确覆盖）
--   1) 书籍列表：     SELECT name FROM book_i18n WHERE lang_code='zh' AND cid=0 ORDER BY book_id
--   2) 章节列表：     SELECT chapter_id,title FROM chapters WHERE cid=0 AND book_id=1 AND lang_code='zh' ORDER BY chapter_id
--   3) 段落列表：     SELECT text_content FROM chapter_paragraphs WHERE lang_code='zh' AND book_id=1 AND chapter_id=1 ORDER BY paragraph_order
--   4) 全文搜索：     SELECT cp.* FROM chapter_paragraphs cp JOIN chapter_paragraphs_fts fts ON fts.rowid=cp.rowid WHERE fts MATCH '"耶稣"' AND cp.lang_code='zh'
--   5) 删除章节：     DELETE FROM chapters WHERE cid=0 AND book_id=1 AND chapter_id=1 AND lang_code='zh'  (CASCADE 自动删段落)
--   6) 删除书籍：     DELETE FROM book_base WHERE cid=0 AND book_id=1  (CASCADE 自动删 i18n → chapters → paragraphs → FTS)
--
-- ⚠️ 可行但需回表/扫描（不常用）
--   7) WHERE lang_code='zh' 独立过滤       → 所有 lookup 索引均支持前缀匹配，但需回表取其他列
--   8) WHERE chapter_id=5 独立过滤         → 无 chapter_id 开头索引，全表扫描（行数多时慢）
-- ============================================================
-- End of init.sql
-- ============================================================
