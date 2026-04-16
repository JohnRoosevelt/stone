# Search Feature Implementation Plan

## Current Data Status

| Category | Books | R2 Format | Client Decode | Status |
|----------|-------|-----------|---------------|--------|
| **圣经** | 66 | `.parquet` (ZSTD) | ✅ `parquet-wasm` + `apache-arrow` | Browser WASM decode |
| **怀著** | ~175 | `.parquet` (ZSTD) | ✅ `parquet-wasm` + `apache-arrow` | Browser WASM decode |
| **书籍** | 4 | `.parquet` (ZSTD) | ✅ `parquet-wasm` + `apache-arrow` | Browser WASM decode |

**All content uses parquet now** — Bible/SDA/Books all fetch `.parquet` from R2.

**Data pipeline**:
```
R2 .parquet → fetch → parquet-wasm (WASM) → Arrow Table → IPC Stream → apache-arrow → JS objects
```
- `src/lib/parquet.js` → `loadParquetContent(cid, bookId)` returns chapter array
- Route loader (`+layout.js`) always uses parquet — no JSON content fetching
- Book catalogs (`bible.json`, `sda.json`, `book.json`) remain as small metadata lists
- `src/lib/db/seed.js` → uses `loadParquetContent` for seeding SQLite

**Dependencies**:
- `parquet-wasm@0.7.1` — Rust-based WASM Parquet reader (supports ZSTD)
- `apache-arrow@21.1.0` — Arrow IPC parser to convert WASM output to JS objects

---

## Phase 1: Database Schema & Worker

### 1.1 — Uncomment and finalize SQLite schema in `sqlite.worker.js`

**Current state**: Schema is commented out in `initDB()` (~line 67-99).

**Tasks**:
- [ ] Create `books` table: `cid TEXT`, `bookId TEXT`, `name TEXT`, `tag TEXT`, `seededAt TEXT`, `PRIMARY KEY (cid, bookId)`
- [ ] Create `chapters` table: `cid TEXT`, `bookId TEXT`, `chapterId INTEGER`, `title TEXT`, `content TEXT`, `UNIQUE(cid, bookId, chapterId)`
- [ ] Create FTS5: `chapters_fts(title, content, content='chapters', content_rowid='id')`
- [ ] Create 3 triggers: `chapters_ai`, `chapters_ad`, `chapters_au`
- [ ] Set `PRAGMA user_version = 1`

**File**: `src/lib/db/sqlite.worker.js`

### 1.2 — Verify worker search + API

**Current state**: `search()` function exists (~line 170), uses FTS5 `snippet()`. `dbManager.js` proxies correctly.

**Tasks**:
- [ ] Verify — no code changes needed

---

## Phase 2: Book Seeding Strategy

> All content (Bible/SDA/Books) comes from R2 as `.parquet`. Seeding always uses `loadParquetContent()`.

### 2.1 — Seeding scope decision

| Tier | Books | When | How |
|------|-------|------|-----|
| **Essential** | Bible (66) | App first init | Auto-seed in background |
| **Books** | 4 education books | User visits `/book` | Already bundled, seed on first access |
| **SDA** | ~175 books | User reads specific book | Seed on first visit to that book |

### 2.2 — `seed.js` uses parquet loader

**Current state**: `src/lib/db/seed.js` imports `loadParquetContent` from `$lib/parquet`.

**Tasks**:
- [x] Remove old `fetchBookDir` JSON fetch
- [x] Import `loadParquetContent` from `$lib/parquet`
- [x] `seedBookToDB(cid, bookId)` → calls `loadParquetContent(cid, bookId)` → transforms → seeds SQLite
- [x] Remove `fetch` parameter from `seedBookToDB` and `seedAllBooksOfCid` (no longer needed)

### 2.3 — Add `seedingStatus` to global state

**File**: `src/lib/data.svelte.js`

```js
seedingStatus: {
  active: false,
  cid: null,
  bookId: null,
  bookName: null,
  progress: 0,    // chapters seeded
  total: 0,       // total chapters
},
seedingBooks: {},  // { "bible/1": "done", "book/3": "seeding" }
```

### 2.4 — Auto-seed Bible on app init

**File**: `src/routes/+layout.svelte`

**Tasks**:
- [ ] In `onMount`: after `initSQLite()`, check if any Bible book is cached
- [ ] If no Bible books → `seedAllBooksOfCid('bible', onProgress)`
- [ ] Update `DATAS.seedingStatus` during seeding
- [ ] Render `<SeedingProgress />` when `seedingStatus.active === true`

### 2.5 — Auto-seed on book visit

**File**: `src/routes/(pub)/[cid]/[bookId]/+layout.js`

**Tasks**:
- [ ] In `load()`: `isBookCached(cid, bookId)` → if not, call `seedBookToDB(cid, bookId)` before returning
- [ ] This ensures reading always works (auto-seed on first visit)

### 2.6 — Create `SeedingProgress.svelte`

**File**: `src/lib/global/SeedingProgress.svelte` (new)

**Tasks**:
- [ ] Shows: book name, progress bar, chapter count
- [ ] Collapses when done
- [ ] Only visible when `DATAS.seedingStatus.active === true`
- [ ] Place in root layout below nav (or in `Nav.svelte` header area)

---

## Phase 3: Search UI

### 3.1 — Search input component

**File**: `src/lib/search/SearchInput.svelte` (new)

**Tasks**:
- [ ] Text input + search icon
- [ ] Debounced input (300ms)
- [ ] On submit → calls search with keyword
- [ ] "×" clear button
- [ ] Focus/blur styling

### 3.2 — Scope selector

**File**: `src/lib/search/ScopeSelector.svelte` (new)

**Tasks**:
- [ ] Options: 全部 | 圣经 | 怀著 | 书籍 | 本书
- [ ] Each option shows cached count:
  - 圣经 `(66/66 ✓)`
  - 怀著 `(0/175 未下载)`
  - 书籍 `(0/4 未下载)`
- [ ] Get counts from `getCachedBooks()` → group by cid

### 3.3 — Search results component

**File**: `src/lib/search/SearchResults.svelte` (new)

**Tasks**:
- [ ] Display list: `bookName | chapterTitle | snippet` (snippet has `<mark>` from FTS5)
- [ ] Each result → link: `/{cid}/{bookId}/{chapterId}`
- [ ] States:
  - **No results**: "未找到相关内容"
  - **Scope not downloaded**: show scope name + "该分类暂无数据，是否下载？" + [下载] button
  - **R2 mode (no OPFS)**: "当前浏览器不支持离线搜索"
- [ ] Search within selected scope (pass `cid` to `DataProvider.search`)

### 3.4 — Search page route

**Files**:
- `src/routes/(pub)/search/+page.svelte` (new)
- `src/routes/(pub)/search/+page.js` (new)

**Tasks**:
- [ ] Layout: `ScopeSelector` + `SearchInput` + `SearchResults`
- [ ] `+page.js`: load `getCachedBooks()` → populate scope counts
- [ ] Search flow:
  1. User picks scope → check `getCachedBooks()` for that cid
  2. If no data → show download prompt
  3. User clicks [下载] → triggers `seedAllBooks(cid)`
  4. `SeedingProgress` renders inline
  5. After seeding → auto-re-run search with original keyword

### 3.5 — Handle "scope selected but not downloaded" — Search UX Decision

**Problem**: User selects "怀著" scope but SDA books aren't cached yet.

**Design principle**: Show download status in the scope selector. Let user trigger download from search page itself. No page navigation needed.

**Scope selector UI**:

```
┌──────────────────────────────────────┐
│ 搜索范围:                              │
│ ○ 全部 (66/245 已下载)                 │
│ ● 圣经 (66/66 ✓)                      │
│ ○ 怀著 (0/175 未下载)                  │
│ ○ 书籍 (0/4 未下载)                    │
│ ○ 本书: 历代愿望                       │
└──────────────────────────────────────┘
```

**Behavior matrix**:

| Selected scope | Cached? | Action |
|---|---|---|
| **全部** | Partially | Search cached only, show badge: "仅搜索已下载内容" + prompt for each uncached scope |
| **圣经** | Always (auto-seeded) | Search works normally |
| **怀著** | No data | Show "该分类暂无数据，是否下载？" + [下载全部怀著] button |
| **怀著** | Some books | Search those books, show count: "已下载 23/175 本" + [下载更多] |
| **书籍** | No data | Same as 怀著 |
| **本书** | Always (just visited) | Search works normally (auto-seeded on visit) |

**Download flow from search page**:
1. User clicks [下载全部怀著] → triggers `seedAllBooks('sda')`
2. `SeedingProgress` component renders inline (below scope selector)
3. Seeding runs in background — user can continue browsing
4. After seeding → auto-run the pending search
5. Toast notification: "怀著数据下载完成，共 175 本"

**R2-only mode (no OPFS)**:
- Scope selector shows "全部 (仅在线数据)" + disabled state
- Search input shows placeholder: "当前浏览器不支持离线搜索"
- Single message: "搜索功能需要下载书籍到本地，您的浏览器不支持离线存储，请使用现代浏览器访问"

**Tasks**:
- [ ] Scope selector shows cached count per cid: `getCounts()` helper → `{ bible: 66, sda: 0, book: 0 }`
- [ ] If selected scope has no data → show download prompt inline (not a separate page)
- [ ] Download button triggers `seedAllBooks(cid)` with progress callback
- [ ] After download → auto-re-run search with original keyword
- [ ] "全部" scope searches all cached, shows partial results with warning
- [ ] Toast on seeding completion

### 3.6 — Wire search into navigation

**Tasks**:
- [ ] Add search icon/link to `Nav.svelte` → `/search`
- [ ] Add search icon/link to `NavPC.svelte` → `/search`

### 3.7 — Per-book search shortcut

**Tasks**:
- [ ] In `sda.svelte`: add "搜索本书" button in top bar (mobile)
- [ ] In `bible.svelte`: same
- [ ] Navigate to `/search?cid={cid}&bookId={bookId}` → book-scoped search

### 3.8 — Book-scoped search

**Tasks**:
- [ ] If `bookId` in query → search only that book
- [ ] FTS5 supports `WHERE bookId = ?` filter
- [ ] Show "搜索范围: 本书《XXX》" header

---

## Phase 4: R2-only Mode (No OPFS)

### 4.1 — Detect and handle

**Tasks**:
- [ ] In `sqlite.worker.js`: if `hasOPFS === false` → set flag in `DATAS.dbInfo`
- [ ] In `SearchResults.svelte`:
  - If no OPFS → show "搜索功能需要下载书籍到本地，您的浏览器不支持离线存储"
  - No download button (can't seed without OPFS)
- [ ] Scope selector: show disabled state with explanation
- [ ] Reading still works via direct R2 fetch (current behavior)

---

## Phase 5: Edge Cases & Error Handling

### 5.1 — Seeding failure

**Tasks**:
- [ ] Catch error → show toast: "《XXX》下载失败"
- [ ] Retry button
- [ ] Don't block reading → fallback to R2 fetch (for JSON books)

### 5.2 — Database quota exceeded

**Tasks**:
- [ ] Catch in worker → postMessage error type
- [ ] Show toast: "存储空间不足，请清理部分书籍"
- [ ] Future: add "管理缓存" page

### 5.3 — Concurrent seeding

**Tasks**:
- [ ] `isBookCached` check prevents duplicate
- [ ] If already seeding same book → return early (don't double-seed)

---

## File Change Summary

| File | Status | Phase |
|------|--------|-------|
| `src/lib/parquet.js` | ✅ Done — universal `loadParquetContent(cid, bookId)` | — |
| `src/lib/db/sqlite.worker.js` | Edit — uncomment schema | 1.1 |
| `src/lib/db/seed.js` | ✅ Done — uses `loadParquetContent` | 2.2 |
| `src/routes/(pub)/[cid]/[bookId]/+layout.js` | ✅ Done — always uses parquet | — |
| `src/lib/data.svelte.js` | Edit — add `seedingStatus` | 2.3 |
| `src/lib/global/SeedingProgress.svelte` | **New** | 2.6 |
| `src/routes/+layout.svelte` | Edit — auto-seed Bible on init | 2.4 |
| `src/routes/(pub)/[cid]/[bookId]/+layout.js` | Edit — auto-seed on visit | 2.5 |
| `src/lib/search/SearchInput.svelte` | **New** | 3.1 |
| `src/lib/search/ScopeSelector.svelte` | **New** | 3.2 |
| `src/lib/search/SearchResults.svelte` | **New** | 3.3 |
| `src/routes/(pub)/search/+page.svelte` | **New** | 3.4 |
| `src/routes/(pub)/search/+page.js` | **New** | 3.4 |
| `src/lib/global/Nav.svelte` | Edit — add search link | 3.6 |
| `src/lib/global/NavPC.svelte` | Edit — add search link | 3.6 |
| `src/routes/(pub)/[cid]/[bookId]/[chapterId]/sda.svelte` | Edit — add search button | 3.7 |
| `src/routes/(pub)/[cid]/[bookId]/[chapterId]/bible.svelte` | Edit — add search button | 3.7 |
| `src/lib/db/search.js` | Edit — wire to new API | 3.3 |

---

## Implementation Order

```
✅ Done     →  parquet.js (universal loader)
✅ Done     →  seed.js (uses parquet loader)
✅ Done     →  +layout.js (always uses parquet)
Phase 1.1  →  Uncomment SQLite FTS5 schema
Phase 2.3  →  Add seedingStatus to DATAS
Phase 2.5  →  Auto-seed on book visit
Phase 2.4  →  Auto-seed Bible on app init
Phase 2.6  →  SeedingProgress UI
Phase 3.2  →  ScopeSelector component
Phase 3.1  →  SearchInput component
Phase 3.3  →  SearchResults component (with "not downloaded" handling)
Phase 3.4  →  /search route page
Phase 3.6  →  Nav links
Phase 3.7  →  Per-book search shortcut
Phase 3.8  →  Book-scoped search
Phase 4.x   →  No-OPFS handling
Phase 5.x   →  Edge cases
```

---

## Key Decisions

1. **All content is `.parquet`** — Bible, SDA, Books all fetched as `.parquet` from R2
2. **`parquet-wasm` + `apache-arrow`** — browser-side WASM decoding pipeline
3. **`loadParquetContent(cid, bookId)`** — single universal content loader
4. **Book catalogs stay as JSON** — small metadata lists (`bible.json`, etc.) not worth converting
5. **Route loader always uses parquet** — no format branching logic
6. **Seed.js uses same parquet loader** — consistent data source
7. **Content stored as plain text** in SQLite — for FTS5 indexing (future)
8. **Never block reading** — if WASM fails, error gracefully
9. **Scope selector shows download status** — user sees what's cached before searching
10. **Download triggered from search page** — no page navigation needed

---

## Open Questions

1. **Should Bible/SDA also migrate to parquet later?**
   - If yes: need server-side conversion (Cloudflare Worker edge function)
   - If no: current JSON approach is fine
2. **Bible/SDA parquet in future**: would need edge function to convert → JSON, since browser WASM can't decode ZSTD
