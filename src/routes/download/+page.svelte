<script>
  import { safeGoBack } from "$lib";
  import { onMount } from "svelte";
  import { formatBuildTime } from "$lib/format.js";

  const R2_PUBLIC = "https://r2.lelexue.cn";
  const latestUrl = `${R2_PUBLIC}/apk/stone-latest.apk`;

  // ─── Runtime state ──────────────────────────────────────────
  let isTauri = $state(false);
  let isWeChat = $state(false);
  let isAndroid = $state(false);
  let isOtherPlatform = $state(false);
  let copying = $state(false);
  let ready = $state(false);

  onMount(() => {
    // Detect Tauri environment
    isTauri = typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;

    // Only run device detection in web mode
    if (!isTauri) {
      const ua = navigator.userAgent;

      // WeChat detection
      isWeChat = /MicroMessenger/i.test(ua);

      // Android detection
      isAndroid = /Android/i.test(ua);

      // Other platforms (non-Android, non-WeChat)
      isOtherPlatform = !isAndroid && !isWeChat;
    }

    ready = true;
  });

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(latestUrl);
      copying = true;
      setTimeout(() => (copying = false), 2000);
    } catch (_) {}
  }
</script>

<svelte:head>
  <title>下载 - 脚前的灯</title>
</svelte:head>

<!-- Tauri: render nothing -->
{#if !ready || isTauri}
  <!-- intentionally empty -->
{:else}
  <!-- Shared back button -->
  <div class="fixed left-4 top-4 z-10">
    <button
      onclick={() => safeGoBack("/my")}
      class="w-11 h-11 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex-cc shadow hover:bg-white dark:hover:bg-gray-800 transition300"
      aria-label="Back"
    >
      <span class="i-carbon-arrow-left text-2xl"></span>
    </button>
  </div>

  {#if isWeChat}
    {@render WeChatGuide()}
  {:else if isOtherPlatform}
    {@render Unsupported()}
  {:else if isAndroid}
    {@render AndroidDownload()}
  {/if}
{/if}

{#snippet WeChatGuide()}
  <!-- ─── WeChat: guide to open in browser ──────────────── -->
  <div class="w-full h-full flex-cc flex-col px-6 gap-8 text-center">
    <div class="i-carbon-face-satisfied text-7 text-yellow-500"></div>
    <h1 class="text-3xl font-bold">请在浏览器中打开</h1>
    <p class="text-gray-500 text-base max-w-xs leading-relaxed">
      检测到你正在使用微信访问，请点击右上角 <span class="font-bold"
        >「···」</span
      >
      ，选择 <span class="font-bold">「在浏览器中打开」</span> 以正常下载。
    </p>
    <div class="mt-4 space-y-2">
      <div class="flex-cc gap-2 text-base text-gray-400">
        <span class="i-carbon-chevron-right"></span>
        <span>点击右上角 ···</span>
      </div>
      <div class="flex-cc gap-2 text-base text-gray-400">
        <span class="i-carbon-chevron-right"></span>
        <span>选择「在浏览器中打开」</span>
      </div>
      <div class="flex-cc gap-2 text-base text-gray-400">
        <span class="i-carbon-chevron-right"></span>
        <span>即可下载安装包</span>
      </div>
    </div>
  </div>
{/snippet}

{#snippet Unsupported()}
  <!-- ─── Unsupported platform ──────────────────────────── -->
  <div class="w-full h-full flex-cc flex-col px-6 gap-8 text-center">
    <div class="i-carbon-warning text-7 text-orange"></div>
    <h1 class="text-3xl font-bold">暂不支持</h1>
    <p class="text-gray-500 text-base max-w-xs leading-relaxed">
      当前只支持 Android 设备下载。<br />
      请使用 Android 手机扫码或访问本页面。
    </p>
    <div
      class="mt-4 p-5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-400"
    >
      <p>如果你是 iOS 用户，敬请期待后续版本 🙏</p>
    </div>
  </div>
{/snippet}

{#snippet AndroidDownload()}
  <!-- ─── Android download ──────────────────────────────── -->
  <div class="w-full h-full flex-cc flex-col px-6 gap-8">
    <div class="text-center space-y-3">
      <span class="i-carbon-download text-7 text-green"></span>
      <h1 class="text-3xl font-bold">📲 脚前的灯 · Android</h1>
      <p class="text-gray-500 text-base">直接在手机上安装</p>
    </div>

    <a
      href={latestUrl}
      download
      class="px-10 py-5 rounded-2xl bg-green text-white text-xl font-bold hover:bg-green/80 transition300 flex-cc gap-3 shadow-lg active:scale-95"
    >
      <span class="i-carbon-download"></span>
      下载 APK
    </a>

    <div class="text-sm text-gray-400 space-y-1.5 text-center">
      <p>
        版本: {__GIT_COMMIT__}
        <span class="text-gray-300">·</span>
        构建: {formatBuildTime(__BUILD_TIME__)}
      </p>
      <p>首次安装可能提示"未知来源"，请允许后继续安装</p>
    </div>

    <button
      onclick={copyLink}
      class="text-base text-green hover:underline flex-cc gap-1"
    >
      {copying ? "✅ 已复制" : "📋 复制下载链接"}
    </button>
  </div>
{/snippet}
