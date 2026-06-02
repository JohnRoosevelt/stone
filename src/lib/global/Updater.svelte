<script>
  import { untrack } from "svelte";
  import { DATAS } from "$lib/data.svelte.js";
  import {
    updater,
    checkForUpdate,
    installUpdate,
    dismiss,
  } from "$lib/updater.svelte.js";

  // NOTE: Svelte mounts children before parents, so on first run `DATAS.isTauri`
  // is still `false` (the layout sets it in its own onMount, which fires after
  // ours). Use `$effect` so we react to the false → true transition and kick
  // off the startup check + 6h interval only on Tauri.
  // Both calls use `silent=true` so the auto-check never toasts; only the
  // explicit "检查更新" button on the settings page surfaces a toast.
  //
  // `checkForUpdate` synchronously reads/writes `updater.checking`. If we
  // let `$effect` track that, the write would re-trigger us in an infinite
  // loop (check finishes → checking:false → effect re-runs → check starts →
  // checking:true → effect re-runs, etc.). `untrack` runs the call without
  // subscribing to any reactive deps it touches synchronously.
  $effect(() => {
    if (!DATAS.isTauri) return;
    untrack(() => checkForUpdate(true));
    const id = setInterval(() => checkForUpdate(true), 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  });
</script>

<!-- ─── Update Dialog ─────────────────────────────────────────── -->
{#if updater.updateInfo}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex-cc bg-black/40 backdrop-blur-sm"
    onclick={dismiss}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex-cc gap-3">
        <span class="i-carbon-update-now text-3xl text-blue"></span>
        <h2 class="text-xl font-bold">发现新版本</h2>
      </div>

      <div class="text-sm text-gray-500 dark:text-gray-400 space-y-1">
        <p>
          新版本：<span class="font-mono">{updater.updateInfo.version}</span>
        </p>
        {#if updater.updateInfo.date}
          <p>
            发布：
            <span class="font-mono"
              >{new Date(updater.updateInfo.date).toLocaleDateString(
                "zh-CN",
              )}</span
            >
          </p>
        {/if}
      </div>

      {#if updater.updateInfo.notes}
        <div
          class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 max-h-32 overflow-y-auto"
        >
          {updater.updateInfo.notes}
        </div>
      {/if}

      {#if updater.error}
        <div class="text-sm text-red p-2 bg-red/5 rounded-lg text-center">
          {updater.error}
        </div>
      {/if}

      <p class="text-xs text-gray-400 text-center">
        点击「立即更新」将跳转至浏览器下载 APK，下载完成后点击通知安装。
      </p>

      <div class="flex gap-3 pt-2">
        <button
          onclick={dismiss}
          class="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition300"
        >
          稍后再说
        </button>
        <button
          onclick={installUpdate}
          class="flex-1 py-2.5 rounded-xl bg-blue text-white font-bold hover:bg-blue/80 transition300 active:scale-95"
        >
          立即更新
        </button>
      </div>
    </div>
  </div>
{/if}
