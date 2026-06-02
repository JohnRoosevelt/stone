<script>
  import { clearAnnotations } from "$lib/tauri";
  import { info } from "$lib/global/Toast";

  let busy = $state(false);

  async function handleClick() {
    if (busy) return;
    busy = true;
    try {
      const n = await clearAnnotations();
      info(`已清空 ${n} 条标记`);
    } catch (e) {
      console.error("[clear annotations] failed:", e);
      info("清空失败");
    } finally {
      busy = false;
    }
  }
</script>

<div
  class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
>
  <button
    class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300 disabled:opacity-50"
    onclick={handleClick}
    disabled={busy}
  >
    <span class="flex-cc gap-2">
      {#if busy}
        <span class="i-line-md-loading-twotone-loop text-4 animate-spin"
        ></span>
      {:else}
        <span class="i-carbon-trash-can text-red"></span>
      {/if}
      清空所有标记
    </span>
    <span class="i-carbon-chevron-right text-gray-400"></span>
  </button>
</div>
