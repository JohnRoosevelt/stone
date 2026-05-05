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

  /** 范围选择选项 */
  const SCOPE_OPTIONS = SCOPES;

  /** 本地引用以确保响应性 */
  let historyItems = $state(searchHistory);

  /** 监听 searchHistory 变化同步到本地 */
  $effect(() => {
    historyItems = searchHistory;
  });

  /** 从 URL 读取初始搜索词和范围 */
  let query = $state(page.url.searchParams.get("q") || "");
  let scopeCid = $state(
    page.url.searchParams.get("cid") || (searchState.scopeCid ?? 0),
  );

  /** 输入框引用（自动 focus） */
  let inputEl = $state(null);

  /** 提交搜索 */
  function submitSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;
    // 保存到 store，导航到结果页
    searchState.query = trimmed;
    searchState.scopeCid = scopeCid;
    const cidParam = scopeCid !== undefined ? `&cid=${scopeCid}` : "";
    goto(`/search/results?q=${encodeURIComponent(trimmed)}${cidParam}`);
  }

  /** 清除输入 */
  function clearQuery() {
    query = "";
    inputEl?.focus();
  }

  /** 点击历史标签快速搜索 */
  function searchKeyword(keyword) {
    query = keyword;
    submitSearch();
  }

  // 挂载后自动聚焦
  onMount(() => {
    requestAnimationFrame(() => {
      inputEl?.focus();
    });
  });
</script>

<svelte:head>
  <title>搜索 - 脚前的灯</title>
</svelte:head>

<article w-full flex-1 flex flex-col min-h-0 overflow-hidden>
  <!-- 搜索输入区 -->
  <section
    w-full
    flex-shrink-0
    px-4
    py-3
    bg="white dark:black"
    b-b="1px solid gray-200 dark:gray-700"
  >
    <!-- 搜索条 + 返回 -->
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

    <!-- 范围选择标签 -->
    <div flex-cc gap-1.5 mt-2 ml-9>
      {#each SCOPE_OPTIONS as { cid, label }}
        <button
          px-2.5
          py-1
          text-xs
          rounded-full
          font-500
          whitespace-nowrap
          transition300
          class:bg-green={scopeCid === cid}
          class:text-white={scopeCid === cid}
          class:bg-gray-100={scopeCid !== cid}
          class:text-gray-500={scopeCid !== cid}
          class="dark:bg-gray-800 dark:text-gray-400"
          onclick={() => (scopeCid = cid)}
        >
          {label}
        </button>
      {/each}
    </div>
  </section>

  <!-- 内容区 -->
  <section w-full flex-1 h-full flex-col overflow-y-auto>
    {#if historyItems.length > 0}
      <!-- 搜索历史 -->
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
        <span i-carbon-history mr-1.5></span>
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
            <span i-carbon-history text-gray-400 text-3 flex-shrink-0></span>
            <span class="text-gray-700 dark:text-gray-200" truncate>
              {keyword}
            </span>
          </button>
        {/each}
      </div>
    {:else}
      <!-- 空状态提示 -->
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
