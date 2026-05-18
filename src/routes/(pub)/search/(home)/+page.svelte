<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { safeGoBack } from "$lib";
  import {
    searchState,
    searchHistory,
    SCOPES,
  } from "$lib/bible/searchStore.svelte.js";

  /** Scope selection options */
  const SCOPE_OPTIONS = SCOPES;

  /**
   * Hot search keywords — fetched from KV-backed API on mount.
   * Only shows when users have actually searched (data exists in KV).
   * Each entry includes a search count.
   */
  let hotKeywords = $state(
    /** @type {Array<{text: string, count: number}>} */ ([]),
  );

  /** Local reference to ensure reactivity */
  let historyItems = $state(searchHistory);

  /** Watch searchHistory changes and sync locally */
  $effect(() => {
    historyItems = searchHistory;
  });

  /** Read initial search query and scope from URL */
  let query = $state(page.url.searchParams.get("q") || "");
  let scopeCid = $state(
    page.url.searchParams.get("cid") || (searchState.scopeCid ?? 0),
  );

  /** Input element reference (auto focus) */
  let inputEl = $state(null);

  /** Submit search */
  function submitSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    // Save to store, navigate to results page
    searchState.query = trimmed;
    searchState.scopeCid = scopeCid;
    const cidParam = scopeCid !== undefined ? `&cid=${scopeCid}` : "";
    goto(`/search/results?q=${encodeURIComponent(trimmed)}${cidParam}`);
  }

  /** Clear input */
  function clearQuery() {
    query = "";
    inputEl?.focus();
  }

  /** Click a hot keyword or history item to search */
  function searchKeyword(keyword) {
    query = keyword;
    submitSearch();
  }

  /** Fetch hot keywords from KV-backed API */
  async function fetchHotKeywords() {
    try {
      const res = await fetch("/api/search/hot");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          hotKeywords = data;
        }
      }
    } catch (e) {
      console.warn("[search] Failed to fetch hot keywords:", e.message);
    }
  }

  // Auto focus after mount, fetch hot keywords
  onMount(() => {
    requestAnimationFrame(() => {
      inputEl?.focus();
    });
    fetchHotKeywords();
  });
</script>

<svelte:head>
  <title>搜索 - 脚前的灯</title>
</svelte:head>

<article w-full flex-1 flex flex-col min-h-0 overflow-hidden>
  <!-- Search input area -->
  <section
    w-full
    flex-shrink-0
    px-4
    py-3
    bg="white dark:black"
    b-b="1px solid gray-200 dark:gray-700"
  >
    <!-- Search bar + back -->
    <div flex-cc gap-2>
      <button
        text-5
        text-gray-500
        aria-label="返回"
        onclick={() => safeGoBack()}
      >
        <span i-carbon-arrow-left></span>
      </button>

      <div
        flex-1
        min-w-0
        flex-cc
        gap-1
        px-2
        py-1.5
        rounded-2
        bg="gray-100 dark:gray-800"
      >
        <span i-carbon-search text-5 text-gray-400></span>
        <input
          bind:this={inputEl}
          type="text"
          maxlength="40"
          bind:value={query}
          placeholder="搜索"
          class="b-0 ring-0 px-0.5 outline-0 flex-1 min-w-0 bg-transparent"
          onkeydown={(e) => {
            if (e.key === "Enter") submitSearch();
          }}
        />
        {#if query}
          <button
            text-5
            text-gray-400
            aria-label="清除搜索"
            onclick={clearQuery}
          >
            <span i-carbon-close></span>
          </button>
        {/if}
      </div>
      <button
        flex-shrink-0
        px-3
        py-1.5
        text-sm
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
    </div>

    <!-- Category navigation tabs (same style as results page) -->
    <div
      w-full
      flex-shrink-0
      flex
      gap-1
      mt-2
      ml-9
      scrollbar-hide
      overflow-x-auto
    >
      {#each SCOPE_OPTIONS as { cid, label }}
        <button
          px-3
          py-1.5
          text-sm
          font-500
          rounded-2
          whitespace-nowrap
          transition300
          class:bg-green={scopeCid === cid}
          class:text-white={scopeCid === cid}
          class:text-gray-500={scopeCid !== cid}
          class:bg-gray-100={scopeCid !== cid}
          class="dark:bg-gray-800 dark:text-gray-400"
          onclick={() => (scopeCid = cid)}
        >
          {label}
        </button>
      {/each}
    </div>
  </section>

  <!-- Content area -->
  <section w-full flex-1 h-full flex-col overflow-y-auto>
    <!-- ── Hot Search Keywords (only shows when there's data) ── -->
    {#if hotKeywords.length > 0}
      <div
        w-full
        flex
        items-center
        px-5
        py-2.5
        text-xs
        text-gray-400
        flex-shrink-0
      >
        <span i-carbon-fire mr-1.5></span>
        <span flex-1>热搜关键词</span>
      </div>
      <div
        w-full
        px-3
        pb-3
        grid
        grid-cols-2
        sm="flex flex-row flex-wrap"
        gap-1.5
      >
        {#each hotKeywords as { text, count } (text)}
          <button
            text-left
            px-3
            py-2
            flex
            items-center
            gap-1.5
            rounded-lg
            sm="w-auto"
            class="bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 active:bg-orange-200 dark:active:bg-orange-900/40 transition-colors"
            onclick={() => searchKeyword(text)}
          >
            <span i-carbon-fire text-orange-400 text-3 flex-shrink-0></span>
            <span class="text-gray-700 dark:text-gray-200">{text}</span>
            <span
              class="text-xs text-orange-400/70 dark:text-orange-500/70 font-mono"
            >
              {count}
            </span>
          </button>
        {/each}
      </div>
    {/if}

    {#if historyItems.length > 0}
      <!-- Search history -->
      <div
        w-full
        flex
        items-center
        px-5
        py-2.5
        text-xs
        text-gray-400
        flex-shrink-0
        b-t="1px solid gray-100 dark:gray-800"
      >
        <span i-streamline-flex-search-history-browser mr-1.5></span>
        <span flex-1>搜索历史</span>
        <button
          class="hover:text-red transition-colors"
          onclick={() => {
            searchHistory.length = 0;
            historyItems = [];
          }}
        >
          清除
        </button>
      </div>
      <div w-full px-3 pb-2 grid grid-cols-2 sm="flex flex-row flex-wrap" gap-1>
        {#each historyItems as keyword, i}
          <button
            text-left
            px-3
            py-2
            flex
            items-center
            gap-1.5
            rounded-lg
            sm="w-auto"
            class="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 transition-colors"
            onclick={() => searchKeyword(keyword)}
          >
            <span
              i-streamline-flex-search-history-browser
              text-gray-400
              text-3
              flex-shrink-0
            ></span>
            <span class="text-gray-700 dark:text-gray-200" truncate>
              {keyword}
            </span>
          </button>
        {/each}
      </div>
    {:else}
      <!-- Empty state hint -->
      <div w-full h-full flex-cc flex-col text-gray-400 gap-4 px-6>
        <span i-carbon-search text-10></span>
        <div text-center leading-relaxed>
          <p text-sm>输入关键词搜索经文和著作</p>
          <p text-xs mt-2 opacity-60>支持全文搜索，可按分类筛选</p>
        </div>
      </div>
    {/if}
  </section>
</article>
