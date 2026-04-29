<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  /** 范围选项 */
  const SCOPES = [
    { cid: undefined, label: "全部" },
    { cid: 0, label: "圣经" },
    { cid: 1, label: "预言之灵" },
    { cid: 2, label: "书籍" },
  ];

  const CID_NAMES = { 0: "圣经", 1: "预言之灵", 2: "书籍" };

  /** 从 URL 读取初始搜索词和范围 */
  let query = $state(page.url.searchParams.get("q") || "");
  let scopeCid = $state(page.url.searchParams.get("cid") ?? undefined);
  /** 搜索结果 */
  let results = $state([]);
  /** 真实匹配总数（API 返回） */
  let total = $state(0);
  /** 加载状态 */
  let loading = $state(false);
  /** 是否已执行过搜索（区分初次空状态与无结果） */
  let searched = $state(false);
  /** 错误信息 */
  let error = $state("");

  /** 分页 */
  let offset = $state(0);
  let hasMore = $state(false);
  let loadingMore = $state(false);
  /** 滚动容器引用 */
  let scrollContainer = $state(null);

  /** 各分类折叠状态 */
  let expanded = $state({});

  /** 按分类(cid)分组，分类内再按书分组，并标注全局序号 */
  let grouped = $derived.by(() => {
    const cidMap = {};
    let idx = 0;
    for (const r of results) {
      const item = { ...r, _seq: ++idx };
      if (!cidMap[item.cid]) {
        cidMap[item.cid] = { cid: item.cid, books: {} };
      }
      const bk = item.book_id;
      if (!cidMap[item.cid].books[bk]) {
        cidMap[item.cid].books[bk] = {
          bookId: item.book_id,
          bookName: item.book_name,
          chapters: [],
        };
      }
      cidMap[item.cid].books[bk].chapters.push(item);
    }
    return Object.values(cidMap).map((c) => ({
      ...c,
      books: Object.values(c.books),
    }));
  });

  /** 执行搜索 */
  async function doSearch(q, append = false) {
    const trimmed = q.trim();
    if (!trimmed) return;

    if (append) {
      loadingMore = true;
    } else {
      loading = true;
      offset = 0;
      results = [];
      total = 0;
      hasMore = false;
      error = "";
      searched = true;
    }

    try {
      const params = new URLSearchParams({
        q: trimmed,
        lang: "zh",
        limit: "20",
        offset: String(offset),
      });
      if (scopeCid !== undefined) {
        params.set("cid", String(scopeCid));
      }
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) {
        let errMsg = "搜索请求失败";
        try {
          const err = await res.json();
          errMsg = err.error || err.details || errMsg;
        } catch (_) {
          /* 忽略 JSON 解析错误 */
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      results = append
        ? [...results, ...(data.results ?? [])]
        : (data.results ?? []);
      total = data.total ?? 0;
      hasMore = data.hasMore ?? false;
    } catch (e) {
      console.error("[search] error:", e);
      error = e.message || "搜索出错，请稍后重试";
      if (!append) {
        results = [];
        total = 0;
        hasMore = false;
      }
    } finally {
      loading = false;
      loadingMore = false;
    }
  }

  /** 提交搜索（回车 / 点击按钮） */
  async function submitSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    await doSearch(trimmed);
  }

  /** 导航到原文段落 */
  function goToParagraph(r) {
    goto(`/${r.cid}/${r.book_id}/${r.chapter_id}#zh-${r.id}`);
  }

  /** 给匹配词高亮 */
  function highlightText(text, keyword) {
    if (!keyword || !text) return text;
    const words = keyword.trim().split(/\s+/).filter(Boolean);
    let result = text;
    for (const w of words) {
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(
        new RegExp(`(${escaped})`, "gi"),
        "<mark style='background:#b3e6b3;padding:0 2px;border-radius:2px'>$1</mark>",
      );
    }
    return result;
  }

  /** 切换搜索范围 */
  async function setScope(cid) {
    scopeCid = cid;
    if (searched) {
      const trimmed = query.trim();
      if (trimmed) await doSearch(trimmed);
    }
  }

  /** 切换分类折叠 */
  function toggleCat(cid) {
    expanded[cid] = !expanded[cid];
  }

  /** 加载更多 */
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    offset = results.length;
    await doSearch(query, true);
  }

  /** 滚动检测：触底加载更多 */
  function onScroll(e) {
    if (!hasMore || loadingMore) return;
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore();
    }
  }

  // 页面加载时如果 URL 有 q 参数则自动搜索
  onMount(() => {
    const q = page.url.searchParams.get("q");
    if (q && q.trim()) {
      query = q;
      scopeCid = page.url.searchParams.get("cid") ?? undefined;
      doSearch(q).catch((e) => console.error("[search] onMount error:", e));
    }
  });

  // 开发调试：监听 loading 变化
  $effect(() => {
    if (import.meta.env.DEV && loading) {
      console.log("[search] loading started, query:", query);
    }
  });
  $effect(() => {
    if (import.meta.env.DEV && !loading && searched) {
      console.log(
        "[search] loading finished, results:",
        results.length,
        "total:",
        total,
      );
    }
  });

  // 搜索完成后默认展开所有分类
  $effect(() => {
    if (searched && !loading) {
      for (const cat of grouped) {
        if (expanded[cat.cid] === undefined) {
          expanded[cat.cid] = true;
        }
      }
    }
  });
</script>

<svelte:head>
  <title>{query ? `搜索: ${query}` : "搜索"} - 脚前的灯</title>
</svelte:head>

<article w-full flex-1 flex flex-col min-h-0>
  <!-- 搜索输入区 -->
  <section
    w-full
    flex-shrink-0
    flex-cc
    gap-2
    px-4
    py-3
    bg="white dark:black"
    b-b="1px solid gray-200 dark:gray-700"
  >
    <div flex-1 flex-cc gap-2 px-3 py-1.5 rounded-2 bg="gray-100 dark:gray-800">
      <span i-carbon-search text-5 text-gray-400></span>
      <input
        type="text"
        maxlength="100"
        bind:value={query}
        placeholder="输入关键词搜索"
        class="b-0 ring-0 px-1 outline-0 flex-1 bg-transparent"
        onkeydown={(e) => {
          if (e.key === "Enter") submitSearch();
        }}
      />
      {#if query}
        <button
          text-5
          text-gray-400
          aria-label="清除搜索"
          onclick={() => {
            query = "";
            results = [];
            total = 0;
            searched = false;
            error = "";
          }}
        >
          <span i-carbon-close></span>
        </button>
      {/if}
    </div>
    <button
      px-4
      py-1.5
      rounded-2
      bg="green"
      text-white
      font-500
      class:opacity-50={!query.trim()}
      disabled={!query.trim()}
      onclick={submitSearch}
    >
      搜索
    </button>
  </section>

  <!-- 范围筛选 -->
  <section
    w-full
    flex-shrink-0
    flex-cc
    gap-2
    px-4
    py-2
    b-b="1px solid gray-200 dark:gray-700"
  >
    {#each SCOPES as { cid, label }}
      <button
        px-3
        py-1
        rounded-full
        text-sm
        border="1px solid gray-300 dark:gray-600"
        class:bg-green={scopeCid === cid}
        class:text-white={scopeCid === cid}
        class:text-gray-600={scopeCid !== cid}
        class:bg-transparent={scopeCid !== cid}
        class="dark:text-gray-300"
        onclick={() => setScope(cid)}
      >
        {label}
      </button>
    {/each}
  </section>

  <!-- 搜索结果区 -->
  <section
    w-full
    flex-1
    overflow-y-auto
    px-3
    py-2
    space-y-3
    onscroll={onScroll}
  >
    {#if loading}
      <div w-full h-32 flex-cc text-gray-400>
        <span i-carbon-loading text-8 animate-spin></span>
        <span ml-2>搜索中…</span>
      </div>
    {:else if error}
      <div w-full h-32 flex-cc text-red>
        <span i-carbon-warning text-6></span>
        <span ml-2>{error}</span>
      </div>
    {:else if searched && results.length === 0}
      <div w-full h-32 flex-cc flex-col text-gray-400 gap-2>
        <span i-carbon-search text-8></span>
        <span>未找到与 "<strong>{query}</strong>" 相关的内容</span>
      </div>
    {:else if searched}
      <div text-sm text-gray-400 mb-1>
        共找到 <strong text-green>{total}</strong>
        条结果{#if total > results.length}
          <span text-gray-400>（显示前 {results.length} 条）</span>
        {/if}
        {#if query}
          包含 "<strong>{query}</strong>"
        {/if}
      </div>

      {#each grouped as cat (cat.cid)}
        <!-- 分类标题（可点击折叠） -->
        <button
          w-full
          flex
          items-center
          gap-2
          px-3
          py-1.5
          text-sm
          font-600
          text-green
          bg="green/5 dark:green/10"
          rounded-2
          onclick={() => toggleCat(cat.cid)}
        >
          <span
            text-xs
            transition-transform
            class:rotate-90={expanded[cat.cid]}
          >
            <span i-carbon-chevron-right></span>
          </span>
          {CID_NAMES[cat.cid] ?? `分类 ${cat.cid}`}
          <span text-xs text-gray-400 ml-auto>
            {cat.books.reduce((s, b) => s + b.chapters.length, 0)} 条
          </span>
        </button>

        {#if expanded[cat.cid]}
          {#each cat.books as book (book.bookId)}
            <section
              bg="white dark:gray-900"
              rounded-2
              overflow-hidden
              b="1px solid gray-200 dark:gray-700"
            >
              <a
                href="/{cat.cid}/{book.bookId}"
                data-sveltekit-replacestate
                block
                px-3
                py-2
                font-500
                text-green
                b-b="1px solid gray-100 dark:gray-700"
                class="hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {book.bookName}
                <span text-xs text-gray-400 ml-1>
                  ({book.chapters.length} 条)
                </span>
              </a>

              {#each book.chapters as r (r.rowid)}
                <button
                  w-full
                  text-left
                  px-3
                  py-2
                  flex
                  gap-2
                  b-b="1px solid gray-50 dark:gray-800"
                  class="hover:bg-gray-50 dark:hover:bg-gray-800"
                  onclick={() => goToParagraph(r)}
                >
                  <span
                    text-xs
                    font-mono
                    text-gray-400
                    mt-0.5
                    flex-shrink-0
                    w-6
                    text-right
                  >
                    {r._seq}
                  </span>
                  <div flex-1 min-w-0>
                    <div text-sm font-500 text-gray-500 mb-1>
                      第 {r.chapter_id} 章 · {r.chapter_title}
                      {#if r.num != null}
                        <span text-gray-400>({r.num})</span>
                      {/if}
                    </div>
                    <div
                      text="sm black/85 dark:white/85"
                      leading="160%"
                      line-clamp-3
                    >
                      {@html highlightText(r.text_content, query)}
                    </div>
                  </div>
                </button>
              {/each}
            </section>
          {/each}
        {/if}
      {/each}

      {#if loadingMore}
        <div w-full py-4 flex-cc text-gray-400>
          <span i-carbon-loading text-6 animate-spin></span>
          <span ml-2>加载中…</span>
        </div>
      {:else if hasMore}
        <div w-full py-4 flex-cc text-gray-400 text-sm>
          <span>向下滚动加载更多</span>
        </div>
      {:else if results.length < total}
        <div w-full py-4 flex-cc text-gray-400 text-sm>
          <span>已加载全部 {total} 条结果</span>
        </div>
      {/if}
    {:else}
      <div w-full h-48 flex-cc flex-col text-gray-400 gap-3>
        <span i-carbon-search text-12></span>
        <span>输入关键词搜索</span>
      </div>
    {/if}
  </section>
</article>
