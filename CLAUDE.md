# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
bun dev              # Dev server (port 5175)
bun build            # Production build
bun preview          # Preview production build

# Database (local D1 via wrangler)
bun db:init          # Initialize local D1 with schema
bun db:seed          # Seed local D1 with book data
bun db:reset         # Reset + reseed local D1

# Remote database (production D1)
bun db:init:remote
bun db:seed:remote
bun db:reset:remote
```

For Tauri (Android app), configure `TAURI=1` then build with `bun build` (uses `adapter-static`) followed by `bun tauri build`.

## Architecture

**Multi-platform app** — same SvelteKit codebase powers two targets:
- **Web**: Deployed to Cloudflare Pages. Uses `adapter-cloudflare`, D1 (SQLite) for data, KV (`STONE_SEARCH_CACHE`) for search cache/tracking.
- **Tauri (Android)**: Uses `adapter-static` + `@tauri-apps/api`. Rust backend (`src-tauri/`) with bundled rusqlite. Book data imported from R2-hosted Parquet files. TAURI env var switches between adapters at build time.

**Content is organized by CID (category ID)** — `0` = Bible, `1` = SDA/怀著, `2` = Books/书籍. Defined in `src/lib/config.js` along with nav items and home page cards.

### Key data flow

- **Web data**: SvelteKit server-side endpoints (`+server.js` or `+layout.server.js`) query D1 via `platform.env.DB`, returned as JSON. FTS5 for English search, LIKE for Chinese (FTS5 unicode61 can't segment CJK).
- **Tauri data**: Client calls functions in `src/lib/tauri.js`, which check `isTauri()` and route to either Tauri Rust commands (`invoke`) or `/api/` fetch calls.
- **Parquet import**: `src/lib/parquet.js` wraps `parquet-wasm` + `apache-arrow` + zstd-wasm. Used by Tauri for initial data import from R2 (`https://r2.lelexue.cn`), and by admin tools.

### Routes structure

- `(pub)/` — Public content: home page, `[cid]/[bookId]/[chapterId]` reader, search, music, my/settings.
- `api/` — REST endpoints: `api/books`, `api/search`, `api/search/hot`, `api/admin/*`.
- `tools/` — Admin tools: book browser, import, JSON-to-Parquet converter.
- `(test)/` — Test/diagnostic pages (not public).

### Search architecture

`/api/search` uses D1 with FTS5 for English and LIKE for Chinese, plus rowid range pruning for scoped queries (see detailed comment in `src/routes/api/search/+server.js`). Results are cached in Cloudflare KV with permanent TTL (keys prefixed `stone:search:`). Search terms are tracked in KV for hot keyword aggregation (`/api/search/hot`).

### State management

Svelte 5 runes (`$state`) throughout. Global state in `src/lib/data.svelte.js` (theme, network, device, reader settings, UI, dialog, touch) with sub-store files under `src/lib/stores/`. Component-scoped state uses `$state` directly in `.svelte.js` modules (e.g., `booksStore.svelte.js`, `updater.svelte.js`, `searchStore.svelte.js`).

### Styling

UnoCSS with `presetWind4` + `presetMini` + `presetIcons`. Custom icon collection loaded from `static/icons/`. Svelte scoped mode (`@unocss/svelte-scoped`) with `combine: true` in production. Custom utility shortcuts defined in `uno.config.js` (flex layouts, scroll, transitions). Custom rule for `h-view-{n}` (dvh-based heights with safe area insets).

### Auto-update (Android only)

`src/lib/updater.svelte.js` fetches a version manifest from R2 (`apk/update.json`), compares semver against the running app, and opens the APK URL via `@tauri-apps/plugin-shell` `open()` for installation. Shared between `Updater.svelte` banner and settings page.

## Cross-cutting design principles (hard rules)

These are user-stated invariants. **Do not violate them when refactoring** — always confirm with the user first.

### 1. Web reader — single R2 read per book, never per-chapter

`src/routes/(pub)/[cid]/[bookId]/+layout.js` (web branch) and `[chapterId]/+page.js` use `loadR2Parquet()` to fetch the **entire book** from R2 on the book page, then `[chapterId]/+page.js` reads the chapter in-memory via `parent().chapters[chapterId - 1]`.

- **Why**: minimize D1 query count. Each chapter page render = 1 R2 GET (cached at edge) + 0 D1 queries.
- **Never** rewrite to `/api/admin/import?chapterId=…` (per-chapter D1) — it shifts load from R2 (cheap, cached) to D1 (expensive, rate-limited) for no UX gain. The `/api/admin/import` per-chapter endpoint is for admin tooling only.

### 2. Web annotation — DOM-only, never persisted

`src/lib/sda/LongpressCtrl.svelte` selectionEdit must keep annotations **in the DOM only** on web — no `localStorage`, no IndexedDB, no fetch to `/api/annotation/*`. Toast should remind the user "本页面刷新后丢失".

- **Why**: the project has no cross-device user system; persisting per-device would risk filling up user storage with non-portable data.
- Tauri/Android path is different: `tauri.js` `saveParagraphAnnotations` / `clearParagraphAnnotations` call into Rust SQLite via `invoke`. **Do not unify** the two paths.

### 3. No user-account system, anywhere

No login, no signup, no cross-device sync. All "personalization" (search history, theme, font size, reading position on web) lives in `localStorage` keyed to the browser. Tauri-side personalization lives in on-device SQLite. The two are **deliberately independent**.

### 4. Tauri search — local SQLite + fire-and-forget keyword-heat pings

`src/lib/tauri.js` `searchAPI()` Tauri branch invokes the Rust `search` command against on-device SQLite **first**, then fire-and-forget POSTs `/api/search/track` to bump the keyword counter in Cloudflare KV.

- The local search **never depends on the network**. If `fetch(track)` fails or `navigator.onLine === false`, swallow the error silently — local search progress is unaffected.
- The track endpoint exists **only** to count keyword frequency. Do not consume the response; discard it.

### 5. Cloudflare KV search-counter semantics

`/api/search` and `/api/search/track` both `INCR` `search:count:<lang>:<q>` **on every request, including KV cache hits**. No rate limit, no 3-times-cap (an earlier prototype capped at 3 — that was wrong). Counters are monotonic and unbounded.

### 6. Dev mode uses miniflare, not `wrangler dev`

`bun dev` (vite + `@sveltejs/adapter-cloudflare`) auto-injects `platform.env.{DB, SEARCH_CACHE, R2, …}` via `getPlatformProxy()` in adapter-cloudflare v7+ `emulate()`. The `.wrangler/state/v3/` directory holds the miniflare local KV/D1 state.

- `wrangler.toml` must declare every binding the app reads at runtime (d1_databases, kv_namespaces, vars) so miniflare can materialize them.
- The user has explicitly said "不要 wrangler dev" multiple times — do not propose `wrangler dev` as a workaround.
