<script>
  import { onMount } from "svelte";
  import { DATAS } from "$lib/data.svelte";

  let dismissed = $state(true);
  let enter = $state(false);
  let isAndroid = $state(false);

  /** localStorage key for dismiss timestamp */
  const LS_KEY = "stone_app_download_dismissed_at";

  /** How long to keep it hidden after dismissal (24 hours) */
  const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

  onMount(() => {
    // Never show banner inside the Tauri app itself
    if (DATAS.isTauri) return;

    // Only show on Android devices (currently only Android is supported)
    isAndroid = /Android/i.test(navigator.userAgent);
    if (!isAndroid) return;

    // Time-based dismiss: if dismissed within the duration, keep hidden
    const dismissedAt = localStorage.getItem(LS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      if (elapsed < DISMISS_DURATION_MS) {
        dismissed = true;
        return;
      }
      // Duration passed — clear stale record and show again
      localStorage.removeItem(LS_KEY);
    }
    dismissed = false;

    // Trigger enter animation after a frame so the element renders first
    requestAnimationFrame(() => {
      enter = true;
    });
  });

  function dismiss() {
    dismissed = true;
    localStorage.setItem(LS_KEY, String(Date.now()));
  }

  const FEATURES = [
    { icon: "i-carbon-flash", text: "更流畅的体验" },
    { icon: "i-carbon-wifi-off", text: "离线阅读" },
    { icon: "i-carbon-search", text: "离线搜索" },
    { icon: "i-carbon-bookmark-add", text: "标记与历史" },
  ];
</script>

{#if !DATAS.isTauri && isAndroid && !dismissed}
  <!--
    Outer wrapper uses max-height transition for a smooth slide-down entrance.
    The `enter` flag is set on the next frame after mount so the browser
    sees the element at max-h-0 first, then transitions to max-h-96.
  -->
  <div
    class="w-full overflow-hidden transition-all duration-600 ease-out"
    class:max-h-0={!enter}
    class:max-h-96={enter}
  >
    <div
      class="relative mx-3 mt-2 mb-1 rounded-xl border border-green/30 bg-gradient-to-br from-green-50 to-white px-4 py-3 shadow-md dark:from-green-900/30 dark:to-gray-900 sm:(mx-6 mt-3 mb-2)"
    >
      <!-- Close button -->
      <button
        onclick={dismiss}
        class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700"
        aria-label="关闭"
      >
        <span class="i-carbon-close text-lg"></span>
      </button>

      <div
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      >
        <!-- Text area -->
        <div class="flex-1">
          <div class="mb-1 flex items-center gap-2">
            <span class="i-carbon-phone text-xl text-green"></span>
            <span
              class="text-sm font-semibold text-gray-800 dark:text-gray-100"
            >
              下载 APP，获得更好体验
            </span>
          </div>

          <div
            class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"
          >
            {#each FEATURES as feat}
              <span class="inline-flex items-center gap-1">
                <span class="{feat.icon} text-sm text-green/70"></span>
                {feat.text}
              </span>
            {/each}
          </div>
        </div>

        <!-- CTA -->
        <a
          href="/download"
          data-sveltekit-replacestate
          class="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-green px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform active:scale-95 hover:bg-green/90 sm:self-center"
        >
          <span class="i-carbon-download"></span>
          免费下载
        </a>
      </div>
    </div>
  </div>
{/if}
