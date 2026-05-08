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

  // ── Category tabs ──
  const TABS = SCOPES;

  /** Currently selected tab cid (default Bible 0) */
  let activeCid = $state(0);

  /** Group by book under the current tab */
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

  /** Scroll container reference */
  let scrollContainer = $state(null);

  /** Per-book collapse state (by bookId) */
  let bookExpanded = $state({});

  /** Switch tab */
  async function switchTab(cid) {
    if (cid === activeCid) return;
    activeCid = cid;
    searchState.scopeCid = cid;
    bookExpanded = {};

    // Sync cid param to URL (only update address bar, don't trigger SvelteKit navigation lifecycle)
    // Prevent afterNavigate → recordNavigation from pushing current URL into history stack
    const url = new URL(page.url);
    url.searchParams.set("cid", String(cid));
    history.replaceState(history.state, "", url.toString());

    // Always re-search when switching categories (store doesn't cache results per cid)
    await doSearch(searchState.query, cid);

    // Expand all books
    requestAnimationFrame(() => {
      if (scrollContainer) scrollContainer.scrollTop = 0;
    });
  }

  /**
   * Auto-load more when content doesn't fill the viewport
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
      // Check again after DOM update (recurse until filled or no more data)
      requestAnimationFrame(() => autoLoadIfNeeded());
    }
  }

  /** Toggle book collapse */
  function toggleBook(bookId) {
    bookExpanded[bookId] = !bookExpanded[bookId];
    // Content may become shorter after collapsing, check auto-load
    requestAnimationFrame(() => autoLoadIfNeeded());
  }

  /** Whether all results have been loaded */
  let isFullyLoaded = $derived(
    searchState.searched && searchState.results.length === searchState.total,
  );

  /** Collapse/expand all with one click */
  let allExpanded = $derived(
    grouped.length > 0 && grouped.every((b) => bookExpanded[b.bookId]),
  );
  function toggleAll() {
    if (isFullyLoaded) {
      // All loaded: toggle collapse/expand
      const expand = !allExpanded;
      for (const book of grouped) {
        bookExpanded[book.bookId] = expand;
      }
    } else {
      // Not all loaded: collapse all
      for (const book of grouped) {
        bookExpanded[book.bookId] = false;
      }
    }
    requestAnimationFrame(() => {
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
        // Auto-trigger load more after scrolling to bottom
        if (!isFullyLoaded && searchState.hasMore && !searchState.loadingMore) {
          loadMore();
        }
      }
      autoLoadIfNeeded();
    });
  }

  /** Load more */
  async function loadMore() {
    if (searchState.loadingMore || !searchState.hasMore) return;
    await doSearch(searchState.query, searchState.scopeCid, true);
  }

  /** Scroll detection */
  function onScroll(e) {
    if (!searchState.hasMore || searchState.loadingMore) return;
    const el = e.target;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      loadMore();
    }
  }

  /** Back to input page */
  function backToInput() {
    const cidParam =
      searchState.scopeCid !== undefined ? `&cid=${searchState.scopeCid}` : "";
    goto(`/search?q=${encodeURIComponent(searchState.query)}${cidParam}`);
  }

  // ── Save current state (for restoration when returning) ──
  function saveState() {
    if (scrollContainer) {
      searchState.scrollTop = scrollContainer.scrollTop;
    }
    searchState.expanded = { ...bookExpanded };
  }

  // ── Page initialization ──
  onMount(() => {
    const urlQuery = page.url.searchParams.get("q") || "";
    const urlCidParam = page.url.searchParams.get("cid");
    const urlCid = urlCidParam ? parseInt(urlCidParam) : undefined;

    // Default: use URL's cid if present, otherwise use Bible 0
    const initCid = urlCid !== undefined ? urlCid : 0;
    activeCid = initCid;

    // Restore previous collapse state
    if (Object.keys(searchState.expanded).length > 0) {
      bookExpanded = { ...searchState.expanded };
    }

    if (urlQuery.trim()) {
      // doSearch checks cache first, returns cached results without API call
      searchState.query = urlQuery;
      searchState.scopeCid = initCid;
      doSearch(urlQuery, initCid);
    }
  });

  // After search completes: restore scroll position → expand books → auto-load
  $effect(() => {
    if (searchState.searched && !searchState.loading) {
      // Restore scroll position first (wait for DOM to render)
      requestAnimationFrame(() => {
        if (scrollContainer && searchState.scrollTop > 0) {
          scrollContainer.scrollTop = searchState.scrollTop;
        }
      });

      // Expand books without saved collapse state (skip those restored from searchState.expanded)
      for (const item of searchState.results) {
        if (bookExpanded[item.book_id] === undefined) {
          bookExpanded[item.book_id] = true;
        }
      }

      // Check content height after DOM update, auto-load more if not filled
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
  <!-- Top bar -->
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

  <!-- Category tabs bar -->
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

  <!-- Collapse all / Expand all (outside scroll container, always visible) -->
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
            isFullyLoaded && allExpanded ? "rotate-90" : "rotate-0",
            "transition-transform",
          ]}
        >
          <span class="i-carbon-chevron-right"></span>
        </span>
        {isFullyLoaded ? "全部已加载" : "折叠全部"}
      </button>
      <span class="flex-1"></span>
      <span class="text-xs text-gray-400">
        {grouped.length} 本书
      </span>
    </div>
  {/if}

  <!-- Search results area -->
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
      <!-- ====== Grouped by book ====== -->
      {#each grouped as book (book.bookId)}
        <section
          class="bg-white dark:bg-gray-900 border-t border-b border-gray-200 dark:border-gray-700
          shadow-sm
          mb-3"
        >
          <!-- Book title (sticky, fixed at top while scrolling) -->
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
                <!-- Sequence number + book info → same line -->
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
                <!-- Search result content → separate line -->
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
          <!-- Placeholder spacer: keep section taller than title when collapsed, so sticky works -->
          <div class="h-1"></div>
        </section>
      {/each}

      <!-- Load more -->
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
