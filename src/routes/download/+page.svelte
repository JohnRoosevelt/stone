<script>
  const R2_PUBLIC = "https://r2.lelexue.cn";
  const latestUrl = `${R2_PUBLIC}/apk/stone-latest.apk`;

  let copying = $state(false);

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

<div class="w-full h-full flex-cc flex-col px-6 gap-6">
  <div class="text-center space-y-2">
    <span class="i-carbon-download text-6 text-green"></span>
    <h1 class="text-2xl font-bold">📲 脚前的灯 · Android</h1>
    <p class="text-gray-500 text-sm">直接在手机上安装</p>
  </div>

  <a
    href={latestUrl}
    download
    class="px-8 py-4 rounded-2xl bg-green text-white text-lg font-bold hover:bg-green/80 transition300 flex-cc gap-3"
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
