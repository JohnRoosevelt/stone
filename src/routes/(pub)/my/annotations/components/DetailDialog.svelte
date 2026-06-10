<script>
  let { detailItem = null, onDelete, onClose } = $props();

  let dialogEl = $state(null);
  let deleting = $state(false);

  $effect(() => {
    if (detailItem && dialogEl && !dialogEl.open) {
      dialogEl.showModal();
    }
  });

  function close() {
    dialogEl?.close();
  }

  async function handleDelete() {
    if (deleting) return;
    deleting = true;
    try {
      await onDelete?.(detailItem.id);
    } finally {
      deleting = false;
    }
  }
</script>

<dialog bind:this={dialogEl} onclose={onClose}>
  {#if detailItem}
    <div class="rounded-2xl p-6 w-80 border-0 shadow-xl bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100">
      <div class="flex items-center justify-between mb-4">
        <div>
          <div class="font-medium">标记详情</div>
          <div class="text-xs text-gray-400 mt-0.5">
            第{detailItem.p_index}段 · {detailItem.segments.length} 处标记
          </div>
        </div>
        <button
          class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          onclick={close}
          aria-label="关闭"
        >
          <span class="i-carbon-close text-4"></span>
        </button>
      </div>

      <div class="space-y-2 max-h-64 overflow-y-auto mb-4">
        {#each detailItem.segments as seg}
          <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs">
            <span
              class="w-4 h-4 rounded shrink-0 border"
              style="background:{seg.style==='bg'?seg.color:'transparent'};border-color:{seg.color};text-decoration:{seg.style==='underline'?`underline ${seg.color}`:seg.style==='underline_wavy'?`underline wavy ${seg.color}`:'none'};color:{seg.style==='text'?seg.color:'inherit'};"
            ></span>
            <span class="flex-1 text-gray-500 dark:text-gray-400">第 {seg.start+1}–{seg.end} 字</span>
            <span class="text-gray-400">
              {seg.style==="bg"?"背景色":seg.style==="underline"?"下划线":seg.style==="underline_wavy"?"波浪线":seg.style==="text"?"文字色":seg.style}
            </span>
          </div>
        {/each}
      </div>

      <div class="flex gap-2">
        <button
          class="flex-1 px-4 py-2 rounded-lg bg-red text-white text-sm disabled:opacity-50"
          onclick={handleDelete}
          disabled={deleting}
        >
          {#if deleting}<span class="i-line-md-loading-twotone-loop text-3 animate-spin"></span>{:else}删除全部标记{/if}
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
