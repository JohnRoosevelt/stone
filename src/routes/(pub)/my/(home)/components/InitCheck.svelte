<script>
  import { needsInitialImport, resetInitialImport } from "$lib/tauri";

  let initStatus = $state(""); // "" | "checking" | "needed" | "done" | "error"
  let initChecking = $state(false);

  async function checkInit() {
    initChecking = true;
    initStatus = "checking";
    try {
      const needed = await needsInitialImport();
      initStatus = needed ? "needed" : "done";
    } catch (e) {
      initStatus = "error";
      console.error("checkInit error:", e);
    } finally {
      initChecking = false;
    }
  }

  async function resetAndCheck() {
    initStatus = "checking";
    initChecking = true;
    try {
      await resetInitialImport();
      const needed = await needsInitialImport();
      initStatus = needed ? "needed" : "done";
    } catch (e) {
      initStatus = "error";
      console.error("resetAndCheck error:", e);
    } finally {
      initChecking = false;
    }
  }
</script>

<div
  class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
>
  <button
    class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
    onclick={checkInit}
  >
    <span class="flex-cc gap-2">
      <span
        class={[
          initStatus === "done"
            ? "i-carbon-checkmark-filled text-green"
            : initStatus === "needed"
              ? "i-carbon-warning text-orange"
              : initStatus === "error"
                ? "i-carbon-error text-red"
                : initChecking
                  ? "i-line-md-loading-twotone-loop animate-spin"
                  : "i-carbon-information text-gray-400",
        ]}
      ></span>
      初始化检查
    </span>

    <span>
      <span class="text-xs text-gray-400">
        {#if initStatus === ""}
          点击检查
        {:else if initStatus === "checking"}
          检查中...
        {:else if initStatus === "needed"}
          需要初始化
        {:else if initStatus === "done"}
          已完成
        {:else if initStatus === "error"}
          检查失败
        {/if}
      </span>
      <span class="i-carbon-chevron-right text-gray-400"></span>
    </span>
  </button>

  {#if initStatus === "needed"}
    <div
      class="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3"
    >
      <p class="text-xs text-gray-500">
        有书籍数据尚未导入，需要重新运行初始化流程。
      </p>
      <a
        href="/"
        onclick={() => setTimeout(() => location.reload(), 100)}
        class="inline-block px-4 py-2 rounded-lg bg-green text-white text-sm font-medium hover:bg-green/80 transition300"
      >
        开始初始化导入
      </a>
    </div>
  {:else if initStatus === "done"}
    <div
      class="border-t border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between"
    >
      <p class="text-xs text-gray-500">初始化已完成，所有书籍已就绪。</p>
      <button
        onclick={resetAndCheck}
        disabled={initChecking}
        class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition300"
      >
        重置并重新检查
      </button>
    </div>
  {:else if initStatus === "error"}
    <div class="border-t border-gray-100 dark:border-gray-800 px-4 py-3">
      <p class="text-xs text-red">检查失败，请稍后重试。</p>
    </div>
  {/if}
</div>
