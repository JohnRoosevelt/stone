<script>
  import { onMount } from "svelte";
  import { DATAS } from "$lib/data.svelte";
  import {
    getDbSize,
    needsInitialImport,
    resetInitialImport,
  } from "$lib/tauri";
  import { formatBuildTime } from "$lib/format.js";

  let dbSize = $state("");
  $effect(async () => {
    if (DATAS.isTauri) {
      try {
        dbSize = await getDbSize();
      } catch (_) {}
    }
  });

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

  const roadmap = [
    {
      title: "线上搜索",
      desc: "已支持线上全文搜索",
      done: true,
    },
    {
      title: "搜索优化 + KV",
      desc: "引入 Cloudflare KV 缓存，优化关键字查找性能",
      done: true,
    },
    {
      title: "App 发布",
      desc: "打包为 Tauri 桌面/移动应用，支持离线存储",
      done: true,
    },
  ];

  let isAndroid = $state(false);
  let appVersion = $state("");
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

  onMount(async () => {
    // Detect Android device for download link
    if (!DATAS.isTauri) {
      isAndroid = /Android/i.test(navigator.userAgent);
    }

    // Get app version in Tauri (Android) mode
    if (DATAS.isTauri) {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        appVersion = await getVersion();
      } catch (_) {
        appVersion = "";
      }
    }
  });
</script>

<svelte:head>
  <title>我的 - 脚前的灯</title>
</svelte:head>

<article class="w-full h-full overflow-y-auto px-4 py-4 space-y-5">
  <!-- ─── Settings ─── -->
  <section class="space-y-3">
    <h2 class="text-lg font-semibold flex-cc gap-2">
      <span class="i-carbon-settings"></span>
      设置
    </h2>

    <!-- Dark mode -->
    <div
      class="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <div class="flex-cc gap-3">
        <span class="i-carbon-sun text-xl"></span>
        <div>
          <div class="font-medium">深色模式</div>
          <div class="text-sm text-gray-500">
            {DATAS.themeMode === "system"
              ? "跟随系统"
              : DATAS.themeMode === "dark"
                ? "深色"
                : "浅色"}
          </div>
        </div>
      </div>
      <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        <button
          aria-label="切换到浅色模式"
          class="px-3 py-1 rounded-md text-sm transition300"
          class:bg-white={DATAS.themeMode === "light"}
          class:shadow-sm={DATAS.themeMode === "light"}
          class:text-gray-400={DATAS.themeMode !== "light"}
          onclick={() => (DATAS.themeMode = "light")}
        >
          <span class="i-carbon-sun"></span>
        </button>
        <button
          aria-label="切换到深色模式"
          class="px-3 py-1 rounded-md text-sm transition300"
          class:bg-white={DATAS.themeMode === "dark"}
          class:shadow-sm={DATAS.themeMode === "dark"}
          class:text-gray-400={DATAS.themeMode !== "dark"}
          onclick={() => (DATAS.themeMode = "dark")}
        >
          <span class="i-carbon-moon"></span>
        </button>
        <button
          aria-label="切换到系统模式"
          class="px-3 py-1 rounded-md text-sm transition300"
          class:bg-white={DATAS.themeMode === "system"}
          class:shadow-sm={DATAS.themeMode === "system"}
          class:text-gray-400={DATAS.themeMode !== "system"}
          onclick={() => (DATAS.themeMode = "system")}
        >
          <span class="i-carbon-automatic"></span>
        </button>
      </div>
    </div>

    <!-- Font size -->
    <div
      class="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <div class="flex-cc gap-3 mb-3">
        <div class="flex-cc gap-1">
          <div class="font-medium">字体大小</div>
          <div class="text-sm text-gray-500">{DATAS.fontSize}px</div>
        </div>
      </div>
      <div class="flex-cc gap-3">
        <button
          class={[
            DATAS.fontSize <= 12 ? "opacity-30" : "",
            "w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex-cc flex-shrink-0",
          ]}
          disabled={DATAS.fontSize <= 12}
          onclick={() => (DATAS.fontSize = Math.max(12, DATAS.fontSize - 2))}
          aria-label="减小字号"
        >
          <span class="i-carbon-subtract text-lg"></span>
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
          class={[
            DATAS.fontSize >= 28 ? "opacity-30" : "",
            "w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex-cc flex-shrink-0",
          ]}
          disabled={DATAS.fontSize >= 28}
          onclick={() => (DATAS.fontSize = Math.min(28, DATAS.fontSize + 2))}
          aria-label="增大字号"
        >
          <span class="i-carbon-add text-lg"></span>
        </button>
      </div>
    </div>
  </section>

  <!-- ─── About ─── -->
  <a
    href="/my/about"
    class="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300 no-underline"
  >
    <span class="flex-cc gap-2">
      <span class="i-carbon-information text-green"></span>
      关于
    </span>
    <span class="i-carbon-chevron-right text-gray-400"></span>
  </a>

  <!-- Download App (Web only) -->
  {#if !DATAS.isTauri && isAndroid}
    <a
      href="/download"
      class="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300 no-underline"
    >
      <span class="flex-cc gap-2">
        <span class="i-carbon-download text-green"></span>
        下载 App
      </span>
      <span class="text-xs text-gray-400">Android</span>
      <span class="i-carbon-chevron-right text-gray-400"></span>
    </a>
  {/if}

  <!-- Book import (Tauri only) -->
  {#if DATAS.isTauri}
    <a
      href="/tools/import"
      class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <span class="flex-cc gap-2">
        <span class="i-carbon-download text-green"></span>
        书籍导入
      </span>
      <span class="text-xs text-gray-400">未导入的内容从 R2 加载</span>
      <span class="i-carbon-chevron-right text-gray-400"></span>
    </a>

    <!-- Initialization check -->
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
  {/if}

  <!-- ─── Development Roadmap ─── -->
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

  <!-- ─── Debug Info ─── -->
  <div
    class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
  >
    <button
      class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
      onclick={toggleDebug}
    >
      <span class="flex-cc gap-2">
        {#if loadingUa}
          <span class="i-line-md-loading-twotone-loop text-4 animate-spin"
          ></span>
        {:else}
          <span class={["i-carbon-debug", "text-green"]}></span>
        {/if}
        调试信息
      </span>
      <span
        class={[
          "transition300 text-gray-400 i-carbon-chevron-down",
          showDebug && "rotate-180",
        ]}
      ></span>
    </button>

    {#if showDebug}
      <div
        class="px-4 py-3 space-y-1.5 border-t border-gray-100 dark:border-gray-800 text-xs font-mono text-gray-500"
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
          <span text-gray-400>mode: </span>
          <span
            class:text-green={DATAS.isTauri}
            class:text-blue={!DATAS.isTauri}
          >
            {DATAS.isTauri ? "🧊 Tauri" : "🌐 Web"}
          </span>
        </div>

        <div>
          <span text-gray-400>DB: </span>{dbSize || "..."}
        </div>

        {#if appVersion}
          <div>
            <span text-gray-400>app: </span>
            <span class="text-green font-600">v{appVersion}</span>
          </div>
        {/if}
        <div>
          <span text-gray-400>build: </span>
          {__GIT_COMMIT__}
          <span text-gray-400>
            ({formatBuildTime(__BUILD_TIME__)})
          </span>
        </div>

        <div>
          <span text-gray-400>origin: </span>
          <span class="text-green"
            >{typeof window !== "undefined"
              ? window.location.origin
              : "-"}</span
          >
        </div>
      </div>
    {/if}
  </div>
</article>
