# 搜索功能审查报告

> 审查日期：2025-01

---

## 1. 功能总览

搜索功能由以下模块组成：

| 层级 | 文件 | 职责 |
|---|---|---|
| **入口** | `src/lib/global/Hearder.svelte` | 桌面端顶部搜索栏，回车跳转到 `/search?q=...` |
| **入口** | `src/lib/sda/ArticleCtrl.svelte` | 阅读控制栏搜索按钮，跳转到 `/search?q=`（空白搜索页） |
| **搜索页** | `src/routes/(pub)/search/+page.svelte` | 完整搜索 UI：输入框、范围筛选、结果展示、高亮、导航 |
| **搜索页** | `src/routes/(pub)/search/+page.js` | 配置 `prerender = false` |
| **API** | `src/routes/api/search/+server.js` | Cloudflare D1 FTS5 全文搜索 + rowid 范围裁剪优化 |
| **DB** | `schemas/init.sql` | FTS5 虚拟表 + 同步触发器 |

---

## 2. 逐项审查结果

### 2.1 搜索入口

#### 桌面端顶部搜索栏（Hearder.svelte）

- 仅在桌面端显示（`sm:flex` 控制）
- 回车触发 `goto('/search?q=...')`，跳转到搜索页
- 无提交按钮，仅支持回车

#### 文章阅读控制栏（ArticleCtrl.svelte）

- 搜索按钮点击后执行 `goto('/search?q=', { replaceState: true })`
- 跳转到空白搜索页，等待用户输入
- 使用 `replaceState`，替换当前文章页的历史记录

#### 移动端入口

- 桌面搜索栏在移动端隐藏
- `Nav.svelte` 中已移除搜索入口（按之前需求执行）
- 移动端进入搜索的唯一路径：打开一篇文章 → 阅读控制栏 → 点击搜索按钮
- 首页/分类页/书籍页均无搜索入口

---

### 2.2 搜索页面（+page.svelte）

#### 搜索输入与提交

| 功能 | 状态 | 说明 |
|---|---|---|
| 输入框 + 搜索按钮 | ✅ | 回车或点击按钮触发 |
| 清除按钮 | ✅ | 重置所有状态（query、results、total、searched、error） |
| URL 参数自动搜索 | ✅ | `onMount` 读取 `q` 参数，非空时自动执行 |
| 加载中状态 | ✅ | 旋转图标 + "搜索中…" 文字 |
| 空状态（初次） | ✅ | 显示"输入关键词搜索" |
| 空状态（无结果） | ✅ | 显示"未找到相关内容" |
| 错误状态 | ✅ | 显示错误信息 |

#### 范围筛选

- 四个 pill 按钮：全部、圣经（cid=0）、预言之灵（cid=1）、书籍（cid=2）
- 默认高亮"全部"（`scopeCid = undefined`，`undefined === undefined` 为 `true`）
- 切换范围自动重新搜索（如果已搜索过）
- ⚠️ **不更新 URL 参数**：切换范围不修改 URL 中的 `cid` 参数

#### 结果展示

- **分类分组**：按 cid 分组 → 按 book_id 分组
- **折叠展开**：点击分类标题可折叠/展开；搜索结果默认全部展开
- **全局序号**：`_seq` 从 1 开始递增
- **总条数提示**：显示 `total`；如果 `total > results.length` 显示"显示前 N 条"
- **关键词高亮**：使用 `highlightText()`，在摘要中 `<mark>` 标记匹配词
- **结果条目**：显示章节标题、段落编号、文本摘要（最多 3 行）

#### 结果导航到原文

- 点击结果 → `goto('/{cid}/{bookId}/{chapterId}#zh-{id}')`
- `Article.svelte` 中锚点为 `id="zh-{id}"`，匹配正确

---

### 2.3 搜索 API（+server.js）

#### 请求参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `q` | 是 | 搜索关键词 |
| `lang` | 否 | 语言代码，默认 `zh` |
| `cid` | 否 | 分类 ID（0=圣经，1=预言之灵，2=书籍） |
| `bookId` | 否 | 书 ID |

#### 搜索逻辑

1. **`buildMatchQuery()`**：清除 FTS5 特殊字符 → 按空格分词 → 构建 `"词1" AND "词2"` 查询
2. **Rowid 范围裁剪**：当指定 `cid`/`bookId` 时，提前计算 `[minRowid, maxRowid]` 条件，减少 FTS 回表
3. **JOIN 章节表和书籍表**：获取 `chapter_title` 和 `book_name`
4. **`COUNT(*) OVER() AS _total`**：返回真实匹配总数（不受 `LIMIT 100` 影响）
5. 结果按 `fts.rank` 排序，上限 100 条
6. 响应格式：`{ total: number, results: [...] }`

#### Rowid 范围裁剪优化原理

```
背景：FTS5 外部内容表只索引了 text_content，没有 lang_code / cid / book_id。
按范围搜索时，FTS 先查出所有语言的所有匹配行，再 JOIN 回主表过滤范围。
高频词（如"耶稣"）可命中数万行，若搜索范围只限某个分类/书，绝大部分回表是浪费的。

优化：提前算出目标范围的 rowid [min, max] 传给 FTS JOIN，让 SQLite 在回表时
直接跳过范围外的行。

优化效果（假设高频词 FTS 命中 8000 行）：
  ┌────────────────────────────────┬──────┬──────────┬────────┐
  │ 搜索范围                       │ 命中 │ 实际回表 │ 提速   │
  ├────────────────────────────────┼──────┼──────────┼────────┤
  │ lang=zh                        │ 8000 │ 8000     │ 不变   │
  │ lang=zh&cid=0                  │ 8000 │ ~4000    │ 2x     │
  │ lang=zh&cid=0&bookId=1        │ 8000 │ ~200     │ 40x    │
  │ lang=zh&cid=0&bookId=1&chapter=3 │ 8000 │ ~5    │ 1600x  │
  └────────────────────────────────┴──────┴──────────┴────────┘
  低频词（如"以利沙"）命中仅几十行，优化效果不明显，但也没有额外开销。
```

---

### 2.4 数据库层面（init.sql）

#### FTS5 配置

- **虚拟表**：`chapter_paragraphs_fts`，`content='chapter_paragraphs'`（外部内容表，索引与主表分离）
- **隐式 rowid 关联**：`fts.rowid = chapter_paragraphs.rowid`
- **同步触发器**：
  - `trg_paragraphs_ai`：INSERT 时自动插入 FTS 索引
  - `trg_paragraphs_ad`：DELETE 时自动删除 FTS 索引
  - `trg_paragraphs_au`：UPDATE 时先删后插，同步更新 FTS 索引

#### 相关索引

- `idx_paragraphs_lookup(lang_code, book_id, chapter_id)`：覆盖段落查询
- `idx_paragraphs_cid_book(cid, book_id)`：覆盖分类+书过滤

---

## 3. 发现的问题

### 问题 A：ArticleCtrl 搜索按钮使用 `replaceState`

**文件**：`src/lib/sda/ArticleCtrl.svelte`

```js
goto(`/search?q=`, { replaceState: true });
```

**影响**：从文章页点击搜索按钮后，当前文章页的历史记录被替换。用户按浏览器"返回"按钮会跳过文章页，回到更早的页面。

**建议**：改为不带 `replaceState` 的正常跳转，让用户搜索完后能自然返回到之前的文章页。

---

### 问题 B：切换范围不更新 URL 参数

**文件**：`src/routes/(pub)/search/+page.svelte`，`setScope()` 函数

```js
function setScope(cid) {
  scopeCid = cid;
  if (searched) {
    const trimmed = query.trim();
    if (trimmed) doSearch(trimmed);
  }
}
```

**影响**：
- 搜索结果页的 URL 始终为 `/search?q=xxx`（无 `cid`）
- 用户无法通过 URL 分享带范围筛选项的搜索结果
- 页面刷新后范围会重置为"全部"

**建议**：在 `setScope` 中同时用 `goto` 更新 URL。例如：

```js
function setScope(cid) {
  scopeCid = cid;
  const params = new URLSearchParams({ q: query.trim() });
  if (cid !== undefined) params.set("cid", String(cid));
  goto(`/search?${params}`, { replaceState: true, noScroll: true });
  if (searched && query.trim()) doSearch(query.trim());
}
```

---

### 问题 C：搜索 API 的 MATCH 条件使用全表名而非别名

**文件**：`src/routes/api/search/+server.js`，SQL 查询

```sql
WHERE chapter_paragraphs_fts MATCH ?
```

**说明**：该表在 `FROM` 子句中被别名化为 `fts`，但 MATCH 条件使用了全表名 `chapter_paragraphs_fts`。虽然 SQLite 通常能正确解析，但更规范的写法是使用别名：

```sql
WHERE fts MATCH ?
```

这样做更清晰也能避免某些 SQLite 方言下潜在的歧义问题。

---

## 4. 改进建议（按优先级排序）

| 优先级 | 问题 | 影响面 | 改动量 |
|---|---|---|---|
| P0 | 无严重缺陷 — 核心搜索链路完整可用 | — | — |
| P1 | **问题 A**：`replaceState` 影响返回导航 | 用户体验 | 小（改一行） |
| P1 | **问题 B**：范围筛选不更新 URL | 分享/刷新状态丢失 | 小（改 `setScope`） |
| P2 | **问题 C**：SQL 别名用法不规范 | 代码健壮性 | 极小（改 SQL） |
| P3 | 移动端缺少搜索入口 | 功能可达性 | 需设计讨论 |
