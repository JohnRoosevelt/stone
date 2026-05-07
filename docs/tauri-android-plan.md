# Stone — Tauri Android 迁移计划

> 将 Stone 从纯 Web (Cloudflare Pages + D1 + R2) 扩展到 **Tauri Android 原生 App**，
> 实现推送 GitHub 后自动构建 APK/AAB。

---

## 项目现状

| 维度                | 当前实现                                                    |
| ------------------- | ----------------------------------------------------------- |
| **前端**            | SvelteKit 5（SSR + CSR 混合）                               |
| **部署**            | **Cloudflare Pages**（`adapter-cloudflare`）                |
| **数据库**          | **Cloudflare D1**（SQLite 运行时，Worker-only）             |
| **文件存储**        | **Cloudflare R2**（存放 `.parquet.zst` 格式的原始书籍数据） |
| **搜索**            | D1 FTS5（英文） + LIKE（中文），通过 `/api/search` 接口     |
| **数据导入**        | Admin Tools → 从 R2 读取 parquet → 写入 D1                  |
| **客户端阅读**      | 浏览器直接加载 R2 parquet 渲染（`$lib/parquet.js`）         |
| **CI/CD**           | 无 Workflow（推送 GitHub → Cloudflare Pages 自动部署）      |
| **已有 Tauri 计划** | `docs/tauri-sql-plan.md` 详细讨论了 Rust/SQL 方案           |

---

## 总体架构

```
┌──────────────────────────────────────────────────────┐
│                   GitHub Repository                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │  stone/  (SvelteKit 前端，Web + Tauri 共享代码)   │ │
│  │  src-tauri/  (Rust 后端，Tauri 专用)              │ │
│  └──────────────────────────────────────────────────┘ │
│                          │                             │
│  ┌──────────────────────┴──────────────────────────┐  │
│  │  GitHub Actions                                  │  │
│  │  ├─ Cloudflare Pages (自动部署 Web 端，已有)       │  │
│  │  └─ Tauri Android Build (新增)                    │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
  Cloudflare Pages            Android APK/AAB
  (Web 端保持不变)            (新增 Tauri 构建产物)
```

---

## 执行阶段

### Phase 1：项目结构改造 — 引入 Tauri

**目标**：在现有项目中加入 Tauri v2，SvelteKit 前端 + Rust 后端共存。

| #   | 步骤                                                 | 说明                                                                    |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| 1.1 | 安装 Tauri CLI + API 依赖                            | `bun add -D @tauri-apps/cli@latest` + `bun add @tauri-apps/api@latest`  |
| 1.2 | 初始化 `src-tauri/` 目录                             | `bun tauri init`，配置应用名、窗口参数                                  |
| 1.3 | 添加 Android 平台                                    | `bun tauri android init` → `src-tauri/gen/android/`                     |
| 1.4 | 配置 SvelteKit 适配器切换                            | 通过环境变量 `TAURI` 在 `adapter-cloudflare` 与 `adapter-static` 间切换 |
| 1.5 | 配置 Tauri `beforeDevCommand` / `beforeBuildCommand` | 开发时启动 Vite dev server，构建时先 `vite build`                       |
| 1.6 | 配置 Tauri 安全策略                                  | 允许 `https://r2.lelexue.cn` 等外部请求                                 |
| 1.7 | 验证                                                 | 执行 `bun tauri dev` 确认桌面端可启动并加载前端                         |

**里程碑**：✅ 桌面端 `bun tauri dev` 正常运行

> 完成情况：
>
> - ✅ 1.1 `@tauri-apps/cli` + `@tauri-apps/api` 已安装
> - ✅ 1.2 `src-tauri/` 初始化完成（`tauri.conf.json`, `Cargo.toml`, `lib.rs`, `main.rs`）
> - ✅ 1.3 Android 平台初始化完成（NDK 已安装，4 个 Rust 目标已添加）
> - ✅ 1.4 SvelteKit 适配器根据 `TAURI` 环境变量切换（Cloudflare ↔ Static）
> - ✅ 1.5 `beforeDevCommand` / `beforeBuildCommand` 已配置
> - ✅ 1.6 CSP 安全策略已配置，允许 R2 域名
> - ✅ 1.7 `bun tauri dev` 桌面窗口正常弹出
> - ℹ️ Rust 工具链已从 1.65.0 升级到 1.95.0
> - ℹ️ 构建优化：`.cargo/config.toml` 配置 `codegen-units=256`、增量编译

---

### Phase 2：Rust 后端 — 本地 SQLite + Tauri 命令

**目标**：编写 Rust 后端，用 `rusqlite` + FTS5 实现本地 SQLite 数据库，通过 Tauri 命令暴露 API。

> SQL Schema、FTS5 配置等详细方案见 `docs/tauri-sql-plan.md`。

| #   | 步骤                 | 说明                                                                                      |
| --- | -------------------- | ----------------------------------------------------------------------------------------- |
| 2.1 | 添加 Rust 依赖       | `Cargo.toml` 中加 `rusqlite` (features: `bundled`, `fts5`), `serde`/`serde_json`, `tauri` |
| 2.2 | 数据库初始化         | 首次运行时自动建库，Schema 与 D1 保持一致                                                 |
| 2.3 | Tauri 命令：书籍列表 | `get_books(lang, cid)`                                                                    |
| 2.4 | Tauri 命令：章节列表 | `get_chapters(cid, book_id, lang)`                                                        |
| 2.5 | Tauri 命令：段落内容 | `get_paragraphs(cid, book_id, chapter_id, lang)`                                          |
| 2.6 | Tauri 命令：全文搜索 | `search(q, lang, cid, limit, offset)` — FTS5                                              |
| 2.7 | 前端桥接             | 前端通过 `@tauri-apps/api` 的 `invoke()` 调用 Rust 命令                                   |
| 2.8 | 验证                 | 前端能 invoke 命令获取数据                                                                |

**里程碑**：✅ Tauri 命令全覆盖，前端可正常读写本地 SQLite

---

### Phase 3：数据导入（你列的第 1 步）

**目标**：实现移动端书籍导入，功能类似 `Tools > Books`。

| #   | 步骤                 | 说明                                                                                          |
| --- | -------------------- | --------------------------------------------------------------------------------------------- |
| 3.1 | Rust 端 parquet 解析 | 使用 `parquet` + `zstd` Rust crate 解析 `.parquet.zst`                                        |
| 3.2 | Rust 端下载管线      | 从 `https://r2.lelexue.cn/{cid}/{lang}/{bookId}.parquet.zst` 下载 → 解压 → 解析 → 写入 SQLite |
| 3.3 | 导入进度 UI          | 基于 `tools/books` 改造，替换 fetch API 为 Tauri invoke                                       |
| 3.4 | 首次启动引导         | 检测本地 SQLite 为空时，引导用户导入或自动拉取                                                |
| 3.5 | 验证                 | Android 模拟器/真机上完整导入一本书                                                           |

**里程碑**：✅ 移动端从网络下载并导入书籍到本地 SQLite

---

### Phase 4：本地搜索（你列的第 3 步）

**目标**：搜索完全在本地完成，不依赖网络。

| #   | 步骤              | 说明                                                                      |
| --- | ----------------- | ------------------------------------------------------------------------- |
| 4.1 | Rust 端 FTS5 搜索 | 当前 D1 使用 SQLite FTS5，本地 SQLite 同样支持，迁移搜索逻辑              |
| 4.2 | 替换前端搜索接口  | `searchStore.svelte.js` 中 `fetch(/api/search)` → `invoke('search', ...)` |
| 4.3 | 离线搜索验证      | 断网时依然能搜到已导入的书籍内容                                          |
| 4.4 | 搜索结果缓存      | 保持现有的前端 Map 缓存 + FIFO 淘汰                                       |

**里程碑**：✅ 无网络环境下可执行全文搜索

---

### Phase 5：GitHub Actions — 自动构建 Android

**目标**：推送 GitHub 后自动构建 APK/AAB。

| #   | 步骤                                       | 说明                                                                                      |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 5.1 | 创建 `.github/workflows/build-android.yml` | 定义 CI 流水线                                                                            |
| 5.2 | 安装依赖环境                               | JDK 17、Android SDK（`platforms;android-34`、`build-tools`）、Rust 工具链、Node.js + pnpm |
| 5.3 | 安装 Tauri 系统依赖                        | Linux 上安装 `webkit2gtk-4.1-dev` 等                                                      |
| 5.4 | 构建 SvelteKit 静态文件                    | `bun run build`（使用 adapter-static）                                                    |
| 5.5 | 构建 Tauri Android                         | `bun tauri build --target aarch64-linux-android`                                          |
| 5.6 | 上传 APK artifact                          | 使用 `actions/upload-artifact`                                                            |
| 5.7 | 验证                                       | 推送一次到 GitHub，确认 Actions 执行成功并产出 APK                                        |

**里程碑**：✅ 每次 push 自动产出可下载的 `.apk`

---

### Phase 6：签名与发布（可选）

| #   | 步骤                     | 说明                                              |
| --- | ------------------------ | ------------------------------------------------- |
| 6.1 | 真机测试                 | Android 真机安装 APK，测试完整流程                |
| 6.2 | APK 签名                 | 生成 keystore，在 Actions 中通过 secrets 注入签名 |
| 6.3 | （可选）上架 Google Play | 生成 `.aab` 格式，上传至 Play Console             |
| 6.4 | Web 端保持正常           | 确保 `adapter-cloudflare` 的 Web 部署不受影响     |

**里程碑**：✅ 签名 APK 可安装，Web 端正常

---

## 关键决策记录

| 决策                 | 方案                            | 理由                                        |
| -------------------- | ------------------------------- | ------------------------------------------- |
| Tauri 版本           | **v2**（最新稳定版）            | 原生支持 Android/iOS，插件生态成熟          |
| 数据库               | **rusqlite** (bundled + fts5)   | 内嵌 SQLite，无需系统依赖，FTS5 默认开启    |
| SvelteKit 适配器切换 | **环境变量** `TAURI` 控制       | 不拆分项目，同一份代码同时构建 Web 和 Tauri |
| 前端调用方式         | **Tauri invoke**（方案 A）      | 轻量，符合 Tauri 设计哲学，替代 HTTP fetch  |
| 数据来源             | 从 R2 公共 URL **下载 parquet** | 无需 S3 凭证，复用现有数据管线              |
| 搜索                 | **本地 FTS5**                   | 与 D1 保持一致，迁移成本最低                |

---

## 参考文档

- `docs/tauri-sql-plan.md` — Rust SQL + Schema + 同步策略的详细方案
- `docs/search-audit.md` — 搜索功能审查报告
- `schemas/init.sql` — 当前 D1 数据库 Schema
- `src/routes/api/search/+server.js` — 当前搜索 API 实现
- `src/routes/api/admin/import/+server.js` — 当前数据导入 API 实现
