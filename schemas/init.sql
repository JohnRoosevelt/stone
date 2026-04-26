-- Cloudflare D1 Database Schema for Stone Project
-- Bible, SDA, Book 三类书籍的数据库表

-- 书籍目录表 (books)
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cid TEXT NOT NULL,           -- 'bible' | 'sda' | 'book'
  book_id INTEGER NOT NULL,    -- 书籍ID
  name TEXT NOT NULL,          -- 书籍名称 (中文)
  tag TEXT,                    -- 分类标签 (A, B, C, ...)
  title TEXT,                 -- 分类标题 (旧约/新约/布道论/等等)
  chapter_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(cid, book_id)
);

-- 章节内容表 (chapters)
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,   -- 关联 books.book_id
  cid TEXT NOT NULL,           -- 'bible' | 'sda' | 'book'
  chapter_id INTEGER NOT NULL,-- 章节序号 (1, 2, 3, ...)
  title TEXT NOT NULL,        -- 章节标题
  content TEXT NOT NULL,      -- 章节内容 (JSON 格式)
  UNIQUE(cid, book_id, chapter_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_books_cid ON books(cid);
CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id, cid);
CREATE INDEX IF NOT EXISTS idx_chapters_cid_book_chapter ON chapters(cid, book_id, chapter_id);