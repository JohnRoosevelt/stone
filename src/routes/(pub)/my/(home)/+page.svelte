<script>
  import { onMount } from "svelte";
  import { DATAS } from "$lib/data.svelte";
  import { isDesktop } from "$lib/tauri";
  import CheckUpdate from "./components/CheckUpdate.svelte";
  import DebugInfo from "./components/DebugInfo.svelte";
  import DevtoolsCard from "./components/DevtoolsCard.svelte";
  import InitCheck from "./components/InitCheck.svelte";
  import Roadmap from "./components/Roadmap.svelte";
  import ThemeSettings from "./components/ThemeSettings.svelte";

  let isAndroid = $state(false);
  let isDesktopTauri = $state(false);
  let appVersion = $state("");

  onMount(async () => {
    // Web: detect Android for the download link
    if (!DATAS.isTauri) {
      isAndroid = /Android/i.test(navigator.userAgent);
    }

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
</article>
