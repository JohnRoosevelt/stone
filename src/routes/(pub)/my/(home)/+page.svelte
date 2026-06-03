<script>
  import { onMount } from "svelte";
  import { DATAS } from "$lib/data.svelte";
  import { isDesktop } from "$lib/tauri";
  import {
    getLatestRelease,
    SUPPORTED_PLATFORMS,
    formatSize,
  } from "$lib/release";
  import CheckUpdate from "./components/CheckUpdate.svelte";
  import ClearAnnotations from "./components/ClearAnnotations.svelte";
  import DebugInfo from "./components/DebugInfo.svelte";
  import DevtoolsCard from "./components/DevtoolsCard.svelte";
  import InitCheck from "./components/InitCheck.svelte";
  import Roadmap from "./components/Roadmap.svelte";
  import ThemeSettings from "./components/ThemeSettings.svelte";

  let isDesktopTauri = $state(false);
  let appVersion = $state("");

  // Download section state (web only). Each supported platform is shown
  // with its real GitHub-Releases asset URL once the release metadata
  // loads. Platforms without a matching asset are still listed so users
  // know what's planned.
  let release = $state(null);
  let releaseLoading = $state(true);
  let releaseError = $state("");

  onMount(async () => {
    // Tauri: get app version + detect desktop for devtools entry
    if (DATAS.isTauri) {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        appVersion = await getVersion();
      } catch (_) {
        appVersion = "";
      }
      try {
        isDesktopTauri = await isDesktop();
      } catch (_) {
        isDesktopTauri = false;
      }
      return;
    }

    // Web: load the latest release so the download links resolve to the
    // real versioned asset URLs (the old hard-coded `stone.apk` 404'd).
    try {
      release = await getLatestRelease();
    } catch (err) {
      console.warn("[my/download] failed to load release info:", err);
      releaseError = "无法获取最新版本信息";
    } finally {
      releaseLoading = false;
    }
  });

  function platformSubtitle(asset) {
    if (!asset) return "暂未提供";
    return `${formatSize(asset.size)} · APK`.replace(
      "APK",
      asset.name.toLowerCase().endsWith(".apk")
        ? "APK"
        : asset.name.toLowerCase().endsWith(".dmg")
          ? "DMG"
          : asset.name.toLowerCase().endsWith(".exe")
            ? "EXE"
            : "",
    );
  }
</script>

<svelte:head>
  <title>我的 - 脚前的灯</title>
</svelte:head>

<article class="w-full h-full overflow-y-auto px-4 py-4 space-y-5">
  <ThemeSettings />

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

  {#if !DATAS.isTauri}
    <!-- Web-only: download section listing every supported platform.
         Each row links directly to the GitHub-Releases asset so the URL
         stays correct across new versions (no hard-coded `stone.apk`). -->
    <div
      class="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
    >
      <div
        class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 text-sm font-medium"
      >
        <span class="i-carbon-download text-green"></span>
        下载 App
        {#if release}
          <span class="ml-auto text-xs text-gray-400 font-normal"
            >v{release.tag?.replace(/^v/, "")}</span
          >
        {/if}
      </div>

      {#if releaseLoading}
        <div
          class="px-4 py-3 text-sm text-gray-400 flex items-center gap-2"
        >
          <span class="i-line-md-loading-twotone-loop animate-spin"></span>
          正在获取下载链接…
        </div>
      {:else if releaseError}
        <div
          class="px-4 py-3 text-sm text-orange flex items-center gap-2"
        >
          <span class="i-carbon-warning"></span>
          {releaseError}
        </div>
      {:else}
        <div class="divide-y divide-gray-100 dark:divide-gray-800">
          {#each SUPPORTED_PLATFORMS as p (p.id)}
            {@const asset = p.asset(release)}
            {#if asset}
              <a
                href={asset.url}
                class="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300 no-underline"
              >
                <span class="{p.icon} text-xl {p.iconColor}"></span>
                <div class="flex-1">
                  <div>{p.label}</div>
                  <div class="text-xs text-gray-400 font-normal">
                    {formatSize(asset.size)}
                    {#if p.id === "macos"}<span class="text-gray-300">·</span> Universal{/if}
                  </div>
                </div>
                <span class="i-carbon-download text-green"></span>
              </a>
            {:else}
              <div
                class="flex items-center gap-3 px-4 py-3 text-sm text-gray-400"
              >
                <span class="{p.icon} text-xl {p.iconColor} opacity-40"
                ></span>
                <div class="flex-1">
                  <div>{p.label}</div>
                  <div class="text-xs text-gray-400">敬请期待</div>
                </div>
              </div>
            {/if}
          {/each}

          <a
            href="/download"
            class="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition300 no-underline"
          >
            <span class="i-carbon-help text-lg text-gray-400"></span>
            <div class="flex-1">
              <div>下载指引</div>
              <div class="text-xs text-gray-400">查看兼容性 / 微信中打开</div>
            </div>
            <span class="i-carbon-chevron-right text-gray-400"></span>
          </a>
        </div>
      {/if}
    </div>
  {/if}

  {#if DATAS.isTauri}
    <a
      href="/tools/import"
      class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
    >
      <span class="flex-cc gap-2">
        <span class="i-carbon-download text-green"></span>
        书籍导入
      </span>
      <span>
        <span class="text-xs text-gray-400">未导入的内容从 R2 加载</span>
        <span class="i-carbon-chevron-right text-gray-400"></span>
      </span>
    </a>

    <CheckUpdate {appVersion} />
    <InitCheck />

    {#if isDesktopTauri}
      <DevtoolsCard />
    {/if}
  {/if}

  <Roadmap />
  <DebugInfo {appVersion} />

  {#if DATAS.isTauri}
    <ClearAnnotations />
  {/if}
</article>
