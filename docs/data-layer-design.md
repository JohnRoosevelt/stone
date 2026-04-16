# Data Layer Architecture Design

## Overview

Three data loading strategies, unified through a single interface:

| Strategy | Environment | Storage | Use Case |
|----------|-------------|---------|----------|
| **R2 Direct** | PWA / SPA | Network + HTTP cache | No OPFS browsers, simple deployment |
| **Tauri + SQLx** | Tauri desktop/mobile | Native SQLite via Rust | Native app with full DB power |
| **SQLite-WASM + OPFS** | Modern browsers | OPFS (Origin Private File System) | Offline-first PWA |

## Current State Analysis

### How data flows now

```
Route load() → fetch(`${R2}/{cid}/{lang}/{bookId}.json`) → parse → render
```

- `+layout.js` fetches book directory from R2 (server-side or client)
- `+page.js` extracts chapter data from the directory JSON
- `.svelte` files render `page.data.chapterZh` / `page.data.chapterZh`

### SQLite worker (exists but not wired into routes)

```
dbManager → sqlite.worker.js → OPFS DB
```

- Full CRUD API exists: `seedBook`, `getChapter`, `getBookDir`, `search`
- FTS5 virtual table schema (commented out in worker)
- Seeding utility exists in `seed.js`
- **Not connected to route loaders yet**

## Unified Interface Design

### Core Interface

```js
// src/lib/data/provider.js

/**
 * @typedef {Object} Chapter
 * @property {number|string} id
 * @property {string} title
 * @property {Array} content  // verses or paragraphs
 */

/**
 * @typedef {Object} BookDirEntry
 * @property {number|string} id
 * @property {string} n      // name
 * @property {Array} [verses] // bible only
 * @property {Array} [ps]     // sda/book only
 */

/**
 * Data provider interface
 */
export const DataProvider = {
  /** Initialize (async, may load DB, connect to backend, etc.) */
  async init() {},

  /** Get book directory */
  async getDir(cid, bookId, lang = "zh") {
    // returns BookDirEntry[]
  },

  /** Get single chapter */
  async getChapter(cid, bookId, chapterId) {
    // returns Chapter
  },

  /** Full-text search */
  async search(keyword, { cid, limit }) {
    // returns { cid, bookId, chapterId, title, snippet }[]
  },

  /** Seed a book into local storage (if applicable) */
  async seedBook(cid, bookId, onProgress) {},

  /** Check if book is locally available */
  async isCached(cid, bookId) {
    return false; // always false for R2-only provider
  },

  /** Delete a book from local storage */
  async deleteBook(cid, bookId) {},

  /** List all locally cached books */
  async getCachedBooks() {
    return [];
  },
};
```

### Provider Factory

```js
// src/lib/data/providerFactory.js

import { browser } from "$app/environment";
import { createR2Provider } from "./providers/r2.js";
import { createTauriProvider } from "./providers/tauri.js";
import { createWasmOpfsProvider } from "./providers/wasmOpfs.js";

export function createProvider() {
  // 1. Check Tauri environment
  if (browser && window.__TAURI__) {
    console.log("[Provider] Using Tauri + SQLx backend");
    return createTauriProvider();
  }

  // 2. Check OPFS support
  if (browser && hasOPFS()) {
    console.log("[Provider] Using SQLite-WASM + OPFS");
    return createWasmOpfsProvider();
  }

  // 3. Fallback to R2 direct
  console.log("[Provider] Using R2 direct (no local storage)");
  return createR2Provider();
}

function hasOPFS() {
  try {
    return (
      "SharedArrayBuffer" in window &&
      "navigator" in window &&
      "storage" in navigator &&
      "getDirectory" in navigator.storage
    );
  } catch {
    return false;
  }
}
```

## Provider Implementations

### 1. R2 Direct Provider

```js
// src/lib/data/providers/r2.js

import { PUBLIC_R2 } from "$env/static/public";
import bible from "$lib/bible/bible.json";
import sda from "$lib/sda/sda.json";
import book from "$lib/book/book.json";

const ALL_BOOKS = { bible, sda, book };

export function createR2Provider() {
  return {
    async init() {
      console.log("[R2] Provider initialized");
      return { strategy: "r2", hasLocal: false };
    },

    async getDir(cid, bookId, lang = "zh") {
      const res = await fetch(`${PUBLIC_R2}/${cid}/${lang}/${bookId}.json`);
      if (!res.ok) throw new Error(`Failed to fetch ${cid}/${bookId}`);
      return res.json();
    },

    async getChapter(cid, bookId, chapterId) {
      // Fetch entire book dir (already cached by browser HTTP cache)
      const dir = await this.getDir(cid, bookId);
      return dir[chapterId - 1];
    },

    async search() {
      // Not supported in R2-only mode (would require fetching all books)
      console.warn("[R2] Search not available");
      return [];
    },

    async seedBook() {
      console.warn("[R2] Seeding not available");
    },

    async isCached() {
      return false;
    },

    async deleteBook() {},
    async getCachedBooks() {
      return [];
    },
  };
}
```

### 2. Tauri + SQLx Provider

```js
// src/lib/data/providers/tauri.js

import { invoke } from "@tauri-apps/api/core";

export function createTauriProvider() {
  return {
    async init() {
      const info = await invoke("db_init");
      console.log("[Tauri] DB initialized:", info);
      return { strategy: "tauri", ...info };
    },

    async getDir(cid, bookId) {
      return invoke("db_get_book_dir", { cid, bookId });
    },

    async getChapter(cid, bookId, chapterId) {
      return invoke("db_get_chapter", { cid, bookId, chapterId });
    },

    async search(keyword, { cid, limit }) {
      return invoke("db_search", { keyword, cid, limit });
    },

    async seedBook(cid, bookId, onProgress) {
      // Fetch from R2, send to Rust backend
      const { PUBLIC_R2 } = await import("$env/static/public");
      const res = await fetch(`${PUBLIC_R2}/meta/${cid}/${bookId}.json`);
      const meta = await res.json();
      return invoke("db_seed_book", {
        cid,
        bookId,
        name: meta.name,
        tag: meta.tag,
        chapters: meta.chapters,
      });
    },

    async isCached(cid, bookId) {
      return invoke("db_is_book_cached", { cid, bookId });
    },

    async deleteBook(cid, bookId) {
      return invoke("db_delete_book", { cid, bookId });
    },

    async getCachedBooks() {
      return invoke("db_get_cached_books");
    },
  };
}
```

**Required Rust backend** (`src-tauri/src/db.rs`):

```rust
use sqlx::SqlitePool;
use tauri::State;

pub struct DbState(pub SqlitePool);

#[tauri::command]
pub async fn db_init(state: State<'_, DbState>) -> Result<serde_json::Value, String> {
    // Run migrations
    sqlx::query!(
        r#"
        CREATE TABLE IF NOT EXISTS books (
            cid TEXT NOT NULL, book_id TEXT NOT NULL, name TEXT, tag TEXT,
            PRIMARY KEY (cid, book_id)
        )
        "#
    )
    .execute(&state.0)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query!(
        r#"
        CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cid TEXT NOT NULL, book_id TEXT NOT NULL, chapter_id INTEGER NOT NULL,
            title TEXT, content TEXT,
            UNIQUE(cid, book_id, chapter_id)
        )
        "#
    )
    .execute(&state.0)
    .await
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({ "version": "1.0", "strategy": "sqlx" }))
}

#[tauri::command]
pub async fn db_get_book_dir(
    state: State<'_, DbState>,
    cid: String,
    book_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let rows = sqlx::query!(
        "SELECT chapter_id, title FROM chapters WHERE cid = ? AND book_id = ? ORDER BY chapter_id",
        cid, book_id
    )
    .fetch_all(&state.0)
    .await
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| serde_json::json!({
        "chapterId": r.chapter_id,
        "title": r.title
    })).collect())
}

#[tauri::command]
pub async fn db_get_chapter(
    state: State<'_, DbState>,
    cid: String,
    book_id: String,
    chapter_id: i64,
) -> Result<Option<serde_json::Value>, String> {
    let row = sqlx::query!(
        "SELECT chapter_id, title, content FROM chapters WHERE cid = ? AND book_id = ? AND chapter_id = ?",
        cid, book_id, chapter_id
    )
    .fetch_optional(&state.0)
    .await
    .map_err(|e| e.to_string())?;

    Ok(row.map(|r| serde_json::json!({
        "id": r.chapter_id,
        "title": r.title,
        "content": r.content
    })))
}

#[tauri::command]
pub async fn db_search(
    state: State<'_, DbState>,
    keyword: String,
    cid: Option<String>,
    limit: i64,
) -> Result<Vec<serde_json::Value>, String> {
    // FTS5 search (requires FTS virtual table setup)
    // Simplified LIKE search for now
    let rows = if let Some(cid) = cid {
        sqlx::query!(
            "SELECT c.cid, c.book_id as bookId, c.chapter_id as chapterId, c.title,
             c.content as snippet
             FROM chapters c
             WHERE c.cid = ? AND (c.title LIKE ? OR c.content LIKE ?)
             LIMIT ?",
            cid,
            format!("%{}%", keyword),
            format!("%{}%", keyword),
            limit
        )
        .fetch_all(&state.0)
        .await
        .map_err(|e| e.to_string())?
    } else {
        sqlx::query!(
            "SELECT cid, book_id as bookId, chapter_id as chapterId, title,
             content as snippet
             FROM chapters
             WHERE title LIKE ? OR content LIKE ?
             LIMIT ?",
            format!("%{}%", keyword),
            format!("%{}%", keyword),
            limit
        )
        .fetch_all(&state.0)
        .await
        .map_err(|e| e.to_string())?
    };

    Ok(rows.into_iter().map(|r| serde_json::json!({
        "cid": r.cid,
        "bookId": r.bookId,
        "chapterId": r.chapterId,
        "title": r.title,
        "snippet": r.snippet
    })).collect())
}

// ... seed_book, is_book_cached, delete_book, get_cached_books
```

### 3. SQLite-WASM + OPFS Provider

```js
// src/lib/data/providers/wasmOpfs.js

import {
  initSQLite,
  getBookDir,
  getChapter,
  search as dbSearch,
  seedBook,
  isBookCached,
  deleteBook,
  getCachedBooks,
} from "$lib/db/dbManager.js";
import { PUBLIC_R2 } from "$env/static/public";

export function createWasmOpfsProvider() {
  return {
    async init() {
      const info = await initSQLite();
      console.log("[OPFS] SQLite initialized:", info);
      return { strategy: "opfs", ...info };
    },

    async getDir(cid, bookId) {
      // Try local first
      const cached = await this.isCached(cid, bookId);
      if (cached) {
        return getBookDir(cid, bookId);
      }
      // Fallback to R2 + seed
      return this.seedAndReturn(cid, bookId);
    },

    async getChapter(cid, bookId, chapterId) {
      const cached = await this.isCached(cid, bookId);
      if (cached) {
        return getChapter(cid, bookId, chapterId);
      }
      // Fallback: fetch from R2 directly
      return this.fetchChapterFromR2(cid, bookId, chapterId);
    },

    async search(keyword, options) {
      return dbSearch(keyword, options);
    },

    async seedBook(cid, bookId, onProgress) {
      const dir = await this.fetchBookDirFromR2(cid, bookId);
      const chapters = dir.map((ch, idx) => ({
        chapterId: idx + 1,
        title: ch.n || ch.id || `Chapter ${idx + 1}`,
        content: JSON.stringify(ch),
      }));
      return seedBook(cid, bookId, "", "", chapters);
    },

    async isCached(cid, bookId) {
      return isBookCached(cid, bookId);
    },

    async deleteBook(cid, bookId) {
      return deleteBook(cid, bookId);
    },

    async getCachedBooks() {
      return getCachedBooks();
    },

    // Internal helpers
    async fetchBookDirFromR2(cid, bookId, lang = "zh") {
      const res = await fetch(`${PUBLIC_R2}/${cid}/${lang}/${bookId}.json`);
      if (!res.ok) throw new Error(`Failed to fetch ${cid}/${bookId}`);
      return res.json();
    },

    async fetchChapterFromR2(cid, bookId, chapterId) {
      const dir = await this.fetchBookDirFromR2(cid, bookId);
      return dir[chapterId - 1];
    },

    async seedAndReturn(cid, bookId) {
      try {
        await this.seedBook(cid, bookId);
      } catch (e) {
        console.warn("[OPFS] Seed failed, falling back to R2:", e);
        return this.fetchBookDirFromR2(cid, bookId);
      }
      return getBookDir(cid, bookId);
    },
  };
}
```

## Integration with Routes

### Updated `+layout.js`

```js
// src/routes/(pub)/[cid]/[bookId]/+layout.js

import { createProvider } from "$lib/data/providerFactory.js";

export async function load({ params: { cid, bookId } }) {
  const provider = createProvider();
  const info = await provider.init();

  const book = await getBookMeta(cid, bookId);
  const dirZh = await provider.getDir(cid, bookId, "zh");

  return { book, dirZh, strategy: info.strategy };
}
```

### Updated `+page.js`

```js
// src/routes/(pub)/[cid]/[bookId]/[chapterId]/+page.js

import { createProvider } from "$lib/data/providerFactory.js";

export async function load({ parent, params: { cid, bookId, chapterId } }) {
  const provider = createProvider();
  const { book } = await parent();

  const chapterData = await provider.getChapter(cid, bookId, chapterId);

  let titleZh, chapterZh;
  if (cid === "bible") {
    titleZh = chapterData.id;
    chapterZh = chapterData.verses;
  } else {
    titleZh = chapterData.n;
    chapterZh = chapterData.ps;
  }

  return { titleZh, chapterZh };
}
```

## Decision Flowchart

```
App starts
    │
    ├─ Is window.__TAURI__ defined?
    │   └─ YES → Tauri + SQLx provider
    │              → Rust backend handles all DB operations
    │              → Native SQLite, full FTS, no browser limits
    │
    ├─ Does browser support OPFS + SharedArrayBuffer?
    │   └─ YES → SQLite-WASM + OPFS provider
    │              → Client-side SQLite in OPFS
    │              → Offline-first, seed-on-demand
    │
    └─ Otherwise → R2 Direct provider
                   → All data from Cloudflare R2
                   → Browser HTTP cache only
                   → No offline, no search
```

## Migration Path

### Phase 1: Keep current R2 behavior (no change)
- Routes work exactly as they do now
- Provider factory returns `r2` by default

### Phase 2: Wire in OPFS provider
- `dbManager` + `sqlite.worker.js` already exist
- Uncomment FTS5 schema in worker
- Connect provider to routes
- Add "Download for offline" UI

### Phase 3: Add Tauri support (when needed)
- Create `src-tauri/` with Rust backend
- Implement SQLx commands
- Provider factory auto-detects Tauri env

### Phase 4: Unified search UI
- `DataProvider.search()` works across all strategies
- Single search component, different backends

## Key Benefits

| Aspect | R2 Direct | Tauri + SQLx | Wasm + OPFS |
|--------|-----------|--------------|-------------|
| **Offline** | ✗ | ✓ | ✓ |
| **Search** | ✗ | ✓ (FTS5) | ✓ (FTS5) |
| **Setup** | Zero | Rust toolchain | None (WASM) |
| **Performance** | Network | Native | Near-native |
| **Storage limit** | None | Disk size | Browser quota |
| **PWA compatible** | ✓ | N/A (native) | ✓ |
| **Old browsers** | ✓ | N/A | ✗ (fallback to R2) |
