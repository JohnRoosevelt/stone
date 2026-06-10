<script>
  import { goto } from "$app/navigation";

  let { book = null, onDeleteBook, onClose } = $props();

  let dialogEl = $state(null);
  let deleting = $state(false);

  $effect(() => {
    if (book && dialogEl && !dialogEl.open) {
      dialogEl.showModal();
    }
  });

  function close() {
    dialogEl?.close();
  }

  function goToChapter(chapterId) {
    goto(`/${book.cid}/${book.book_id}/${chapterId}`);
    close();
  }

  async function handleDelete() {
    if (deleting || !book) return;
    deleting = true;
    try {
      await onDeleteBook?.();
    } finally {
      deleting = false;
    }
  }
</script>

<dialog bind:this={dialogEl} onclose={onClose}>
  {#if book}
    {@const chList = book.chapterList}
    {@const total = chList.reduce((s,c) => s + c.segmentCount, 0)}

    <div class="rounded-2xl p-6 w-80 border-0 shadow-xl bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100">
      <div class="flex items-center justify-between mb-4">
        <div>
          <div class="font-medium">{book.book_name}</div>
          <div class="text-xs text-gray-400 mt-0.5">{chList.length} 章 · {total} 处标记</div>
        </div>
        <button
          class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onclick={close}
          aria-label="关闭"
        >
          <span class="i-carbon-close text-4"></span>
        </button>
      </div>

      <div class="space-y-2 max-h-60 overflow-y-auto mb-4">
        {#each chList as ch}
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs">
            <span class="flex-1 text-gray-500 dark:text-gray-400">{ch.chapter_title}</span>
            <span class="text-gray-400 mr-2">{ch.segmentCount} 处</span>
            <button
              class="text-gray-400 hover:text-green shrink-0"
              onclick={() => goToChapter(ch.chapter_id)}
              aria-label="跳转到此章节"
            >
              <span class="i-carbon-arrow-right text-4"></span>
            </button>
          </div>
        {/each}
      </div>

      <div class="flex gap-2">
        <button
          class="flex-1 px-4 py-2 rounded-lg bg-red text-white text-sm disabled:opacity-50"
          onclick={handleDelete}
          disabled={deleting}
        >
          {#if deleting}<span class="i-line-md-loading-twotone-loop text-3 animate-spin"></span>{:else}删除此书全部标记{/if}
        </button>
        <button
          class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm"
          onclick={close}
        >
          关闭
        </button>
      </div>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    margin: auto;
    position: fixed;
    inset: 0;
    border: none;
    background: transparent;
  }
  dialog::backdrop {
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(2px);
  }
</style>
