<script>
  let {
    chapter,
    chExpanded,
    onToggleChapter,
    onGoToChapter,
    onOpenDetail,
  } = $props();
</script>

<div class="mb-1">
  <div
    class="w-full flex items-center gap-1.5 text-left px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
    onclick={() => onToggleChapter(chapter.chKey)}
    role="button"
    tabindex="0"
    aria-expanded={chExpanded}
    onkeydown={(e) => e.key === "Enter" && onToggleChapter(chapter.chKey)}
  >
    <span
      class={["text-xs text-gray-400 transition-transform", chExpanded ? "rotate-90" : ""]}
    >
      <span class="i-carbon-chevron-right"></span>
    </span>
    <span class="text-xs text-gray-500 dark:text-gray-400 flex-1">{chapter.chapter_title}</span>
    <span class="text-xs text-gray-400 mr-1">{chapter.segmentCount} 处</span>
    <button
      class="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-green shrink-0 mr-1"
      title="跳转到此章节"
      onclick={(e) => { e.stopPropagation(); onGoToChapter?.(); }}
      aria-label="跳转到章节"
    >
      <span class="i-carbon-arrow-right text-4"></span>
    </button>
  </div>

  {#if chExpanded}
    <div class="mt-1 pl-4 space-y-1">
      {#each chapter.items as item}
        {@const segCount = item.segments?.length ?? 0}
        <div
          class="flex items-center rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
        >
          <!-- Main clickable area -->
          <button
            class="flex-1 flex items-center gap-2 px-3 py-3 text-left text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            onclick={() => chapter.onJump?.(item)}
            title="跳转到此段落"
          >
            <span class="text-gray-300 dark:text-gray-600 shrink-0">
              <span class="i-carbon-location text-4"></span>
            </span>
            <span class="flex-1">
              <span>第{item.p_index}段</span>
              <span class="ml-1.5 text-xs text-gray-400">{segCount} 处标记</span>
            </span>
          </button>

          <!-- Divider -->
          <div class="w-px h-8 bg-gray-100 dark:bg-gray-800 shrink-0"></div>

          <!-- Detail button -->
          <button
            class="px-3 h-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-green hover:bg-gray-50 dark:hover:bg-gray-800 shrink-0 transition-colors"
            title="查看详情"
            onclick={() => onOpenDetail(item)}
          >
            <span class="i-carbon-list text-4"></span>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
