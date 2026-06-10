<script>
  import { safeGoBack } from "$lib";

  let { busy = $bindable(false), annotations = [], totalSegments = 0, onConfirm } = $props();

  function openConfirm() {
    if (annotations.length === 0) return;
    onConfirm?.();
  }
</script>

<div
  class="h-12 px-4 flex items-center gap-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
>
  <button
    class="w-8 h-8 flex items-center justify-center text-gray-500"
    aria-label="返回"
    onclick={() => safeGoBack("/my")}
  >
    <span class="i-carbon-arrow-left text-green-500 text-4"></span>
  </button>
  <span class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200">我的标记</span>

  {#if annotations.length > 0}
    <button
      class="text-sm text-red disabled:opacity-50"
      disabled={busy}
      onclick={openConfirm}
      aria-label="清空所有"
    >
      {#if busy}
        <span class="i-line-md-loading-twotone-loop text-4 animate-spin"></span>
      {:else}
        清空所有
      {/if}
    </button>
  {/if}
</div>
