# Tauri 原生 SQL 迁移方案

> 将客户端 SQLite 从 Web Worker (WASM) 迁移到 Tauri 原生 SQL 插件的完整计划

---

## 1. 背景说明

### 1.1 为什么移除 Web Worker SQLite

Stone 项目最初在客户端使用 `@sqlite.org/sqlite-wasm` 在 Web Worker 中运行 SQLite WASM，配合 OPFS (Origin Private File System) 实现离线缓存和阅读。这套方案存在以下问题：

| 问题                | 说明                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| **跨域隔离限制**    | WASM SQLite 需要 `COOP/COEP` 头部，与第三方资源（如图片 CDN）存在兼容性问题              |
| **OPFS 兼容性**     | OPFS 仅在 Chromium 浏览器中良好支持，Safari/Firefox 表现不稳定                           |
| **Worker 通信开销** | 主线程与 Worker 之间通过 `postMessage` 传递数据，大段文本存在序列化开销                  |
| **双数据库维护**    | Web Worker 中的 SQLite 与服务器 D1 的 schema 需保持同步，增大了维护成本                  |
| **效果有限**        | 离线阅读场景对 Stone 来说并非核心；书籍内容已在服务器端通过 D1 + Cloudflare 全球加速分发 |

### 1.2 迁移目标

- **Web (现有)**: 保持 Cloudflare D1 作为唯一数据源，所有数据通过 `+page.server.js` 和 API 路由加载
- **Tauri (新增)**: 使用 `@tauri-apps/plugin-sql` 访问本地 SQLite，数据从 D1 同步到本地

---

## 2. 技术选型

### 2.1 推荐方案: `@tauri-apps/plugin-sql`

| 特性           | 说明                                              |
| -------------- | ------------------------------------------------- |
| **包名**       | `@tauri-apps/plugin-sql`                          |
| **Tauri 版本** | Tauri v2 (当前最新)                               |
| **底层**       | Tauri Rust 命令 → `rusqlite` crate                |
| **API 风格**   | 类 `better-sqlite3` 的 Promise 风格               |
| **数据库位置** | Tauri 应用数据目录 (`$APPDATA` / `$APP_DATA_DIR`) |
| **类型支持**   | TypeScript 类型声明完整                           |

### 2.2 为什么选它而非继续用 Web Worker

| 对比维度   | Web Worker SQLite         | Tauri plugin-sql              |
| ---------- | ------------------------- | ----------------------------- |
| 数据库引擎 | WASM 编译的 SQLite        | 原生 SQLite (通过 `rusqlite`) |
| 性能       | 受 WASM + Worker 通信限制 | 原生调用，零序列化开销        |
| 文件存储   | OPFS (浏览器沙盒)         | 操作系统文件系统              |
| 可靠性     | 浏览器策略影响大          | 稳定可靠                      |
| FTS5 支持  | 需编译包含 FTS5           | `rusqlite` 默认启用 FTS5      |
| 离线能力   | 依赖浏览器 PWA            | 原生桌面/移动应用，天然离线   |
| 开发体验   | Worker 调试困难           | 标准 Rust + TypeScript 调试   |

### 2.3 替代方案对比

| 方案                              | 优点                     | 缺点                                 |
| --------------------------------- | ------------------------ | ------------------------------------ |
| **`@tauri-apps/plugin-sql`**      | 官方推荐，开箱即用       | 抽象了底层细节，复杂查询需用原始 SQL |
| **自定义 Rust 命令 + `rusqlite`** | 完全控制，可定制复杂逻辑 | 需手写所有 CRUD，重复劳动多          |
| **继续 Web Worker**               | 不改现有代码             | 浏览器兼容性无法解决                 |

**结论**: 使用 `@tauri-apps/plugin-sql` 作为首选方案，对于搜索等复杂操作可以封装 Rust 自定义命令。

---

## 3. 架构设计

### 3.1 整体架构图

```
┌──────────────────────────────────────────────────────────┐
│                    Tauri Desktop App                      │
│                                                           │
│  ┌─────────────┐   ┌────────────────────────────────┐    │
│  │  Svelte UI   │   │    Rust Backend (Tauri)         │   │
│  │              │   │                                  │   │
│  │  invoke() ──────→  Tauri Commands                  │   │
│  │              │   │    ├─ search_books()             │   │
│  │  Frontend    │   │    ├─ sync_book()                │   │
│  │  (WebView)   │   │    ├─ get_chapter()              │   │
│  │              │   │    └─ ...                        │   │
│  └─────────────┘   │         │                         │   │
│                     │         ▼                         │   │
│                     │  ┌──────────────┐                │   │
│                     │  │  plugin-sql   │                │   │
│                     │  │  (rusqlite)   │                │   │
│                     │  └──────┬───────┘                │   │
│                     │         │                         │   │
│                     │         ▼                         │   │
│                     │  ┌──────────────┐                │   │
│                     │  │  local.db     │                │   │
│                     │  │  (SQLite)     │                │   │
│                     │  └──────────────┘                │   │
│                     └──────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                     │
│                                                           │
│  ┌─────────────┐                                         │
│  │  D1 (远程)   │ ←── HTTP API (fetch)                   │
│  └─────────────┘                                         │
└──────────────────────────────────────────────────────────┘
```

### 3.2 数据流向

```
在线场景 (Web / WebView 有网络):
  UI ─→ invoke() ─→ Tauri Command ─→ plugin-sql ─→ local.db
                                    ↑
                                    └── 本地优先，实时响应

  UI ─→ fetch() ─→ /api/* ─→ D1 (用于同步数据到本地)

离线场景 (Tauri 无网络):
  UI ─→ invoke() ─→ Tauri Command ─→ plugin-sql ─→ local.db
```

### 3.3 模块划分

```
src-tauri/
├── src/
│   ├── lib.rs              # Tauri 入口，注册命令
│   ├── db.rs               # 数据库初始化、迁移、连接管理
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── books.rs        # 书籍相关命令
│   │   ├── chapters.rs     # 章节相关命令
│   │   ├── search.rs       # 全文搜索命令
│   │   └── sync.rs         # 数据同步命令
│   └── models.rs           # 数据模型 (serde 序列化)
├── capabilities/
│   └── default.json        # 权限配置
└── Cargo.toml               # 依赖：tauri, tauri-plugin-sql, serde, serde_json
```

---

## 4. 数据表结构

### 4.1 完整 Schema

本地 SQLite 使用与 D1 **完全一致的表结构**，确保数据可互换。

```sql
-- ============================================================
-- Stone Local SQLite Schema (与 D1 一致)
-- ============================================================

-- book_base: 书籍基础信息（语言无关）
CREATE TABLE IF NOT EXISTS book_base (
    cid       INTEGER NOT NULL,  -- 0=bible, 1=sda, 2=book
    book_id   INTEGER NOT NULL,
    section   TEXT,
    featured  INTEGER,
    PRIMARY KEY (cid, book_id)
) STRICT, WITHOUT ROWID;

-- book_i18n: 书籍多语言名称
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

CREATE INDEX IF NOT EXISTS idx_book_i18n_lookup
    ON book_i18n(lang_code, cid, book_id);

-- chapters: 章节表
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

CREATE INDEX IF NOT EXISTS idx_chapters_lookup
    ON chapters(lang_code, cid, book_id);

CREATE INDEX IF NOT EXISTS idx_chapters_book_cid
    ON chapters(book_id, cid);

-- chapter_paragraphs: 段落表（核心数据表）
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

CREATE INDEX IF NOT EXISTS idx_paragraphs_lookup
    ON chapter_paragraphs(lang_code, book_id, chapter_id);

CREATE INDEX IF NOT EXISTS idx_paragraphs_book
    ON chapter_paragraphs(book_id);

CREATE INDEX IF NOT EXISTS idx_paragraphs_cid_book
    ON chapter_paragraphs(cid, book_id);

-- FTS5 全文搜索（本地需要额外创建）
CREATE VIRTUAL TABLE IF NOT EXISTS chapter_paragraphs_fts USING fts5(
    text_content,
    content='chapter_paragraphs',
    content_rowid='rowid'
);

-- FTS 同步触发器
CREATE TRIGGER IF NOT EXISTS trg_paragraphs_ai
    AFTER INSERT ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(rowid, text_content)
    VALUES (new.rowid, new.text_content);
END;

CREATE TRIGGER IF NOT EXISTS trg_paragraphs_ad
    AFTER DELETE ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
    VALUES('delete', old.rowid, old.text_content);
END;

CREATE TRIGGER IF NOT EXISTS trg_paragraphs_au
    AFTER UPDATE ON chapter_paragraphs BEGIN
    INSERT INTO chapter_paragraphs_fts(chapter_paragraphs_fts, rowid, text_content)
    VALUES('delete', old.rowid, old.text_content);
    INSERT INTO chapter_paragraphs_fts(rowid, text_content)
    VALUES (new.rowid, new.text_content);
END;

-- 同步元数据表: 记录每本书的最后同步时间
CREATE TABLE IF NOT EXISTS sync_meta (
    cid          INTEGER NOT NULL,
    book_id      INTEGER NOT NULL,
    synced_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (cid, book_id)
) STRICT, WITHOUT ROWID;
```

### 4.2 与 D1 的唯一区别

| 项目            | D1        | 本地 SQLite                    |
| --------------- | --------- | ------------------------------ |
| `STRICT`        | ✅ 支持   | ✅ 支持                        |
| `WITHOUT ROWID` | ✅ 支持   | ✅ 支持                        |
| FTS5            | ✅ 支持   | ✅ 支持（`rusqlite` 默认开启） |
| `sync_meta` 表  | ❌ 不需要 | ✅ 新增，用于跟踪同步状态      |
| 触发器          | ✅        | ✅ (同上)                      |

---

## 5. API 映射表

### 5.1 旧 Worker API → Tauri 命令映射

| 旧函数 (dbManager)                   | 新 Tauri 命令                         | 说明                                              |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------- |
| `initSQLite()`                       | `tauri-plugin-sql` 自动初始化         | 无需手动初始化，plugin-sql 在首次调用时创建数据库 |
| `seedBook(cid, bookId, ...)`         | `sync_book` (Rust 命令)               | 从 D1 拉取数据写入本地 SQLite                     |
| `isBookCached(cid, bookId)`          | `is_book_synced` (前端直接查询 SQL)   | 查询 `sync_meta` 表                               |
| `getBookDir(cid, bookId)`            | `get_book_dir` (前端直接查询 SQL)     | 查询 `chapters` 表                                |
| `getChapter(cid, bookId, chapterId)` | `get_chapter` (前端直接查询 SQL)      | 查询 `chapters` + `chapter_paragraphs`            |
| `search(keyword, cid, limit)`        | `search_books` (Rust 命令)            | 调用 FTS5，处理高亮片段                           |
| `getCachedBooks()`                   | `get_synced_books` (前端直接查询 SQL) | JOIN `sync_meta` + `book_i18n`                    |
| `deleteBook(cid, bookId)`            | `delete_book` (前端直接查询 SQL)      | `DELETE FROM book_base WHERE ... CASCADE`         |

### 5.2 详细参数映射

#### 前端直接查询 SQL（简单查询，无需 Rust 辅助）

```typescript
// is_book_synced
const synced = await db.select<{ synced_at: string }[]>(
  `SELECT synced_at FROM sync_meta WHERE cid = ? AND book_id = ?`,
  [cid, bookId],
);

// get_book_dir
const dir = await db.select<{ chapter_id: number; title: string }[]>(
  `SELECT chapter_id, title FROM chapters
   WHERE cid = ? AND book_id = ? AND lang_code = 'zh'
   ORDER BY chapter_id`,
  [cid, bookId],
);

// get_chapter
interface GetChapterResult {
  chapter_id: number;
  title: string;
  paragraphs: Array<{
    id: number;
    num: number | null;
    text_content: string;
    format: number | null;
  }>;
}

async function getChapter(cid: number, bookId: number, chapterId: number) {
  const [chapterTitle] = await db.select<{ title: string }[]>(
    `SELECT title FROM chapters
     WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = 'zh'`,
    [cid, bookId, chapterId],
  );

  const paragraphs = await db.select(
    `SELECT id, num, text_content, format
     FROM chapter_paragraphs
     WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = 'zh'
     ORDER BY id`,
    [cid, bookId, chapterId],
  );

  return {
    chapter_id: chapterId,
    title: chapterTitle?.title ?? String(chapterId),
    paragraphs,
  };
}

// get_synced_books
const books = await db.select(
  `SELECT b.cid, b.book_id, i.name, i.title, b.section, b.featured
   FROM sync_meta s
   JOIN book_base b ON b.cid = s.cid AND b.book_id = s.book_id
   JOIN book_i18n i ON i.cid = s.cid AND i.book_id = s.book_id AND i.lang_code = 'zh'
   ORDER BY s.cid, s.book_id`,
);

// delete_book
await db.execute(`DELETE FROM book_base WHERE cid = ? AND book_id = ?`, [
  cid,
  bookId,
]); // CASCADE 自动删除关联表数据
```

#### Rust 自定义命令（复杂操作）

```rust
// sync_book — 需要 HTTP 请求 + 批量写入
// search_books — 需要 FTS5 + 结果格式化
```

---

## 6. 离线缓存策略

### 6.1 核心原则

1. **本地优先**: 启动后尝试读取本地 SQLite，无需等待网络
2. **按需同步**: 仅缓存用户实际阅读的书籍，不批量预加载
3. **增量更新**: 同步时只传输差异数据（通过 `sync_meta` 记录最后同步时间）
4. **静默同步**: 后台进行，不阻塞 UI

### 6.2 同步流程

```
用户点击"下载本书" 或 设置开启"自动同步已读"
         │
         ▼
┌─────────────────────────┐
│ 1. 检查 sync_meta       │
│    是否已同步过？        │
└───────┬────────┬────────┘
        │ 是     │ 否
        ▼        ▼
┌──────────────┐  ┌──────────────────────────────┐
│ 增量同步     │  │ 全量同步                      │
│              │  │                              │
│ GET /api/sync │  │ POST /api/sync/book          │
│ ?since=时间戳│  │ body: { cid, bookId }         │
└──────┬───────┘  └──────────────┬───────────────┘
       │                         │
       ▼                         ▼
┌──────────────────────────────────────┐
│ 2. 服务端返回 JSON 数据               │
│    { book_base, book_i18n,            │
│      chapters, chapter_paragraphs }   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. 批量写入本地 SQLite                │
│    使用事务包裹所有 INSERT            │
│    BEGIN; INSERT ...; INSERT ...;    │
│    COMMIT;                           │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. 更新 sync_meta                    │
│    INSERT OR REPLACE INTO sync_meta  │
└──────────────────────────────────────┘
```

### 6.3 服务端同步 API

```javascript
// src/routes/api/sync/book/+server.js
export async function POST({ request, platform }) {
  const db = getDB(platform);
  const { cid, bookId, lang } = await request.json();

  // 获取书籍数据
  const bookBase = await db
    .prepare(`SELECT * FROM book_base WHERE cid = ? AND book_id = ?`)
    .bind(cid, bookId)
    .first();

  const bookI18n = await db
    .prepare(
      `SELECT * FROM book_i18n WHERE cid = ? AND book_id = ? AND lang_code = ?`,
    )
    .bind(cid, bookId, lang || "zh")
    .all();

  const chapters = await db
    .prepare(
      `SELECT * FROM chapters WHERE cid = ? AND book_id = ? AND lang_code = ? ORDER BY chapter_id`,
    )
    .bind(cid, bookId, lang || "zh")
    .all();

  const paragraphs = await db
    .prepare(
      `SELECT * FROM chapter_paragraphs WHERE cid = ? AND book_id = ? AND lang_code = ? ORDER BY chapter_id, id`,
    )
    .bind(cid, bookId, lang || "zh")
    .all();

  return json({
    bookBase,
    bookI18n: bookI18n.results,
    chapters: chapters.results,
    paragraphs: paragraphs.results,
  });
}
```

### 6.4 Tauri 端同步命令 (Rust)

```rust
// src-tauri/src/commands/sync.rs

use tauri::AppHandle;
use tauri_plugin_sql::MigrationKind;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct SyncBookArgs {
    pub cid: i64,
    pub book_id: i64,
    pub lang: Option<String>,
}

#[derive(Serialize)]
pub struct SyncBookResult {
    pub success: bool,
    pub paragraphs_count: usize,
}

#[tauri::command]
pub async fn sync_book(
    app: AppHandle,
    args: SyncBookArgs,
) -> Result<SyncBookResult, String> {
    let lang = args.lang.unwrap_or_else(|| "zh".to_string());

    // 1. 调用 D1 API 获取数据
    let client = reqwest::Client::new();
    let api_url = format!(
        "https://{}/api/sync/book",
        std::env::var("STONE_API_HOST").unwrap_or_else(|_| "stone.example.com".to_string())
    );

    let resp = client
        .post(&api_url)
        .json(&serde_json::json!({
            "cid": args.cid,
            "bookId": args.book_id,
            "lang": lang,
        }))
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("API response parse failed: {}", e))?;

    // 2. 获取本地 SQLite 连接
    let db = tauri_plugin_sql::Db::connect("sqlite:stone.db")
        .await
        .map_err(|e| format!("DB connect failed: {}", e))?;

    // 3. 事务写入
    db.execute("BEGIN", &[])
        .await
        .map_err(|e| format!("BEGIN failed: {}", e))?;

    // 写入 book_base
    if let Some(base) = data["bookBase"].as_object() {
        db.execute(
            "INSERT OR REPLACE INTO book_base (cid, book_id, section, featured) VALUES (?1, ?2, ?3, ?4)",
            &[
                base["cid"].as_i64().unwrap_or(args.cid).into(),
                base["book_id"].as_i64().unwrap_or(args.book_id).into(),
                base["section"].as_str().unwrap_or("").into(),
                base["featured"].as_i64().unwrap_or(0).into(),
            ],
        ).await.map_err(|e| format!("INSERT book_base failed: {}", e))?;
    }

    // 写入 book_i18n
    if let Some(i18ns) = data["bookI18n"].as_array() {
        for entry in i18ns {
            db.execute(
                "INSERT OR REPLACE INTO book_i18n (cid, book_id, lang_code, name, title, abbreviation) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                &[
                    entry["cid"].as_i64().unwrap_or(0).into(),
                    entry["book_id"].as_i64().unwrap_or(0).into(),
                    entry["lang_code"].as_str().unwrap_or("zh").into(),
                    entry["name"].as_str().unwrap_or("").into(),
                    entry["title"].as_str().unwrap_or("").into(),
                    entry["abbreviation"].as_str().unwrap_or("").into(),
                ],
            ).await.map_err(|e| format!("INSERT book_i18n failed: {}", e))?;
        }
    }

    // 写入 chapters
    if let Some(chapters) = data["chapters"].as_array() {
        for ch in chapters {
            db.execute(
                "INSERT OR REPLACE INTO chapters (cid, book_id, chapter_id, lang_code, title) VALUES (?1, ?2, ?3, ?4, ?5)",
                &[
                    ch["cid"].as_i64().unwrap_or(0).into(),
                    ch["book_id"].as_i64().unwrap_or(0).into(),
                    ch["chapter_id"].as_i64().unwrap_or(0).into(),
                    ch["lang_code"].as_str().unwrap_or("zh").into(),
                    ch["title"].as_str().unwrap_or("").into(),
                ],
            ).await.map_err(|e| format!("INSERT chapters failed: {}", e))?;
        }
    }

    // 写入 chapter_paragraphs
    let paragraphs_count;
    if let Some(paras) = data["paragraphs"].as_array() {
        paragraphs_count = paras.len();
        for p in paras {
            db.execute(
                "INSERT OR REPLACE INTO chapter_paragraphs (cid, book_id, chapter_id, id, num, lang_code, text_content, format) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                &[
                    p["cid"].as_i64().unwrap_or(0).into(),
                    p["book_id"].as_i64().unwrap_or(0).into(),
                    p["chapter_id"].as_i64().unwrap_or(0).into(),
                    p["id"].as_i64().unwrap_or(0).into(),
                    p["num"].as_i64().into(), // 可能为 null
                    p["lang_code"].as_str().unwrap_or("zh").into(),
                    p["text_content"].as_str().unwrap_or("").into(),
                    p["format"].as_i64().into(), // 可能为 null
                ],
            ).await.map_err(|e| format!("INSERT chapter_paragraphs failed: {}", e))?;
        }
    } else {
        paragraphs_count = 0;
    }

    // 更新 sync_meta
    db.execute(
        "INSERT OR REPLACE INTO sync_meta (cid, book_id, synced_at) VALUES (?1, ?2, datetime('now'))",
        &[args.cid.into(), args.book_id.into()],
    ).await.map_err(|e| format!("UPDATE sync_meta failed: {}", e))?;

    db.execute("COMMIT", &[])
        .await
        .map_err(|e| format!("COMMIT failed: {}", e))?;

    Ok(SyncBookResult {
        success: true,
        paragraphs_count,
    })
}
```

### 6.5 前端调用示例

```typescript
// src/lib/tauri/sync.ts
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:stone.db");
  }
  return db;
}

// 同步一本书
export async function syncBook(cid: number, bookId: number, lang = "zh") {
  return invoke("sync_book", { args: { cid, bookId, lang } });
}

// 检查是否已同步
export async function isBookSynced(
  cid: number,
  bookId: number,
): Promise<boolean> {
  const d = await getDb();
  const rows = await d.select<{ synced_at: string }[]>(
    "SELECT synced_at FROM sync_meta WHERE cid = ? AND book_id = ?",
    [cid, bookId],
  );
  return rows.length > 0;
}

// 获取章节目录
export async function getBookDir(cid: number, bookId: number, lang = "zh") {
  const d = await getDb();
  return d.select<Array<{ chapter_id: number; title: string }>>(
    "SELECT chapter_id, title FROM chapters WHERE cid = ? AND book_id = ? AND lang_code = ? ORDER BY chapter_id",
    [cid, bookId, lang],
  );
}

// 获取章节内容
export async function getChapter(
  cid: number,
  bookId: number,
  chapterId: number,
  lang = "zh",
) {
  const d = await getDb();
  const chapters = await d.select<{ title: string }[]>(
    "SELECT title FROM chapters WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = ?",
    [cid, bookId, chapterId, lang],
  );
  const paragraphs = await d.select<
    Array<{
      id: number;
      num: number | null;
      text_content: string;
      format: number | null;
    }>
  >(
    "SELECT id, num, text_content, format FROM chapter_paragraphs WHERE cid = ? AND book_id = ? AND chapter_id = ? AND lang_code = ? ORDER BY id",
    [cid, bookId, chapterId, lang],
  );
  return {
    chapter_id: chapterId,
    title: chapters[0]?.title ?? String(chapterId),
    content: paragraphs,
  };
}

// 获取所有已同步的书籍
export async function getSyncedBooks(lang = "zh") {
  const d = await getDb();
  return d.select(
    `SELECT b.cid, b.book_id, i.name, i.title, b.section
     FROM sync_meta s
     JOIN book_base b ON b.cid = s.cid AND b.book_id = s.book_id
     JOIN book_i18n i ON i.cid = s.cid AND i.book_id = s.book_id AND i.lang_code = ?
     ORDER BY s.cid, s.book_id`,
    [lang],
  );
}

// 删除已同步的书籍
export async function deleteSyncedBook(cid: number, bookId: number) {
  const d = await getDb();
  // CASCADE 会自动删除关联表数据
  await d.execute("DELETE FROM book_base WHERE cid = ? AND book_id = ?", [
    cid,
    bookId,
  ]);
}
```

---

## 7. 生命周期管理

### 7.1 数据库初始化时机

```
┌──────────────────────────────────┐
│ Tauri App 启动                    │
│                                  │
│ 1. app.run() 启动                │
│ 2. setup() 钩子中:               │
│    ├─ 注册 all_commands          │
│    ├─ 插件初始化 (plugin-sql)    │
│    └─ 数据库迁移 (migrations)    │
│                                  │
│ 3. 前端 onMount:                 │
│    ├─ connectDb() 连接 SQLite    │
│    └─ refreshSyncStatus()        │
│       └─ 显示已同步的书籍列表    │
└──────────────────────────────────┘
```

### 7.2 Tauri 启动配置 (Rust)

```rust
// src-tauri/src/lib.rs

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create stone tables",
            sql: include_str!("../migrations/001_init.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:stone.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::sync::sync_book,
            commands::search::search_books,
        ])
        .setup(|app| {
            // 初始化时可以做额外的配置
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 7.3 前端生命周期钩子

```typescript
// src/hooks/tauri.client.ts
import { getDb } from "$lib/tauri/sync";

export async function initDatabase() {
  try {
    await getDb();
    console.log("[tauri] SQLite database connected");
  } catch (e) {
    console.error("[tauri] Database init failed:", e);
  }
}
```

```svelte
<!-- src/routes/+layout.svelte (Tauri 版本) -->
<script>
  import { onMount } from "svelte";
  import { initDatabase } from "$hooks/tauri.client";

  let dbReady = $state(false);

  onMount(async () => {
    await initDatabase();
    dbReady = true;
  });
</script>

{#if !dbReady}
  <div class="loading-screen">
    <span>正在初始化数据库...</span>
  </div>
{:else}
  {@render children()}
{/if}
```

### 7.4 清理时机

| 操作           | 触发时机           | 行为                                |
| -------------- | ------------------ | ----------------------------------- |
| 删除已同步书籍 | 用户点击"删除"     | `DELETE FROM book_base ... CASCADE` |
| 重新同步       | 用户点击"重新下载" | 先 DELETE 再 INSERT                 |
| 清理所有缓存   | 设置页"清理全部"   | `DROP TABLE` 后重新 `CREATE`        |
| 数据库版本升级 | 应用更新           | Tauri Migration 自动执行            |

---

## 8. 搜索实现

### 8.1 FTS5 搜索命令 (Rust)

由于 FTS5 查询需要处理 MATCH 语法、高亮片段和结果格式化，推荐封装为自定义 Rust 命令。

```rust
// src-tauri/src/commands/search.rs

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_sql::Db;

#[derive(Deserialize)]
pub struct SearchArgs {
    pub keyword: String,
    pub cid: Option<i64>,
    pub lang: Option<String>,
    pub limit: Option<i64>,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub cid: i64,
    pub book_id: i64,
    pub chapter_id: i64,
    pub num: Option<i64>,
    pub text_content: String,
    pub snippet: String,
    pub chapter_title: String,
    pub book_name: String,
}

/// 转义 FTS5 特殊字符，并构建 AND 查询
fn build_match_query(raw: &str) -> String {
    let words: Vec<String> = raw
        .replace(|c: char| "*\"()+-~^".contains(c), " ")
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|w| format!("\"{}\"", w))
        .collect();

    if words.is_empty() {
        return String::new();
    }
    words.join(" AND ")
}

#[tauri::command]
pub async fn search_books(
    app: AppHandle,
    args: SearchArgs,
) -> Result<Vec<SearchResult>, String> {
    let lang = args.lang.unwrap_or_else(|| "zh".to_string());
    let limit = args.limit.unwrap_or(50);
    let match_str = build_match_query(&args.keyword);

    if match_str.is_empty() {
        return Err("Invalid search terms".to_string());
    }

    let db = Db::connect("sqlite:stone.db")
        .await
        .map_err(|e| format!("DB connect: {}", e))?;

    // 构建查询
    let mut sql = String::from(
        "SELECT cp.cid, cp.book_id, cp.chapter_id, cp.id, cp.num,
                cp.text_content,
                ch.title AS chapter_title,
                bi.name AS book_name
         FROM chapter_paragraphs cp
         JOIN chapter_paragraphs_fts fts ON fts.rowid = cp.rowid
         JOIN chapters ch
           ON ch.cid = cp.cid
          AND ch.book_id = cp.book_id
          AND ch.chapter_id = cp.chapter_id
          AND ch.lang_code = cp.lang_code
         JOIN book_i18n bi
           ON bi.cid = cp.cid
          AND bi.book_id = cp.book_id
          AND bi.lang_code = cp.lang_code
         WHERE chapter_paragraphs_fts MATCH ?
           AND cp.lang_code = ?"
    );

    let mut params: Vec<tauri_plugin_sql::Value> = vec![
        match_str.clone().into(),
        lang.clone().into(),
    ];

    if let Some(cid) = args.cid {
        sql.push_str(" AND cp.cid = ?");
        params.push(cid.into());

        // rowid 范围优化：提前算出该分类的 rowid 区间
        let range_sql = format!(
            "SELECT MIN(rowid) as min_r, MAX(rowid) as max_r
             FROM chapter_paragraphs
             WHERE lang_code = '{}' AND cid = {}",
            lang, cid
        );
        // 这里简化处理，实际可以用 db.select 获取范围
    }

    sql.push_str(" ORDER BY fts.rank LIMIT ?");
    params.push(limit.into());

    let results: Vec<serde_json::Value> = db
        .select(&sql, &params)
        .await
        .map_err(|e| format!("Search failed: {}", e))?;

    // 转换为 SearchResult（包含 snippet 截取）
    let search_results = results
        .iter()
        .map(|r| {
            let text_content = r["text_content"].as_str().unwrap_or("");
            SearchResult {
                cid: r["cid"].as_i64().unwrap_or(0),
                book_id: r["book_id"].as_i64().unwrap_or(0),
                chapter_id: r["chapter_id"].as_i64().unwrap_or(0),
                num: r.get("num").and_then(|v| v.as_i64()),
                text_content: text_content.to_string(),
                snippet: truncate_with_keyword(text_content, &args.keyword, 100),
                chapter_title: r["chapter_title"].as_str().unwrap_or("").to_string(),
                book_name: r["book_name"].as_str().unwrap_or("").to_string(),
            }
        })
        .collect();

    Ok(search_results)
}

/// 截取关键词附近的内容作为摘要（类似搜索引擎的 snippet）
fn truncate_with_keyword(text: &str, keyword: &str, context_len: usize) -> String {
    let text_lower = text.to_lowercase();
    let kw_lower = keyword.to_lowercase();

    if let Some(pos) = text_lower.find(&kw_lower) {
```
