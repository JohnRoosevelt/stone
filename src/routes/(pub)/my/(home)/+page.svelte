<script>
  import { dev } from "$app/environment";
  import { DATAS } from "$lib/data.svelte";

  let showDebug = $state(false);
  let loadingUa = $state(false);

  /** 展开调试信息时懒加载 UA 解析 */
  async function toggleDebug() {
    showDebug = !showDebug;
    if (showDebug && !DATAS.uaInfo?.ua) {
      loadingUa = true;
      try {
        const { UAParser } = await import("ua-parser-js");
        const parser = new UAParser();
        DATAS.uaInfo = parser.getResult();
      } catch (e) {
        console.warn("[UA] parse failed:", e);
      } finally {
        loadingUa = false;
      }
    }
  }
</script>

<svelte:head>
  <title>个人中心</title>
</svelte:head>

<article w-full h-full overflow-y-auto px-4 py-4 space-y-6>
  <!-- ─── 设置 ─── -->
  <section space-y-3>
    <h2 text-lg font-semibold flex-cc gap-2>
      <span i-carbon-settings></span>
      设置
    </h2>

    <div
      class="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <div flex-cc gap-3>
        <span i-carbon-sun text-xl></span>
        <div>
          <div font-medium>深色模式</div>
          <div text-sm text-gray-500>切换界面明暗主题</div>
        </div>
      </div>
      <button
        w-12
        h-7
        rounded-full
        transition300
        class:bg-green={DATAS.isDarkMode}
        class:bg-gray-300={!DATAS.isDarkMode}
        class:dark:bg-gray-600={!DATAS.isDarkMode}
        relative
        onclick={() => (DATAS.isDarkMode = !DATAS.isDarkMode)}
        aria-label="切换深色模式"
      >
        <span
          absolute
          top-0.5
          w-6
          h-6
          rounded-full
          bg-white
          shadow
          transition300
          class:left-0.5={!DATAS.isDarkMode}
          class:left-5={DATAS.isDarkMode}
        ></span>
      </button>
    </div>

    <div
      class="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <div flex-cc gap-3>
        <span i-carbon-screen text-xl></span>
        <div>
          <div font-medium>全屏阅读</div>
          <div text-sm text-gray-500>阅读时隐藏侧边栏</div>
        </div>
      </div>
      <button
        w-12
        h-7
        rounded-full
        transition300
        class:bg-green={DATAS.isFullScreen}
        class:bg-gray-300={!DATAS.isFullScreen}
        class:dark:bg-gray-600={!DATAS.isFullScreen}
        relative
        onclick={() => (DATAS.isFullScreen = !DATAS.isFullScreen)}
        aria-label="切换全屏阅读"
      >
        <span
          absolute
          top-0.5
          w-6
          h-6
          rounded-full
          bg-white
          shadow
          transition300
          class:left-0.5={!DATAS.isFullScreen}
          class:left-5={DATAS.isFullScreen}
        ></span>
      </button>
    </div>
  </section>

  <!-- ─── 功能（预留） ─── -->
  <section space-y-3>
    <h2 text-lg font-semibold flex-cc gap-2>
      <span i-carbon-bookmark></span>
      我的
    </h2>

    <div class="grid grid-cols-2 gap-3">
      <div
        class="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 opacity-60"
      >
        <span i-carbon-history text-3xl text-gray-400></span>
        <div text-sm text-gray-500>阅读历史</div>
        <div text-xs text-gray-400>即将推出</div>
      </div>

      <div
        class="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 opacity-60"
      >
        <span i-carbon-bookmark text-3xl text-gray-400></span>
        <div text-sm text-gray-500>书签</div>
        <div text-xs text-gray-400>即将推出</div>
      </div>

      <div
        class="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 opacity-60"
      >
        <span i-carbon-download text-3xl text-gray-400></span>
        <div text-sm text-gray-500>离线缓存</div>
        <div text-xs text-gray-400>即将推出</div>
      </div>

      <div
        class="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 opacity-60"
      >
        <span i-carbon-notebook text-3xl text-gray-400></span>
        <div text-sm text-gray-500>笔记</div>
        <div text-xs text-gray-400>即将推出</div>
      </div>
    </div>
  </section>

  {#if dev}
    <!-- ─── 工具（仅开发模式） ─── -->
    <section space-y-3>
      <h2 text-lg font-semibold flex-cc gap-2>
        <span i-carbon-tools></span>
        工具
      </h2>

      <div class="grid grid-cols-2 gap-3">
        <a
          href="/tools/json-parquet"
          class="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
        >
          <span i-carbon-data-structured text-2xl text-green></span>
          <div>
            <div font-medium>JSON/Parquet</div>
            <div text-sm text-gray-500>格式转换</div>
          </div>
        </a>

        <a
          href="/tools/split-parquet"
          class="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
        >
          <span i-carbon-data-table text-2xl text-green></span>
          <div>
            <div font-medium>Parquet 拆分</div>
            <div text-sm text-gray-500>章节拆分</div>
          </div>
        </a>
      </div>
    </section>
  {/if}

  <!-- ─── 网络状态 ─── -->
  <section
    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
  >
    <span
      i-carbon-circle-filled
      class:text-green={DATAS.online}
      class:text-gray-400={!DATAS.online}
    ></span>
    <span text-sm text-gray-500>
      {DATAS.online ? DATAS.networkType : "离线"}
    </span>
  </section>

  <!-- ─── 调试信息（可展开） ─── -->
  <section space-y-2>
    <button
      class="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition300"
      onclick={toggleDebug}
    >
      <span flex-cc gap-2>
        {#if loadingUa}
          <span i-carbon-loading text-4 animate-spin></span>
        {:else}
          <span i-carbon-debug></span>
        {/if}
        调试信息
      </span>
      <span
        class="transition300"
        class:rotate-180={showDebug}
        i-carbon-chevron-down
      ></span>
    </button>

    {#if showDebug}
      <div
        class="px-4 py-3 space-y-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-500"
      >
        <div>
          <span text-gray-400>device: </span>
          {DATAS.uaInfo?.device?.vendor || "-"}
          {DATAS.uaInfo?.device?.model || "-"} ({DATAS.uaInfo?.device?.type ||
            "-"})
        </div>
        <div>
          <span text-gray-400>os: </span>
          {DATAS.uaInfo?.os?.name || "-"}
          {DATAS.uaInfo?.os?.version || ""}
        </div>
        <div>
          <span text-gray-400>browser: </span>
          {DATAS.uaInfo?.browser?.name || "-"}
          {DATAS.uaInfo?.browser?.version || ""}
        </div>
        <div>
          <span text-gray-400>engine: </span>
          {DATAS.uaInfo?.engine?.name || "-"}
          {DATAS.uaInfo?.engine?.version || ""}
        </div>
        <div>
          <span text-gray-400>database: </span>
          <span text-gray-400>（待迁移至 Tauri 原生 SQL）</span>
        </div>
      </div>
    {/if}
  </section>
</article>
