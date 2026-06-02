<script>
  import { checkForUpdate, updater } from "$lib/updater.svelte.js";

  /** @type {{ appVersion: string }} */
  let { appVersion } = $props();
</script>

<div
  class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
>
  <button
    class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
    onclick={() => checkForUpdate(false)}
    disabled={updater.checking}
  >
    <span class="flex-cc gap-2">
      {#if updater.checking}
        <span class="i-line-md-loading-twotone-loop animate-spin text-green"
        ></span>
      {:else}
        <span class="i-carbon-update-now text-green"></span>
      {/if}
      检查更新
    </span>
    <span>
      <span class="text-xs text-gray-400">
        {#if updater.checking}
          检查中...
        {:else}
          {appVersion ? `v${appVersion}` : "点击检查"}
        {/if}
      </span>
      <span class="i-carbon-chevron-right text-gray-400"></span>
    </span>
  </button>
</div>
