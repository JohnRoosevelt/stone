# Project: 脚前的灯 (Lamp Unto My Feet)

## Tech Stack

- **Framework**: Svelte 5 + SvelteKit (v2.16.0)
- **Build**: Vite 6
- **CSS**: UnoCSS 66 (utility-first, beta)
- **Icons**: @iconify-json/carbon
- **Database**: @sqlite.org/sqlite-wasm (client-side, OPFS)
- **Notifications**: @zerodevx/svelte-toast
- **UA Detection**: ua-parser-js
- **Package Manager**: pnpm

## Project Structure

```
src/
├── routes/
│   ├── (pub)/                    # Public routes
│   │   ├── (home)/               # Homepage - main nav grid
│   │   ├── [cid]/                # Content type: bible | sda | book
│   │   │   ├── (home)/           # Category landing
│   │   │   ├── [bookId]/         # Book layout
│   │   │   │   └── [chapterId]/  # Chapter reading page
│   │   │   │       ├── bible.svelte
│   │   │   │       ├── book.svelte
│   │   │   │       └── sda.svelte
│   │   ├── music/                # Music module
│   │   │   ├── (home)/           # Music category list
│   │   │   └── [uid]/[channelId]/[playlistId]/  # Player page
│   │   └── my/(home)/            # User center / settings
│   └── (UI)/css/                 # UI component dev/test
├── lib/
│   ├── bible/                    # Bible chapter/dir components
│   ├── sda/                      # SDA chapter/dir components
│   ├── book/                     # Book chapter/dir components
│   │   ├── book.json             # Book metadata (id, name, tag)
│   │   └── BookDir.svelte        # Book directory UI
│   ├── cid/                      # Generic content components
│   ├── db/                       # SQLite (worker-based)
│   │   ├── dbManager.js          # Main thread API
│   │   ├── sqlite.worker.js      # Worker implementation
│   │   ├── search.js             # Full-text search
│   │   └── seed.js               # Database seeding
│   ├── parquet.js                # Parquet decoder (WASM + Arrow IPC)
│   ├── global/                   # Shared UI (Dialog, Nav, Footer, Toast)
│   ├── media/                    # AudioPlayer.svelte
│   ├── data.svelte.js            # Global state (DATAS)
│   ├── setTheme.svelte.js        # Theme management
│   ├── wakeLock.js               # Screen wake lock
│   └── pwa.js                    # PWA install helper
├── hooks.server.js               # COOP/COEP headers
├── hooks.client.js               # Client-side hooks
└── service-worker.js             # PWA caching + offline

Docs:
└── docs/
    └── search-implementation-plan.md  # Search feature plan
```

## Core Features

### 1. 圣经 (Bible) - `/bible`
- Book → Chapter → Verse navigation
- Chinese text with verse number annotations
- Sticky verse headers
- Scroll progress indicator
- Mobile chapter directory overlay
- **Data**: `.parquet` on R2, decoded via WASM (`loadParquetContent`)

### 2. 预言之灵/怀著 (SDA) - `/sda`
- Article/chapter reading
- Paragraph type formatting (title, subtitle, body, quote, etc.)
- Sticky section headers
- Same navigation UX as Bible
- **Data**: `.parquet` on R2, decoded via WASM (`loadParquetContent`)

### 3. 音乐 (Music) - `/music`
- Audio player with synchronized lyrics
- Playlist browsing (儿童短讲 series, 24 tracks)
- Playback controls: play/pause, seek, next
- Progress bar with pointer drag
- Auto-scroll to active lyric line
- Source: Cloudflare R2 storage

### 4. 书籍 (Books/Education) - `/book`
- Educational materials browsing
- Same reading UX as Bible/SDA
- **Data**: `.parquet` files on R2, decoded in browser via WASM
  - `src/lib/parquet.js` → `loadParquetContent(cid, bookId)` returns `[{n, ps}, ...]`
  - Uses `parquet-wasm` (Rust WASM, ZSTD support) + `apache-arrow` (IPC parser)

### 5. 用户中心 (My/Profile) - `/my`
- Network status (online/offline, connection type)
- Device info: vendor, model, OS, browser, engine
- SQLite version + OPFS support status

## Global State (`DATAS` in `src/lib/data.svelte.js`)

| Key | Type | Description |
|-----|------|-------------|
| `online` | boolean | Network connectivity |
| `networkType` | string | Connection effective type |
| `isDarkMode` | boolean | Dark theme active |
| `uaInfo` | object | User agent parse result |
| `dbInfo` | object | SQLite init result |
| `fontSize` | number | Reading font size (default 16) |
| `isMobile` | boolean | Viewport < 640px |
| `isFullScreen` | boolean | Fullscreen mode |
| `bg` | string | Custom background color |
| `showSdaEnglish` | boolean | Toggle English in SDA |
| `dialog` | object | Global dialog state |
| `touchInfo` | object | Touch event data |

## Database API (`src/lib/db/dbManager.js`)

Worker-based SQLite with request-response pattern:

| Method | Params | Description |
|--------|--------|-------------|
| `initSQLite()` | - | Initialize DB, returns info |
| `seedBook(cid, bookId, bookName, tag, chapters)` | - | Seed a book into SQLite |
| `isBookCached(cid, bookId)` | - | Check if book exists in cache |
| `getBookDir(cid, bookId)` | - | Get chapter list for a book |
| `getChapter(cid, bookId, chapterId)` | - | Get single chapter content |
| `search(keyword, { cid, limit })` | - | Full-text search |
| `getCachedBooks()` | - | List all cached books |
| `deleteBook(cid, bookId)` | - | Remove a book from cache |

## UI Components

- **NavPC / Nav** - Desktop/mobile navigation
- **HearderPC / Footer / FooterPC** - Layout chrome
- **Dialog / DialogMeta** - Global dialog system
- **RouteLoading** - Route change loading indicator
- **Toast** - Success / Error / Info variants
- **AudioPlayer** - Music player with lyrics sync

## Key Technical Details

- **SSR enabled** by default (fast initial load)
- **COOP/COEP headers** set for SharedArrayBuffer support (needed for SQLite WASM)
- **PWA** with cache-first strategy for static assets, network-first for dynamic
- **Screen wake lock** prevents device sleep during reading
- **UnoCSS** with `flex-cc`, `flex-bc`, `flex-1` etc. utility classes
- **Svelte 5 runes**: `$state`, `$derived`, `$effect`, `$props`

## TODO / Incomplete Features

- **Full-text search** — Phase 1 (uncomment FTS5 schema) next
- Text highlighting/annotation (stubbed in bible.svelte + sda.svelte)
- PWA install prompt (helper exists, not wired into UI)
- SDA English toggle (state exists, not used)
- Database seeding (schema ready, needs wiring)

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm preview      # Preview production build
```
