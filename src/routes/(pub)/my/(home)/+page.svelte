<script>
  import { onMount } from "svelte";
  import { DATAS } from "$lib/data.svelte";
  import { isDesktop } from "$lib/tauri";
  import { getLatestRelease } from "$lib/release";
  import CheckUpdate from "./components/CheckUpdate.svelte";
  import ClearAnnotations from "./components/ClearAnnotations.svelte";
  import DebugInfo from "./components/DebugInfo.svelte";
  import DevtoolsCard from "./components/DevtoolsCard.svelte";
  import InitCheck from "./components/InitCheck.svelte";
  import Roadmap from "./components/Roadmap.svelte";
  import ThemeSettings from "./components/ThemeSettings.svelte";

  let isDesktopTauri = $state(false);
  let appVersion = $state("");

  // Web-only: latest version is shown as a subtitle on the single
  // "下载 App" row. The platform-specific download UI lives on
  // /download (which detects Android / macOS / iOS / WeChat and shows
  // the right button + size). So /my only needs the version string,
  // not the full release asset list.
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

    // Web: fetch latest version (R2 update.json, cached 5 min in
    // release.js). /download will refetch to get asset sizes/URLs.
    try {
      release = await getLatestRelease();
    } catch (err) {
      console.warn("[my/download] failed to load release info:", err);
      releaseError = "无法获取最新版本信息";
    } finally {
      releaseLoading = false;
    }
  });
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
    <!-- Web-only: a single "下载 App" entry that links to /download.
         /download does the platform detection (Android / macOS / iOS /
         WeChat) and shows the right button + size. No more listing
         every supported platform on /my — that was redundant with what
         /download shows. -->
    <a
      href="/download"
      class="w-full flex items-center gap-3 px-4 py-3.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300 no-underline"
    >
      <span class="i-carbon-download text-xl text-green"></span>
      <div class="flex-1">
        <div>下载 App</div>
        <div class="text-xs text-gray-400 font-normal mt-0.5">
          {#if releaseLoading}
            正在获取版本…
          {:else if releaseError}
            点击查看下载方式
          {:else if release}
            v{release.tag?.replace(/^v/, "")} · Android + macOS
          {/if}
        </div>
      </div>
      <span class="i-carbon-chevron-right text-gray-400"></span>
    </a>
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
