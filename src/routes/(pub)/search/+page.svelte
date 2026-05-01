<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { goBack } from "$lib/nav.js";
  import { searchState, searchHistory } from "$lib/bible/searchStore.svelte.js";

  /** 从 URL 读取初始搜索词和范围 */
  let query = $state(page.url.searchParams.get("q") || "");
  let scopeCid = $state(
    page.url.searchParams.get("cid") || (searchState.scopeCid ?? undefined),
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
  }

  // 挂载后自动聚焦
  onMount(() => {
    // 略微延迟以确保 DOM 已渲染
    requestAnimationFrame(() => {
      inputEl?.focus();
    });
  });
</script>

<svelte:head>
  <title>搜索 - 脚前的灯</title>
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
    <!-- 返回按钮 -->
    <button text-5 text-gray-500 aria-label="返回" onclick={goBack}>
      <span i-carbon-arrow-left></span>
    </button>

    <div flex-1 flex-cc gap-2 px-3 py-1.5 rounded-2 bg="gray-100 dark:gray-800">
      <span i-carbon-search text-5 text-gray-400></span>
      <input
        bind:this={inputEl}
        type="text"
        maxlength="40"
        bind:value={query}
        placeholder="输入关键词搜索"
        class="b-0 ring-0 px-1 outline-0 flex-1 bg-transparent"
        onkeydown={(e) => {
          if (e.key === "Enter") submitSearch();
        }}
      />
      {#if query}
        <button text-5 text-gray-400 aria-label="清除搜索" onclick={clearQuery}>
          <span i-carbon-close></span>
        </button>
      {/if}
    </div>
    <button
      flex-shrink-0
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

  <!-- 历史记录 / 空状态 -->
  <section w-full flex-1 flex-col overflow-y-auto>
    {#if searchHistory.length > 0}
      <div
        w-full
        flex-1
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
          }}
        >
          清除
        </button>
      </div>
      <div w-full px-3 pb-2 grid grid-cols-2 sm="flex flex-row flex-wrap" gap-1>
        {#each searchHistory as keyword, i}
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
            onclick={() => {
              query = keyword;
              submitSearch();
            }}
          >
            <span i-carbon-history text-gray-400 text-3 flex-shrink-0></span>
            <span class="text-gray-700 dark:text-gray-200" truncate>
              {keyword}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </section>

  <div w-full flex-1 flex-cc flex-col text-gray-400 gap-4 px-6>
    <span i-carbon-download text-10></span>
    <div text-center leading-relaxed>
      <p text-sm>下载 App 获得更好的查找体验</p>
      <p text-xs mt-2 opacity-60>
        支持全文搜索、离线阅读、笔记标注<br />
        随时随地查经灵修
      </p>
    </div>
  </div>
</article>
