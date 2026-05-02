<script>
  import { DATAS } from "$lib/data.svelte";

  const roadmap = [
    {
      title: "线上搜索",
      desc: "已支持线上全文搜索",
      done: true,
    },
    {
      title: "搜索优化 + KV",
      desc: "引入 Cloudflare KV 缓存，优化关键字查找性能",
      done: false,
    },
    {
      title: "App 发布",
      desc: "打包为 Tauri 桌面/移动应用，支持离线存储",
      done: false,
    },
  ];

  let showRoadmap = $state(false);
  let showDebug = $state(false);
  let loadingUa = $state(false);

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
  <title>我的 - 脚前的灯</title>
</svelte:head>

<article w-full h-full overflow-y-auto px-4 py-4 space-y-5>
  <!-- ─── 设置 ─── -->
  <section space-y-3>
    <h2 text-lg font-semibold flex-cc gap-2>
      <span i-carbon-settings></span>
      设置
    </h2>

    <!-- 深色模式 -->
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
        relative
        class={DATAS.isDarkMode ? "bg-green" : "bg-gray-300 dark:bg-gray-600"}
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
          class={DATAS.isDarkMode ? "left-5" : "left-0.5"}
        ></span>
      </button>
    </div>

    <!-- 字体大小 -->
    <div
      class="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <div flex-cc gap-3 mb-3>
        <span i-carbon-text-size text-xl></span>
        <div>
          <div font-medium>字体大小</div>
          <div text-sm text-gray-500>{DATAS.fontSize}px</div>
        </div>
      </div>
      <div flex-cc gap-3>
        <button
          w-8
          h-8
          rounded-full
          bg-gray-100
          dark:bg-gray-700
          flex-cc
          flex-shrink-0
          class={DATAS.fontSize <= 12 ? "opacity-30" : ""}
          disabled={DATAS.fontSize <= 12}
          onclick={() => (DATAS.fontSize = Math.max(12, DATAS.fontSize - 2))}
          aria-label="减小字号"
        >
          <span i-carbon-subtract text-lg></span>
        </button>
        <input
          type="range"
          min="12"
          max="28"
          step="1"
          bind:value={DATAS.fontSize}
          class="flex-1 accent-green"
          aria-label="字体大小"
        />
        <button
          w-8
          h-8
          rounded-full
          bg-gray-100
          dark:bg-gray-700
          flex-cc
          flex-shrink-0
          class={DATAS.fontSize >= 28 ? "opacity-30" : ""}
          disabled={DATAS.fontSize >= 28}
          onclick={() => (DATAS.fontSize = Math.min(28, DATAS.fontSize + 2))}
          aria-label="增大字号"
        >
          <span i-carbon-add text-lg></span>
        </button>
      </div>
    </div>
  </section>

  <!-- ─── 折叠区块通用样式 ─── -->
  {#snippet foldBtn(icon, label, expanded, toggle, loading)}
    <button
      class="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
      onclick={toggle}
    >
      <span flex-cc gap-2>
        {#if loading}
          <span i-carbon-loading text-4 animate-spin></span>
        {:else}
          <span {icon} text-green></span>
        {/if}
        {label}
      </span>
      <span
        class="transition300 text-gray-400 {expanded ? 'rotate-180' : ''}"
        i-carbon-chevron-down
      ></span>
    </button>
  {/snippet}

  <!-- ─── 开发规划 ─── -->
  <div
    class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
  >
    <button
      class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
      onclick={() => (showRoadmap = !showRoadmap)}
    >
      <span flex-cc gap-2>
        <span i-carbon-development text-green></span>
        开发规划
      </span>
      <span
        class="transition300 text-gray-400 {showRoadmap ? 'rotate-180' : ''}"
        i-carbon-chevron-down
      ></span>
    </button>

    {#if showRoadmap}
      <div>
        {#each roadmap as item, i}
          <div
            class="flex items-center gap-3 px-4 py-3.5 {i < roadmap.length - 1
              ? 'border-b border-gray-100 dark:border-gray-800'
              : ''}"
          >
            <span
              class="w-6 h-6 rounded-full flex-cc text-xs font-700 flex-shrink-0 {item.done
                ? 'bg-green text-white'
                : 'bg-green/20 text-green'}"
            >
              {#if item.done}
                <span i-carbon-checkmark></span>
              {:else}
                {i + 1}
              {/if}
            </span>
            <div class="min-w-0">
              <div
                class="text-sm font-500 {item.done
                  ? 'text-green line-through opacity-60'
                  : ''}"
              >
                {item.title}
              </div>
              <div
                class="text-xs {item.done ? 'text-green/60' : 'text-gray-400'}"
              >
                {item.desc}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- ─── 关于 ─── -->
  <a
    href="/my/about"
    class="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300 no-underline"
  >
    <span flex-cc gap-2>
      <span i-carbon-information text-green></span>
      关于
    </span>
    <span i-carbon-chevron-right text-gray-400></span>
  </a>

  <!-- ─── 调试信息 ─── -->
  <section space-y-2>
    {@render foldBtn(
      "i-carbon-debug",
      "调试信息",
      showDebug,
      toggleDebug,
      loadingUa,
    )}

    {#if showDebug}
      <div
        class="px-4 py-3 space-y-1.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-mono text-gray-500"
      >
        <div class="flex items-center gap-1">
          <span text-gray-400>network: </span>
          {#if DATAS.online}
            {#if DATAS.connectionType === "wifi"}
              <span i-carbon-wifi class="text-green"></span>
              <span class="text-green">WiFi</span>
            {:else if DATAS.connectionType === "cellular"}
              <span i-carbon-radio></span>
              <span>{DATAS.networkType}</span>
            {:else}
              <span i-carbon-network-3 class="text-green"></span>
              <span>{DATAS.networkType || "在线"}</span>
            {/if}
          {:else}
            <span i-carbon-wifi-off class="text-gray-400"></span>
            <span>离线</span>
          {/if}
        </div>
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
          （待迁移至 Tauri 原生 SQL）
        </div>
        <div>
          <span text-gray-400>version: </span>
          {__GIT_COMMIT__}
        </div>
      </div>
    {/if}
  </section>
</article>
