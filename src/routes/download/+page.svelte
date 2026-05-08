<script>
  import { safeGoBack } from "$lib";
  import { onMount } from "svelte";

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

<!-- Tauri 模式下什么都不显示 -->
{#if !ready || isTauri}
  <!-- empty -->
{:else if isWeChat}
  <!-- ─── 微信引导页 ─────────────────────────────────────── -->
  <div class="relative w-full h-full flex-cc flex-col px-6 gap-6 text-center">
    <button
      onclick={() => history.back()}
      class="absolute left-4 top-4 w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex-cc shadow hover:bg-white dark:hover:bg-gray-800 transition300"
      aria-label="返回"
    >
      <span class="i-carbon-arrow-left text-xl"></span>
    </button>
    <div class="i-carbon-face-satisfied text-6 text-yellow-500"></div>
    <h1 class="text-xl font-bold">请在浏览器中打开</h1>
    <p class="text-gray-500 text-sm max-w-xs leading-relaxed">
      检测到你正在使用微信访问，请点击右上角 <span class="font-bold"
        >「···」</span
      >
      ，选择 <span class="font-bold">「在浏览器中打开」</span> 以正常下载。
    </p>
    <div class="mt-4 space-y-1">
      <div class="flex-cc gap-2 text-sm text-gray-400">
        <span class="i-carbon-chevron-right"></span>
        <span>点击右上角 ···</span>
      </div>
      <div class="flex-cc gap-2 text-sm text-gray-400">
        <span class="i-carbon-chevron-right"></span>
        <span>选择「在浏览器中打开」</span>
      </div>
      <div class="flex-cc gap-2 text-sm text-gray-400">
        <span class="i-carbon-chevron-right"></span>
        <span>即可下载安装包</span>
      </div>
    </div>
  </div>
{:else if isOtherPlatform}
  <!-- ─── 暂不支持 ─────────────────────────────────────────── -->
  <div class="relative w-full h-full flex-cc flex-col px-6 gap-6 text-center">
    <button
      onclick={() => safeGoBack("/my")}
      class="absolute left-4 top-4 w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex-cc shadow hover:bg-white dark:hover:bg-gray-800 transition300"
      aria-label="返回"
    >
      <span class="i-carbon-arrow-left text-xl"></span>
    </button>
    <div class="i-carbon-warning text-6 text-orange"></div>
    <h1 class="text-2xl font-bold">暂不支持</h1>
    <p class="text-gray-500 text-sm max-w-xs leading-relaxed">
      当前只支持 Android 设备下载。<br />
      请使用 Android 手机扫码或访问本页面。
    </p>
    <div
      class="mt-4 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs text-gray-400"
    >
      <p>如果你是 iOS 用户，敬请期待后续版本 🙏</p>
    </div>
  </div>
{:else if isAndroid}
  <!-- ─── Android 下载页 ─────────────────────────────────── -->
  <div class="relative w-full h-full flex-cc flex-col px-6 gap-6">
    <button
      onclick={() => history.back()}
      class="absolute left-4 top-4 w-10 h-10 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex-cc shadow hover:bg-white dark:hover:bg-gray-800 transition300"
      aria-label="返回"
    >
      <span class="i-carbon-arrow-left text-xl"></span>
    </button>
    <div class="text-center space-y-2">
      <span class="i-carbon-download text-6 text-green"></span>
      <h1 class="text-2xl font-bold">📲 脚前的灯 · Android</h1>
      <p class="text-gray-500 text-sm">直接在手机上安装</p>
    </div>

    <a
      href={latestUrl}
      download
      class="px-8 py-4 rounded-2xl bg-green text-white text-lg font-bold hover:bg-green/80 transition300 flex-cc gap-3 shadow-lg active:scale-95"
    >
      <span class="i-carbon-download"></span>
      下载 APK
    </a>

    <div class="text-xs text-gray-400 space-y-1 text-center">
      <p>
        版本: {__GIT_COMMIT__}
        <span class="text-gray-300">·</span>
        构建: {__BUILD_TIME__}
      </p>
      <p>首次安装可能提示"未知来源"，请允许后继续安装</p>
    </div>

    <button
      onclick={copyLink}
      class="text-sm text-green hover:underline flex-cc gap-1"
    >
      {copying ? "✅ 已复制" : "📋 复制下载链接"}
    </button>
  </div>
{/if}
