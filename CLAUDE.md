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
