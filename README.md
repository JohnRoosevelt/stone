# 脚前的灯 · Stone Bible

> **你的话是我脚前的灯,路上的光。**(诗篇 119:105)

一个跨平台的圣经 / 经典阅读 App。同一套 SvelteKit 代码库,既能在浏览器里跑,也能打包成 Android (Tauri 2) 和 macOS 原生安装包。

- 📖 **Web**: [stone.lelexue.cn](https://stone.lelexue.cn) — Cloudflare Pages 部署
- 📲 **Android**: [下载 APK](https://stone.lelexue.cn/download) — Tauri 2 打包
- 💻 **macOS**: [下载 DMG](https://stone.lelexue.cn/download) — Universal (Intel + Apple Silicon)

---

## 功能特性

### 📚 三大内容分类
所有内容按 **CID (Category ID)** 组织,统一在 `src/lib/config.js` 里管理:

| CID | 名称 | 说明 |
|-----|------|------|
| `0` | **圣经** | 旧约 + 新约 66 卷,支持中英文 |
| `1` | **怀著 (预言之灵)** | 怀爱伦著作等 SDA 经典 |
| `2` | **教育资料 / 书籍** | 学习类读物 |

### 🔍 智能搜索
`/api/search` 端点针对中英文做了不同处理:

- **英文 / 拉丁文** → SQLite **FTS5** 全文检索
- **中文** → 用 `LIKE` 匹配 (FTS5 的 unicode61 无法分词 CJK)
- **范围裁剪优化**: 根据 `cid` / `bookId` 预计算 `rowid` 区间,再 JOIN 回 FTS, 高频词查询速度提升 **40×–1600×** (见 `src/routes/api/search/+server.js` 顶部注释的对照表)
- **Cloudflare KV 缓存**: 搜索结果永久缓存,热门词聚合 (`/api/search/hot`)

### 📖 沉浸式阅读器
- 字体大小可调 (14–42px)
- 5 种背景色 + 暗黑模式 (柔和米色 / 浅灰 / 淡绿 / 浅杏 / 淡蓝)
- **长按选段 + 批注** (怀著模块特有)
- **阅读进度持久化** (Tauri 端): 滚动时 debounce 保存 + 离开页面立即 flush,下次打开回到原位
- 跟随系统暗色, 也可手动锁定

### 🔄 多端同步 / 离线优先
| 端 | 数据层 | 离线 |
|----|----|----|
| Web | Cloudflare D1 + KV + R2 | 浏览器缓存 (PWA) |
| Android | 本地 SQLite (rusqlite) + 启动时从 R2 Parquet 导入 | ✅ 完全离线 |
| macOS | 同 Android | ✅ 完全离线 |

Tauri 端首次启动时自动从 `https://r2.lelexue.cn` 拉取 Parquet (zstd 压缩) → 用 `parquet-wasm` + `apache-arrow` 解码 → 灌入本地 SQLite。

### 🔔 自动更新 (Android)
`src/lib/updater.svelte.js` 拉取 R2 上的 `apk/update.json`,按 semver 对比,新版本直接打开 APK URL 安装。

### 📲 智能下载引导
`/download` 页面通过 UA 识别访问者,给出对应引导:
- Android → APK 直链 + 版本号 + 大小 + 一键复制
- macOS / iOS / iPadOS → DMG (Universal)
- 微信内置浏览器 → 引导点击右上角"在浏览器中打开"
- 不支持的平台 → 友好提示 + 期待语

### 🛠 管理员后台
`/tools/*` 路径下内置工具集:
- `/tools/books` — 书籍浏览器
- `/tools/import` — 数据导入 (R2 → 本地)
- `/tools/json-parquet` — JSON ↔ Parquet 转换器 (给书籍内容制作团队用)
- `/tools/admin/*` — 书籍 / 章节 / 段落的 CRUD 接口

---

## 技术栈

| 层 | 选型 |
|----|----|
| **框架** | SvelteKit 2 + Svelte 5 runes |
| **样式** | UnoCSS (`presetWind4` + `presetMini` + `presetIcons` + 自定义 `h-view-*` 工具类) |
| **包管理 / 脚本** | **Bun** (命令统一用 `bun xxx`) |
| **Web 适配器** | `@sveltejs/adapter-cloudflare` |
| **App 适配器** | `@sveltejs/adapter-static` + **Tauri 2** |
| **数据 (Web)** | Cloudflare D1 (SQLite) + KV (`STONE_SEARCH_CACHE`) + R2 (`r2.lelexue.cn`) |
| **数据 (App)** | 本地 rusqlite + parquet-wasm + apache-arrow + zstd-wasm |
| **图床 / 分发** | Cloudflare R2 + 国内 CDN 边缘 |

---

## 快速开始

### 环境要求

- **Bun** ≥ 1.0 (推荐) — `bun --version`
- **Node.js** ≥ 18 (Tauri 端构建需要)
- **Wrangler** — Cloudflare 部署 / D1 本地开发用
- **Rust** + **Android NDK** — Tauri Android 构建

### 克隆 + 安装

```bash
git clone <repo>
cd stone
bun install
```

### 本地开发 (Web)

```bash
# 1. 初始化本地 D1 数据库 + 灌入种子数据
bun db:reset

# 2. 启动 dev server (默认端口 5175)
bun dev
```

打开 http://localhost:5175

### 构建生产版本

```bash
# Web (Cloudflare Pages 输出到 .svelte-kit/cloudflare)
bun build

# Android APK (需先 export TAURI=1 切到 adapter-static)
TAURI=1 bun build
bun tauri build
```

### 数据库命令

```bash
# 本地 D1
bun db:init        # DROP + CREATE schema
bun db:seed        # 灌入书 + 章节数据
bun db:reset       # init + seed 一把梭

# 远端 D1 (Cloudflare)
bun db:init:remote
bun db:seed:remote
bun db:reset:remote
```

---

## 项目结构

```
stone/
├── src/
│   ├── routes/
│   │   ├── (pub)/             # 公开页面
│   │   │   ├── (home)/        # 首页 (HOME_CARDS)
│   │   │   ├── [cid]/         # 分类页 (0=圣经, 1=怀著, 2=书籍)
│   │   │   │   └── [bookId]/[chapterId]/  # 阅读器
│   │   │   ├── search/        # 搜索
│   │   │   ├── music/         # 音乐 (筹备中)
│   │   │   ├── my/            # 个人中心 (设置 / 关于 / 批注 / 检查更新)
│   │   │   └── music/
│   │   ├── api/               # REST 端点
│   │   │   ├── books/
│   │   │   ├── search/        # +hot +track 聚合
│   │   │   ├── admin/
│   │   │   └── r2/
│   │   ├── tools/             # 管理员后台 (非公开)
│   │   └── download/          # 智能下载引导页
│   ├── lib/
│   │   ├── config.js          # CID / 导航 / 首页卡片 (全局配置中心)
│   │   ├── data.svelte.js     # 全局响应式状态 (网络/主题/设备/阅读器/UI/对话框)
│   │   ├── tauri.js           # Tauri ↔ Web API 路由
│   │   ├── parquet.js         # parquet-wasm 包装
│   │   ├── updater.svelte.js  # 自动更新逻辑
│   │   ├── release.js         # R2 update.json 解析 + 5 分钟内存缓存
│   │   ├── bible/             # 圣经专用组件 (Dir / search)
│   │   ├── sda/               # 怀著专用组件 (Article / 长按批注 / 设置)
│   │   ├── stores/            # 子状态 (theme / network / reader / device / ui / dialog / touch)
│   │   └── server/            # 服务端工具 (db / searchCache)
│   └── app.html
├── src-tauri/                 # Tauri 2 后端 (Rust)
├── schemas/                   # D1 SQL (init.sql / books*.sql)
├── static/                    # 静态资源 (icons / PWA icons / manifest)
├── wrangler.toml              # Cloudflare 配置 (D1 / KV / 变量)
├── svelte.config.js           # 适配器按 TAURI env 切换
├── uno.config.js              # UnoCSS 配置 + 自定义工具类
└── vite.config.js
```

---

## 数据架构

### 4 张核心表 (`schemas/init.sql`)

```
book_base          ← 语言无关的书籍元数据 (cid, book_id, abbr, total_chapters)
   ↓
book_i18n          ← 多语言名称 (中文 / 英文)
   ↓
chapters           ← 章节列表
   ↓
chapter_paragraphs ← 段落实体 (FTS5 external content 表的源)
```

FTS5 通过 trigger (`trg_paragraphs_ai/ad/au`) 维护 `chapter_paragraphs_fts`,搜索时再 JOIN 回来。

### Web → App 数据同步

```
R2 bucket (r2.lelexue.cn)
   ├── books.parquet (zstd 压缩)
   └── apk/update.json (版本清单)
         ↓ (Tauri 首次启动)
   parquet-wasm + apache-arrow
         ↓
   本地 SQLite (rusqlite)
```

---

## 搜索性能优化

`src/routes/api/search/+server.js` 顶部的注释里有一张实测对照表 — 通过预计算 `rowid [min, max]` 范围裁剪,让高频词查询从"扫描全表"变成"扫描对应范围":

| 搜索范围 | FTS 命中 | 回表次数 | 加速比 |
|---------|---------|---------|-------|
| `lang=zh` | 8000 | 8000 | 基准 |
| `lang=zh&cid=0` | 8000 | ~4000 | **2×** |
| `lang=zh&cid=0&bookId=1` | 8000 | ~200 | **40×** |
| `lang=zh&cid=0&bookId=1&chapter=3` | 8000 | ~5 | **1600×** |

低频词查询开销几乎为 0, 但高频词能直接起飞。

---

## 部署

### Web (Cloudflare Pages)

```bash
bun build                                    # 输出 .svelte-kit/cloudflare
wrangler pages deploy .svelte-kit/cloudflare  # 推到 Pages
```

环境变量 / Secrets 在 Cloudflare Dashboard 配置,或在 `.dev.vars` 本地开发用。

### Android / macOS (Tauri)

CI 通过 GitHub Actions + `softprops/action-gh-release` 推送 tag 时自动构建,产物上传到 R2 (`https://r2.lelexue.cn/apk/`) 而不是 GitHub Releases — 国内下载更稳定。详见 `.github/workflows/`。

---

## 浏览器 / 设备支持

- **Web**: 现代浏览器 (Chrome / Safari / Firefox / Edge 最近 2 个大版本), 支持 PWA 安装
- **Android**: Android 7.0+ (Tauri 2 最低要求)
- **macOS**: macOS 10.15+ (Universal binary, Intel + Apple Silicon)
- **iOS / iPadOS / Windows**: 暂未支持, [欢迎反馈](https://github.com/<repo>/issues)

---

## 路线图

- [ ] 音乐模块 (`/music` 已经在路由里,内容待补充)
- [ ] iOS / iPadOS 支持 (Tauri 移动端扩展)
- [ ] 阅读计划 / 灵修提醒
- [ ] 多端阅读进度云同步 (目前只在本地)
- [ ] 原文并行显示 (中文 + 英文 / 希伯来文 / 希腊文)

---

## 致谢

- 内容来源: 各出版社授权 / 公有领域
- 图标: Carbon Design System + Line MD + 自制 (见 `static/icons/`)
- 工具: SvelteKit · Tauri · Cloudflare · UnoCSS · Bun

---

## 许可

MIT