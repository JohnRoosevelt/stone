<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { goBack } from "$lib/nav.js";
  import { DATAS } from "$lib/data.svelte.js";
  import {
    searchState,
    SCOPES,
    doSearch,
    getSnippet,
  } from "$lib/bible/searchStore.svelte.js";

  // ── 分类标签 ──
  const TABS = SCOPES;

  /** 当前选中的标签 cid（默认圣经 0） */
  let activeCid = $state(0);

  /** 按当前标签 → 直接按书分组 */
  let grouped = $derived.by(() => {
    const results = searchState.results;
    if (results.length === 0) return [];

    const bookMap = {};
    let idx = 0;
    for (const r of results) {
      const item = { ...r, _seq: ++idx };
      const bk = item.book_id;
      if (!bookMap[bk]) {
        bookMap[bk] = {
          cid: item.cid,
          bookId: item.book_id,
          bookName: item.book_name,
          chapters: [],
          count: 0,
        };
      }
      bookMap[bk].chapters.push(item);
      bookMap[bk].count++;
    }
    return Object.values(bookMap);
  });

  /** 滚动容器引用 */
  let scrollContainer = $state(null);

  /** 各书籍折叠状态（按 bookId） */
  let bookExpanded = $state({});

  /** 切换标签 */
  async function switchTab(cid) {
    if (cid === activeCid) return;
    activeCid = cid;
    searchState.scopeCid = cid;
    bookExpanded = {};

    // URL 同步 cid 参数（replaceState 不产生新历史）
    const url = new URL(page.url);
    url.searchParams.set("cid", String(cid));
    goto(url, { replaceState: true });

    // 切换分类时始终重新搜索（store 不按 cid 分别缓存结果）
    await doSearch(searchState.query, cid);

    // 展开所有书
    requestAnimationFrame(() => {
      if (scrollContainer) scrollContainer.scrollTop = 0;
    });
  }

  /** 切换书籍折叠 */
  function toggleBook(bookId) {
    bookExpanded[bookId] = !bookExpanded[bookId];
  }

  /** 加载更多 */
  async function loadMore() {
    if (searchState.loadingMore || !searchState.hasMore) return;
    await doSearch(searchState.query, searchState.scopeCid, true);
  }

  /** 滚动检测 */
  function onScroll(e) {
    if (!searchState.hasMore || searchState.loadingMore) return;
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore();
    }
  }

  /** 回输入页 */
  function backToInput() {
    const cidParam =
      searchState.scopeCid !== undefined ? `&cid=${searchState.scopeCid}` : "";
    goto(`/search?q=${encodeURIComponent(searchState.query)}${cidParam}`);
  }

  // ── 页面初始化 ──
  onMount(() => {
    const urlQuery = page.url.searchParams.get("q") || "";
    const urlCidParam = page.url.searchParams.get("cid");
    const urlCid = urlCidParam ? parseInt(urlCidParam) : undefined;

    // 默认：URL 有 cid 就用它，否则用圣经 0
    const initCid = urlCid !== undefined ? urlCid : 0;
    activeCid = initCid;

    if (urlQuery.trim()) {
      // doSearch 内部会先查缓存，有缓存直接返回不调 API
      searchState.query = urlQuery;
      searchState.scopeCid = initCid;
      doSearch(urlQuery, initCid);
    }

    requestAnimationFrame(() => {
      if (scrollContainer && searchState.scrollTop > 0) {
        scrollContainer.scrollTop = searchState.scrollTop;
      }
    });
  });

  // 搜索完成后默认展开所有书
  $effect(() => {
    if (searchState.searched && !searchState.loading) {
      for (const item of searchState.results) {
        if (bookExpanded[item.book_id] === undefined) {
          bookExpanded[item.book_id] = true;
        }
      }
    }
  });
</script>

<svelte:head>
  <title>
    {searchState.query ? `搜索: ${searchState.query}` : "搜索"} - 脚前的灯
  </title>
</svelte:head>

<article w-full flex-1 flex flex-col min-h-0>
  <!-- 顶栏 -->
  <section
    w-full
    flex-shrink-0
    flex-cc
    gap-2
    px-3
    py-2
    class="bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700"
  >
    <button text-5 text-gray-500 aria-label="返回" onclick={goBack}>
      <span i-carbon-arrow-left></span>
    </button>
    <div flex-1 text-sm class="text-gray-500 dark:text-gray-400" truncate>
      {#if searchState.query}
        <span class="text-gray-700 dark:text-gray-200" font-500>
          {searchState.query}
        </span>
        {#if searchState.total > 0}
          <span ml-1>
            <span text-gray-400>{searchState.total}</span>
            <span text-gray-400> 条</span>
          </span>
        {/if}
      {:else}
        搜索结果
      {/if}
    </div>
    <button text-sm text-green font-500 onclick={backToInput}>修改</button>
  </section>

  <!-- 分类标签栏 -->
  <section
    w-full
    flex-shrink-0
    flex
    gap-1
    px-3
    py-2
    class="border-b border-gray-100 dark:border-gray-800 scrollbar-hide"
    overflow-x-auto
  >
    {#each TABS as { cid, label } (cid)}
      <button
        px-3
        py-1.5
        text-sm
        font-500
        rounded-2
        whitespace-nowrap
        class:bg-green={activeCid === cid}
        class:text-white={activeCid === cid}
        class:text-gray-500={activeCid !== cid}
        class="dark:text-gray-400 dark:bg-gray-800"
        class:bg-gray-100={activeCid !== cid}
        onclick={() => switchTab(cid)}
      >
        {label}
        {#if activeCid === cid && searchState.total > 0}
          <span text-xs ml-1 class:opacity-80={activeCid === cid}>
            {searchState.total}
          </span>
        {/if}
      </button>
    {/each}
  </section>

  <!-- 搜索结果区 -->
  <section
    w-full
    flex-1
    overflow-y-auto
    px-3
    py-3
    space-y-3
    onscroll={onScroll}
    class="bg-gray-50 dark:bg-gray-950"
  >
    {#if searchState.loading}
      <div w-full h-40 flex-cc flex-col text-gray-400 gap-2>
        <span i-carbon-loading text-8 animate-spin></span>
        <span text-sm>搜索中…</span>
      </div>
    {:else if searchState.error}
      <div w-full h-40 flex-cc flex-col text-red gap-2>
        <span i-carbon-warning text-8></span>
        <span text-sm>{searchState.error}</span>
      </div>
    {:else if searchState.searched && searchState.results.length === 0}
      <div w-full h-40 flex-cc flex-col text-gray-400 gap-2>
        <span i-carbon-search text-10></span>
        <span text-sm>
          未找到与 "<strong class="text-gray-600 dark:text-gray-300"
            >{searchState.query}</strong
          >" 相关的内容
        </span>
      </div>
    {:else if searchState.searched && grouped.length > 0}
      <!-- ====== 按书分组 ====== -->
      {#each grouped as book (book.bookId)}
        <section
          class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
          rounded-xl
          overflow-hidden
          shadow-sm
        >
          <!-- 书籍标题 -->
          <button
            w-full
            flex
            items-center
            gap-1
            px-3
            py-2.5
            text-sm
            font-600
            text-green
            class="bg-green/5 dark:bg-green/10 hover:bg-green/10 dark:hover:bg-green/15"
            onclick={() => toggleBook(book.bookId)}
          >
            <span
              text-xs
              transition-transform
              class:rotate-90={bookExpanded[book.bookId]}
            >
              <span i-carbon-chevron-right></span>
            </span>
            {book.bookName}
            <span text-xs text-gray-400 ml-1>
              ({book.chapters.length} 条)
            </span>
          </button>

          {#if bookExpanded[book.bookId]}
            {#each book.chapters as r (r.rowid)}
              <a
                href="/{r.cid}/{r.book_id}/{r.chapter_id}#zh-{r.id}"
                w-full
                text-left
                px-3
                py-2.5
                flex
                gap-2
                class="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 active:bg-gray-100 no-underline"
                onclick={() => {
                  if (scrollContainer)
                    searchState.scrollTop = scrollContainer.scrollTop;
                }}
              >
                <span
                  font-mono
                  text-red
                  font-600
                  mt-0.5
                  flex-shrink-0
                  w-7
                  text-right
                  style:font-size="{DATAS.fontSize}px"
                >
                  {r._seq}
                </span>
                <div flex-1 min-w-0>
                  <div
                    text-gray-400
                    mb-0.5
                    style:font-size="{Math.max(DATAS.fontSize - 4, 12)}px"
                  >
                    第 {r.chapter_id} 章
                    <span class="text-gray-500">
                      第 {r.num ?? r.id} 节
                    </span>
                    {#if r.chapter_title}
                      · {r.chapter_title}
                    {/if}
                  </div>
                  <div
                    class="text-black/85 dark:text-white/85"
                    leading="170%"
                    style:font-size="{DATAS.fontSize}px"
                  >
                    {@html getSnippet(r.text_content, searchState.query)}
                  </div>
                </div>
              </a>
            {/each}
          {/if}
        </section>
      {/each}

      <!-- 加载更多 -->
      {#if searchState.loadingMore}
        <div w-full py-4 flex-cc text-gray-400 gap-2>
          <span i-carbon-loading text-5 animate-spin></span>
          <span text-sm>加载中…</span>
        </div>
      {:else if searchState.hasMore}
        <div w-full py-4 flex-cc text-gray-400 text-sm gap-1.5>
          <span i-carbon-arrow-down></span>
          <span>向下滚动加载更多</span>
          <span text-xs opacity-60>
            ({searchState.results.length}/{searchState.total})
          </span>
        </div>
      {:else if searchState.searched && searchState.results.length > 0}
        <div w-full py-4 flex-cc text-gray-400 text-sm gap-1.5>
          <span i-carbon-checkmark></span>
          <span>已加载全部 {searchState.total} 条结果</span>
        </div>
      {/if}
    {:else}
      <div w-full h-48 flex-cc flex-col text-gray-400 gap-3>
        <span i-carbon-search text-12></span>
        <span text-sm>暂无搜索结果</span>
      </div>
    {/if}
  </section>
</article>
