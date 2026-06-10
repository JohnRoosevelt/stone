<script>
  import RChapter from "./RChapter.svelte";

  let {
    book,
    expanded,
    expandedChapters,
    onToggleBook,
    onOpenBookDetail,
  } = $props();
</script>

<div class="mb-3">
  <div class="flex items-center rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
    <!-- Left: navigate to most recent annotation in this book -->
    <button
      class="flex-1 flex items-center gap-2 px-1 py-1 text-left"
      onclick={() => book.onJumpMostRecent?.()}
      title="跳转到最新标记"
    >
      <span class="text-gray-300 dark:text-gray-600">
        <span class="i-carbon-location text-4"></span>
      </span>
      <span class="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">
        {book.book_name}
      </span>
      <span class="text-xs text-gray-400 mr-1">{book.segmentCount} 处</span>
    </button>

    <!-- Divider -->
    <div class="w-px h-6 bg-gray-100 dark:bg-gray-800 shrink-0"></div>

    <!-- Expand arrow -->
    <button
      class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
      onclick={() => onToggleBook(book.key)}
      aria-label={expanded ? "收起" : "展开"}
      aria-expanded={expanded}
    >
      <span class={["text-xs transition-transform", expanded ? "rotate-90" : ""]}>
        <span class="i-carbon-chevron-right text-4"></span>
      </span>
    </button>

    <!-- Detail button -->
    <button
      class="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-green shrink-0"
      onclick={() => onOpenBookDetail(book)}
      title="管理标记"
      aria-label="管理此书的标记"
    >
      <span class="i-carbon-list text-4"></span>
    </button>
  </div>

  <!-- Chapters (shown when book expanded) -->
  {#if expanded}
    <div class="mt-1 pl-4 border-l border-gray-100 dark:border-gray-800">
      {#each book.chapterList as chapter}
        <RChapter
          chapter={chapter}
          chExpanded={expandedChapters.has(chapter.chKey)}
          onToggleChapter={chapter.toggle}
          onGoToChapter={chapter.onGoToChapter}
          onOpenDetail={chapter.onOpenDetail}
        />
      {/each}
    </div>
  {/if}
</div>
