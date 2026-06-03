<script>
  import { safeGoBack } from "$lib";
  import { onMount } from "svelte";
  import { formatBuildTime } from "$lib/format.js";
  import { DATAS } from "$lib/data.svelte";
  import { getLatestRelease, androidAsset, formatSize } from "$lib/release";

  // ─── Runtime state ──────────────────────────────────────────
  let isWeChat = $state(false);
  let isAndroid = $state(false);
  let isMac = $state(false);
  let isOtherPlatform = $state(false);
  let copying = $state(false);
  let ready = $state(false);
  let release = $state(null);
  let releaseError = $state("");

  // The actual APK download URL — resolved from the latest GitHub release
  // so the filename (`stone-0.2.0.apk`) and version stay in sync. The
  // previous hard-coded `/releases/latest/download/stone.apk` 404'd because
  // CI uploads the file with the version suffix.
  let apkUrl = $derived.by(() => {
    if (!release) return "";
    const a = androidAsset(release);
    return a?.url || "";
  });
  let apkSize = $derived.by(() => {
    if (!release) return "";
    const a = androidAsset(release);
    return a ? formatSize(a.size) : "";
  });
  let versionLabel = $derived.by(() => {
    if (!release) return "";
    return release.tag?.replace(/^v/, "") || "";
  });

  onMount(async () => {
    // Only run device detection in web mode
    if (!DATAS.isTauri) {
      const ua = navigator.userAgent;

      isWeChat = /MicroMessenger/i.test(ua);
      isAndroid = /Android/i.test(ua);
      isMac = /Macintosh|Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua);
      isOtherPlatform = !isAndroid && !isMac && !isWeChat;

      try {
        release = await getLatestRelease();
      } catch (err) {
        console.warn("[download] failed to load release info:", err);
        releaseError = "无法获取最新版本，请稍后再试";
      }
    }

    ready = true;
  });

  async function copyLink() {
    if (!apkUrl) return;
    try {
      await navigator.clipboard.writeText(apkUrl);
      copying = true;
      setTimeout(() => (copying = false), 2000);
    } catch (_) {}
  }
</script>

<svelte:head>
  <title>下载 - 脚前的灯</title>
</svelte:head>

<!-- Tauri: render nothing -->
{#if !ready || DATAS.isTauri}
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
  {:else if isAndroid}
    {@render AndroidDownload()}
  {:else if isMac}
    {@render MacDownload()}
  {:else}
    {@render Unsupported()}
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
      当前支持 Android 和 macOS 设备。<br />
      请使用 Android 手机或 Mac 访问本页面。
    </p>
    <div
      class="mt-4 p-5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-400"
    >
      <p>如果你是 iOS / Windows 用户，敬请期待后续版本 🙏</p>
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

    {#if releaseError}
      <div class="text-orange text-sm text-center max-w-xs">
        {releaseError}
      </div>
    {:else if !apkUrl}
      <div class="text-gray-400 text-sm">正在获取下载链接…</div>
    {:else}
      <a
        href={apkUrl}
        download
        class="px-10 py-5 rounded-2xl bg-green text-white text-xl font-bold hover:bg-green/80 transition300 flex-cc gap-3 shadow-lg active:scale-95"
      >
        <span class="i-carbon-download"></span>
        下载 APK
      </a>

      <div class="text-sm text-gray-400 space-y-1.5 text-center">
        <p>
          版本: v{versionLabel}
          {#if apkSize}<span class="text-gray-300">·</span> {apkSize}{/if}
        </p>
        <p>首次安装可能提示"未知来源"，请允许后继续安装</p>
      </div>

      <button
        onclick={copyLink}
        class="text-base text-green hover:underline flex-cc gap-1"
      >
        {copying ? "✅ 已复制" : "📋 复制下载链接"}
      </button>
    {/if}
  </div>
{/snippet}

{#snippet MacDownload()}
  <!-- ─── macOS download ────────────────────────────────── -->
  <div class="w-full h-full flex-cc flex-col px-6 gap-8">
    <div class="text-center space-y-3">
      <span class="i-carbon-download text-7 text-green"></span>
      <h1 class="text-3xl font-bold">💻 脚前的灯 · macOS</h1>
      <p class="text-gray-500 text-base">Universal · Intel + Apple Silicon</p>
    </div>

    {#if releaseError}
      <div class="text-orange text-sm text-center max-w-xs">
        {releaseError}
      </div>
    {:else if !release}
      <div class="text-gray-400 text-sm">正在获取下载链接…</div>
    {:else}
      {@const mac = release.assets.find((a) => /\.dmg$/i.test(a.name))}
      {#if mac}
        <a
          href={mac.url}
          download
          class="px-10 py-5 rounded-2xl bg-green text-white text-xl font-bold hover:bg-green/80 transition300 flex-cc gap-3 shadow-lg active:scale-95"
        >
          <span class="i-carbon-download"></span>
          下载 DMG
        </a>
        <div class="text-sm text-gray-400 space-y-1.5 text-center">
          <p>
            版本: v{versionLabel}
            <span class="text-gray-300">·</span> {formatSize(mac.size)}
          </p>
          <p>下载后请先在「系统设置 → 隐私与安全性」允许打开</p>
        </div>
      {:else}
        <div class="text-gray-500 text-sm text-center max-w-xs">
          本次发布暂未提供 macOS 安装包，请稍后再试。
        </div>
      {/if}
    {/if}
  </div>
{/snippet}
