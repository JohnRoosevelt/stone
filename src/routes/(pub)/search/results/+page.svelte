<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { safeGoBack } from "$lib";
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

    // URL 同步 cid 参数（仅更新地址栏，不触发 SvelteKit 导航生命周期）
    // 避免 afterNavigate → recordNavigation 将当前 URL 误入历史栈
    const url = new URL(page.url);
    url.searchParams.set("cid", String(cid));
    history.replaceState(history.state, "", url.toString());

    // 切换分类时始终重新搜索（store 不按 cid 分别缓存结果）
    await doSearch(searchState.query, cid);

    // 展开所有书
    requestAnimationFrame(() => {
      if (scrollContainer) scrollContainer.scrollTop = 0;
    });
  }

  /**
   * 内容未填满时自动加载更多
   */
  async function autoLoadIfNeeded() {
    if (
      !scrollContainer ||
      !searchState.hasMore ||
      searchState.loadingMore ||
      searchState.loading
    )
      return;
    const el = scrollContainer;
    if (el.scrollHeight - el.clientHeight < 200) {
      await loadMore();
      // DOM 更新后再次检查（递归直到填满或无更多数据）
      requestAnimationFrame(() => autoLoadIfNeeded());
    }
  }

  /** 切换书籍折叠 */
  function toggleBook(bookId) {
    bookExpanded[bookId] = !bookExpanded[bookId];
    // 折叠后内容变短可能导致无滚动条，检查自动加载更多
    requestAnimationFrame(() => autoLoadIfNeeded());
  }

  /** 一键折叠/展开所有 */
  let allExpanded = $derived(
    grouped.length > 0 && grouped.every((b) => bookExpanded[b.bookId]),
  );
  function toggleAll() {
    const expand = !allExpanded;
    for (const book of grouped) {
      bookExpanded[book.bookId] = expand;
    }
    requestAnimationFrame(() => autoLoadIfNeeded());
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

  // ── 保存当前状态（供返回时恢复）──
  function saveState() {
    if (scrollContainer) {
      searchState.scrollTop = scrollContainer.scrollTop;
    }
    searchState.expanded = { ...bookExpanded };
  }

  // ── 页面初始化 ──
  onMount(() => {
    const urlQuery = page.url.searchParams.get("q") || "";
    const urlCidParam = page.url.searchParams.get("cid");
    const urlCid = urlCidParam ? parseInt(urlCidParam) : undefined;

    // 默认：URL 有 cid 就用它，否则用圣经 0
    const initCid = urlCid !== undefined ? urlCid : 0;
    activeCid = initCid;

    // 恢复上次的折叠状态
    if (Object.keys(searchState.expanded).length > 0) {
      bookExpanded = { ...searchState.expanded };
    }

    if (urlQuery.trim()) {
      // doSearch 内部会先查缓存，有缓存直接返回不调 API
      searchState.query = urlQuery;
      searchState.scopeCid = initCid;
      doSearch(urlQuery, initCid);
    }
  });

  // 搜索完成后：恢复滚动位置 → 展开新书 → 自动加载
  $effect(() => {
    if (searchState.searched && !searchState.loading) {
      // 先恢复滚动位置（等 DOM 渲染完）
      requestAnimationFrame(() => {
        if (scrollContainer && searchState.scrollTop > 0) {
          scrollContainer.scrollTop = searchState.scrollTop;
        }
      });

      // 展开未设置折叠状态的书（已从 searchState.expanded 恢复的跳过）
      for (const item of searchState.results) {
        if (bookExpanded[item.book_id] === undefined) {
          bookExpanded[item.book_id] = true;
        }
      }

      // 等 DOM 更新后检查内容高度，未填满时自动加载更多
      requestAnimationFrame(() => autoLoadIfNeeded());
    }
  });
</script>

<svelte:head>
  <title>
    {searchState.query ? `搜索: ${searchState.query}` : "搜索"} - 脚前的灯
  </title>
</svelte:head>

<article class="w-full flex-1 flex flex-col min-h-0">
  <!-- 顶栏 -->
  <section
    class="bg-white dark:(bg-black border-gray-700) border-b border-gray-200 w-full flex-shrink-0 flex-cc gap-2 px-3 py-2"
  >
    <button
      class="text-5 text-gray-500"
      aria-label="返回"
      onclick={() => safeGoBack("/search")}
    >
      <span class="i-carbon-arrow-left"></span>
    </button>
    <div flex-1 text-sm class="text-gray-500 dark:text-gray-400" truncate>
      {#if searchState.query}
        <span class="text-gray-700 dark:text-gray-200" font-500>
          {searchState.query}
        </span>
        {#if searchState.total > 0}
          <span class="ml-1">
            <span class="text-gray-400">{searchState.total}</span>
            <span class="text-gray-400"> 条</span>
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
    class="w-full flex-shrink-0 flex gap-1 px-3 py-2 border-b border-gray-100 dark:border-gray-800 scrollbar-hide overflow-x-auto"
  >
    {#each TABS as { cid, label } (cid)}
      <button
        class="px-3 py-1.5 text-sm font-500 rounded-2 whitespace-nowrap dark:text-gray-400 dark:bg-gray-800"
        class:bg-green={activeCid === cid}
        class:text-white={activeCid === cid}
        class:text-gray-500={activeCid !== cid}
        class:bg-gray-100={activeCid !== cid}
        onclick={() => switchTab(cid)}
      >
        {label}
        {#if activeCid === cid && searchState.total > 0}
          <span class="text-xs ml-1" class:opacity-80={activeCid === cid}>
            {searchState.total}
          </span>
        {/if}
      </button>
    {/each}
  </section>

  <!-- 折叠全部/展开全部（在滚动容器外，始终可见） -->
  {#if searchState.searched && grouped.length > 0}
    <div
      class="w-full flex-shrink-0 flex-cc gap-2 px-3 py-1.5
        border-b border-gray-200 dark:border-gray-700
        bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm"
    >
      <button
        class="text-sm text-gray-400 hover:text-green flex-cc gap-1 transition-colors"
        onclick={toggleAll}
      >
        <span
          class={[
            allExpanded ? "rotate-90" : "rotate-0",
            "transition-transform",
          ]}
        >
          <span class="i-carbon-chevron-right"></span>
        </span>
        {allExpanded ? "折叠全部已加载" : "展开全部已加载"}
      </button>
      <span class="flex-1"></span>
      <span class="text-xs text-gray-400">
        {grouped.length} 本书
      </span>
    </div>
  {/if}

  <!-- 搜索结果区 -->
  <section
    bind:this={scrollContainer}
    onscroll={onScroll}
    class="bg-gray-50 dark:bg-gray-950 w-full
    flex-1
    overflow-y-auto
    pb-3"
  >
    {#if searchState.loading}
      <div class="w-full h-40 flex-cc flex-col text-gray-400 gap-2">
        <span class="i-line-md-loading-twotone-loop text-8 animate-spin"></span>
        <span class="text-sm">搜索中…</span>
      </div>
    {:else if searchState.error}
      <div class="w-full h-40 flex-cc flex-col text-red gap-2">
        <span class="i-carbon-warning text-8"></span>
        <span class="text-sm">{searchState.error}</span>
      </div>
    {:else if searchState.searched && searchState.results.length === 0}
      <div class="w-full h-40 flex-cc flex-col text-gray-400 gap-2">
        <span class="i-carbon-search text-10"></span>
        <span class="text-sm">
          未找到与 "<strong class="text-gray-600 dark:text-gray-300"
            >{searchState.query}</strong
          >" 相关的内容
        </span>
      </div>
    {:else if searchState.searched && grouped.length > 0}
      <div class="h-3"></div>
      <!-- ====== 按书分组 ====== -->
      {#each grouped as book (book.bookId)}
        <section
          class="bg-white dark:bg-gray-900 border-t border-b border-gray-200 dark:border-gray-700
          shadow-sm
          mb-3"
        >
          <!-- 书籍标题（sticky，滚动时固定在顶部） -->
          <button
            class="w-full flex items-center gap-1 px-3 py-2.5 text-sm font-600 text-green sticky
            top-0
            z-1
            bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm hover:bg-green/10 dark:hover:bg-green/15"
            onclick={() => toggleBook(book.bookId)}
          >
            <span
              class="text-xs transition-transform"
              class:rotate-90={bookExpanded[book.bookId]}
            >
              <span class="i-carbon-chevron-right"></span>
            </span>
            {book.bookName}
            <span class="text-xs text-gray-400 ml-1">
              ({book.chapters.length} 条)
            </span>
          </button>

          {#if bookExpanded[book.bookId]}
            {#each book.chapters as r (r.rowid)}
              <a
                href="/{r.cid}/{r.book_id}/{r.chapter_id}#zh-{r.id}"
                class="w-full text-left px-3 py-2.5 flex flex-col gap-1.5
                border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 active:bg-gray-100 no-underline"
                onclick={saveState}
              >
                <!-- 序号 + 书籍信息 → 同一行 -->
                <div class="flex items-center gap-2">
                  <span
                    class="font-mono text-red font-600 text-right"
                    style:font-size="{DATAS.fontSize}px"
                  >
                    {r._seq}
                  </span>
                  <div
                    class="text-gray-400"
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
                </div>
                <!-- 查出来的内容 → 单独一行 -->
                <div
                  class="text-black/85 dark:text-white/85"
                  leading="170%"
                  style:font-size="{DATAS.fontSize}px"
                >
                  {@html getSnippet(r.text_content, searchState.query)}
                </div>
              </a>
            {/each}
          {/if}
          <!-- 占位 spacer：折叠时让 section 高于标题，sticky 才能固定 -->
          <div class="h-1"></div>
        </section>
      {/each}

      <!-- 加载更多 -->
      {#if searchState.loadingMore}
        <div class="w-full py-4 flex-cc text-gray-400 gap-2">
          <span class="i-line-md-loading-twotone-loop text-5 animate-spin"
          ></span>
          <span class="text-sm">加载中…</span>
        </div>
      {:else if searchState.hasMore}
        <div class="w-full py-4 flex-cc text-gray-400 text-sm gap-1.5">
          <span class="i-carbon-arrow-down"></span>
          <span>向下滚动加载更多</span>
          <span class="text-xs opacity-60">
            ({searchState.results.length}/{searchState.total})
          </span>
        </div>
      {:else if searchState.searched && searchState.results.length > 0}
        <div class="w-full py-4 flex-cc text-gray-400 text-sm gap-1.5">
          <span class="i-carbon-checkmark"></span>
          <span>已加载全部 {searchState.total} 条结果</span>
        </div>
      {/if}
    {:else}
      <div class="w-full h-48 flex-cc flex-col text-gray-400 gap-3">
        <span class="i-carbon-search text-12"></span>
        <span class="text-sm">暂无搜索结果</span>
      </div>
    {/if}
  </section>
</article>
