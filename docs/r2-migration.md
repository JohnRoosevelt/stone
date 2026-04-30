# R2 章节内容迁移方案

> 将 `chapter_paragraphs` 的 `text_content`（百万行级）从 D1 迁至 R2 存储，
> 降低 D1 读取成本，提升章节加载速度。

---

## 1. 架构概览

### 迁移前

```
用户请求章节
    │
    ▼
+page.server.js ──► D1: SELECT text_content FROM chapter_paragraphs
    │                     WHERE cid=? AND book_id=? AND chapter_id=? AND lang_code=?
    ▼
返回 HTML（含正文）
```

**问题**：百万行 `text_content` 存在 D1，每次章节阅读产生大量行读取，D1 按行计费成本高。

### 迁移后

```
用户请求章节
    │
    ▼
+page.server.js ──► R2: content/{lang}/{cid}/{book_id}/{chapter_id}.json
    │               （章节级 JSON，1 次 GET）
    │
    ├── 命中 ──► 返回 HTML
    │
    └── 未命中 ──► D1 回退查询 ──► 返回 HTML
```

### 双通道并存

| 通道                | 格式                                               | 粒度   | 适用场景                   |
| ------------------- | -------------------------------------------------- | ------ | -------------------------- |
| **R2 章级 JSON**    | `content/{lang}/{cid}/{book_id}/{chapter_id}.json` | 章节   | SSR 页面渲染、API          |
| **R2 书级 Parquet** | `{cid}/{lang}/{bookId}.parquet.zst`                | 整本书 | 客户端 WASM 加载（规划中） |

---

## 2. R2 路径结构

```
{bucket}/
├── content/                    # 章节级 JSON（SSR 用）
│   └── {lang_code}/
│       └── {cid}/
│           └── {book_id}/
│               └── {chapter_id}.json
│
├── 0/                          # 书级 Parquet（客户端 WASM 用，cid=0=bible）
│   └── {lang}/
│       └── {bookId}.parquet.zst
├── 1/                          # cid=1=sda
│   └── {lang}/
│       └── {bookId}.parquet.zst
└── 2/                          # cid=2=book
    └── {lang}/
        └── {bookId}.parquet.zst
```

---

## 3. 数据格式

### 3.1 章节级 JSON（SSR 通道）

**路径**：`content/{lang_code}/{cid}/{book_id}/{chapter_id}.json`

```json
[
  { "id": 1, "num": 1, "format": 7, "c": "起初，神创造天地。" },
  { "id": 2, "num": 2, "format": 7, "c": "地是空虚混沌，渊面黑暗..." }
]
```

| 字段     | 类型         | 说明                        |
| -------- | ------------ | --------------------------- |
| `id`     | number       | 段落 ID                     |
| `num`    | number\|null | 段落编号（bible 为 null）   |
| `format` | number\|null | 格式标记（bible 为 7/null） |
| `c`      | string       | 正文内容                    |

### 3.2 书级 Parquet（客户端 WASM 通道）

**路径**：`{cid}/{lang}/{bookId}.parquet.zst`

Parquet 内部按分类使用不同 Schema：

| 分类      | cid | 列                                               | 说明                                     |
| --------- | --- | ------------------------------------------------ | ---------------------------------------- |
| **bible** | 0   | `n` (UTF8), `o` (UTF8)                           | `n`=章节号, `o`=经文。不含 id/num/format |
| **sda**   | 1   | `n` (UTF8), `t` (INT32), `p` (INT32), `o` (UTF8) | `t`=format, `p`=段落编号，保留排版信息   |
| **book**  | 2   | `n` (UTF8), `o` (UTF8)                           | 同 bible，不含 format/num                |

文件本身经 Zstd Level 19 压缩（`.parquet.zst`）。

---

## 4. 文件变更清单

### 4.1 新增文件

| 文件                               | 说明                                  |
| ---------------------------------- | ------------------------------------- |
| `src/lib/server/r2-content.js`     | R2 章节 JSON 读写模块（SSR 通道）     |
| `src/lib/server/parquet-writer.js` | R2 Parquet.zst 生成与上传模块（WASM） |
| `scripts/d1-to-r2.mjs`             | D1 → Parquet.zst → R2 批量导出工具    |

### 4.2 修改文件

| 文件                                                            | 变更内容                                                |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| `src/routes/(pub)/[cid]/[bookId]/[chapterId]/+page.server.js`   | 章节页优先从 R2 读，D1 回退                             |
| `src/routes/api/books/[bookId]/chapters/[chapterId]/+server.js` | 章节 API 优先从 R2 读，D1 回退                          |
| `src/routes/api/admin/batch-import/+server.js`                  | 批量导入后同时更新章级 JSON + 书级 Parquet.zst          |
| `src/routes/api/admin/paragraphs/+server.js`                    | 段落增/改/删后异步重建书级 Parquet.zst                  |
| `src/lib/parquet.js`                                            | 修复 bible 类型判断（`"bible"` → `Number(type) === 0`） |
| `schemas/init.sql`                                              | 无需修改（D1 表结构不变，FTS 仍依赖 D1）                |

---

## 5. 核心模块说明

### 5.1 `src/lib/server/r2-content.js`

```js
// 读取章节内容（R2 GET）
const paragraphs = await getChapterContent(platform, {
  lang_code: "zh",
  cid: 0,
  book_id: 1,
  chapter_id: 1,
});
// → [{ id, num, format, c }, ...] | null

// 写入章节内容（R2 PUT）
await putChapterContent(
  platform,
  {
    lang_code: "zh",
    cid: 0,
    book_id: 1,
    chapter_id: 1,
  },
  paragraphs,
);
```

**设计要点**：

- S3Client 懒初始化 + 缓存，避免每次调用重建
- `platform.env.R2` 优先（Cloudflare Pages），`$env/dynamic/private` 回退（SvelteKit dev）
- `getChapterContent` 遇 `NoSuchKey` 返回 `null`（静默），其他错误 log 后返回 `null`
- `putChapterContent` 直接 `PutObjectCommand`（服务端无需预签名 URL）

### 5.2 `src/lib/server/parquet-writer.js`

服务端 Parquet.zst 生成器，基于 WASM（`parquet-wasm` + `zstd-wasm`），
可在 Cloudflare Workers 中运行（不依赖 Node.js `fs` / `child_process`）。

```js
import {
  generateBookParquet,
  uploadBookParquet,
} from "$lib/server/parquet-writer";

// 仅生成字节（不写入 R2）
const bytes = await generateBookParquet(rows, { cid: 0 });

// 生成并上传到 R2
const ok = await uploadBookParquet(platform, rows, {
  cid: 0,
  book_id: 1,
  lang: "zh",
});
```

**设计要点**：

- WASM 懒初始化（首次调用加载 `parquet-wasm/esm` + `zstd-wasm`），后续调用复用
- 自动检测输入格式：D1 格式（`chapter_id` / `text_content`）或已映射格式（`n` / `o`）
- sda（cid=1）额外包含 `t`（format）、`p`（num）列，bible/book 仅 `n`、`o`
- 压缩级别 19（zstd 最高压缩率）

### 5.3 `scripts/d1-to-r2.mjs`

从 D1 导出数据，转换为 Parquet.zst 上传到 R2。

```bash
# 列出所有可用书卷
node scripts/d1-to-r2.mjs --list

# 导出全部圣经中文
node scripts/d1-to-r2.mjs --cid 0 --lang zh

# 导出单卷（创世记）
node scripts/d1-to-r2.mjs --cid 0 --lang zh --book 1

# 导出全部预言之灵中文
node scripts/d1-to-r2.mjs --cid 1 --lang zh

# 导出全部通用书籍中文
node scripts/d1-to-r2.mjs --cid 2 --lang zh
```

**工作流程**：

1. `wrangler d1 execute stone-db --remote --json --command "SELECT ..."` 查询 D1
2. 按分类配置 `mapRow` 精简数据（bible/book 去掉 id/num/format，sda 保留）
3. `parquetjs` 写入 Parquet 文件
4. `zstd -19` 压缩
5. `@aws-sdk/client-s3` 上传到 R2

**前置条件**：

- `.env.local` 中配置 `R2=accountId,accessKeyId,secretAccessKey,bucket`
- 已安装 `wrangler` 并登录 (`npx wrangler login`)
- 已安装 `zstd` 命令行工具 (`brew install zstd`)

---

## 6. 读取链路

### 6.1 章节页（SSR）

```
+page.server.js
    │
    ├── 1. getChapterContent(platform, { zh, cid, book_id, chapter_id })
    │       │
    │       ├── 命中 R2 → 映射为 { t, p, c, id } → 返回
    │       │
    │       └── null (未命中)
    │               │
    │               └── 2. D1 回退: SELECT id, num, text_content, format
    │                       FROM chapter_paragraphs WHERE ...
    │                       → 映射为 { t, p, c, id } → 返回
    │
    └── 异常 → { title: null, sections: [] }
```

**关键代码**（`+page.server.js`）：

```js
// 优先从 R2 读取
const r2Paragraphs = await getChapterContent(
  { env },
  {
    lang_code: "zh",
    cid: numericCid,
    book_id: Number(bookId),
    chapter_id: Number(chapterId),
  },
);

if (r2Paragraphs) {
  // R2 命中
  return {
    title,
    sections: r2Paragraphs.map((item) => ({
      t: item.format ?? 7,
      p: item.num ?? item.id,
      c: item.c,
      id: item.id,
    })),
  };
}

// R2 未命中 → D1 回退
const { results } = await db.prepare(`SELECT ...`).all();
```

### 6.2 搜索（保持不变）

搜索 API 继续使用 D1 FTS5 + `text_content`：

- FTS5 外部内容表依赖 `chapter_paragraphs.text_content`
- 搜索结果摘要仍从 D1 返回（文本片段短，成本可控）
- Rowid 范围裁剪优化继续生效

### 6.3 客户端 Parquet（规划中）

`src/lib/parquet.js` 的 `loadParquetContent()` 可加载整本书的 `.parquet.zst`，
利用 WASM（`parquet-wasm` + `zstd-wasm`）在浏览器端解压。目前尚未接入页面。

---

## 7. 写入链路

### 7.1 批量导入

```
POST /api/admin/batch-import
    │
    ├── 1. D1 batch INSERT (chapters + chapter_paragraphs)
    │
    └── 2. 逐章上传 R2: putChapterContent()
             ├── 成功 → r2Uploaded++
             └── 失败 → console.error，继续下一章
```

响应含 `r2Uploaded` 和 `parquetUploaded` 字段。

### 7.2 单段编辑（POST/PUT/DELETE）

段落增/改/删后，采用 fire-and-forget 模式异步重建该书的 `.parquet.zst`：

1. D1 单行 INSERT/UPDATE/DELETE
2. 查询该书全部段落 → `uploadBookParquet()`
3. API 立即返回，不等待上传完成。失败仅 log，不影响 API 响应。

---

## 8. 迁移步骤

### 8.1 首次迁移

```bash
# 1. 导出圣经中文到 R2（书级 Parquet）
node scripts/d1-to-r2.mjs --cid 0 --lang zh
node scripts/d1-to-r2.mjs --cid 0 --lang en

# 2. 导出预言之灵
node scripts/d1-to-r2.mjs --cid 1 --lang zh
node scripts/d1-to-r2.mjs --cid 1 --lang en

# 3. 导出通用书籍
node scripts/d1-to-r2.mjs --cid 2 --lang zh
node scripts/d1-to-r2.mjs --cid 2 --lang en
```

### 8.2 章节级 JSON（SSR 用）

当前 SSR 章节页使用章节级 JSON（`content/{lang}/{cid}/{book_id}/{chapter_id}.json`），
需单独生成。可复用 `r2-content.js` 的 `putChapterContent`，通过批量脚本从 D1 读取并上传。

### 8.3 验证

```bash
# 检查 R2 文件
aws s3 ls s3://{bucket}/0/zh/ --endpoint-url https://{accountId}.r2.cloudflarestorage.com

# 检查章节页是否从 R2 加载（观察 Cloudflare Worker 日志）
# 预期：[chapter] Loaded from R2: cid=0 book=1 chapter=1
```

---

## 9. 回退方案

如果 R2 出现问题，系统自动回退到 D1：

1. **R2 读取失败** → `getChapterContent` 返回 `null` → 走 D1 查询
2. **R2 服务不可用** → 同上，用户无感知
3. **完全回退** → 无需代码改动，D1 数据始终保留

---

## 10. 注意事项

- **D1 `text_content` 列保留**：FTS5 搜索依赖此列，不能删除
- **FTS5 触发器不变**：INSERT/UPDATE/DELETE 仍同步 FTS 索引
- **`parquet.js` URL 使用数字 cid**：`{PUBLIC_R2}/0/zh/1.parquet.zst`（非 `bible/zh/1.parquet.zst`）
- **章节 JSON 包含全字段**：`id/num/format/c`，SSR 渲染需要所有字段
- **Parquet 精简字段**：bible/book 只保留 `n`/`o`，sda 保留 `n`/`t`/`p`/`o`

---

## 11. 相关文件索引

```
src/lib/server/r2-content.js                              # R2 读写模块
src/lib/parquet.js                                         # 客户端 Parquet 加载器（WASM）
src/routes/(pub)/[cid]/[bookId]/[chapterId]/+page.server.js # 章节页 R2 优先加载
src/routes/api/books/[bookId]/chapters/[chapterId]/+server.js # 章节 API R2 优先
src/routes/api/admin/batch-import/+server.js               # 批量导入同步 R2
src/routes/api/search/+server.js                           # 搜索（仍用 D1 FTS5）
scripts/d1-to-r2.mjs                                       # D1 → Parquet.zst → R2 导出
schemas/init.sql                                           # 数据库 Schema（未变动）
seeds/json-parquet.js                                      # JSON ↔ Parquet 互转工具
seeds/upload-bible-r2.js                                   # 圣经 Parquet 上传（JSON 源）
seeds/upload-sda-r2.js                                     # 预言之灵 Parquet 上传（JSON 源）
seeds/upload-r2.js                                         # 通用书籍 Parquet 上传（JSON 源）
```
