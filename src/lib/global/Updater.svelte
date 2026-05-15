<script>
  import { onMount } from "svelte";
  import { DATAS } from "$lib/data.svelte.js";
  import { toast } from "@zerodevx/svelte-toast";

  let checking = $state(false);
  let updateInfo = $state(null); // { version, notes, date }
  let downloading = $state(false);
  let downloadProgress = $state(0);
  let error = $state("");
  let appVersion = $state("");

  onMount(async () => {
    if (!DATAS.isTauri) return;

    // Get current app version from Tauri
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      appVersion = await getVersion();
      console.log("[updater] current version:", appVersion);
    } catch (_) {}

    // Check for updates on startup
    await checkForUpdate();

    // Also periodically check every 6 hours
    setInterval(() => checkForUpdate(true), 6 * 60 * 60 * 1000);
  });

  async function checkForUpdate(silent = false) {
    if (checking) return;
    checking = true;
    error = "";

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      console.log("[updater] check result:", update);

      if (update?.available) {
        updateInfo = {
          version: update.version,
          notes: update.body || "新版本已发布，包含改进和修复。",
          date: update.date,
        };
      } else if (!silent) {
        toast.push("已是最新版本", {
          theme: { classes: "toast-success" },
        });
      }
    } catch (e) {
      console.error("[updater] check failed:", e);
      if (!silent) {
        error = `检查更新失败: ${e?.message || e}`;
        toast.push("检查更新失败，请检查网络连接", {
          theme: { classes: "toast-error" },
        });
      }
    } finally {
      checking = false;
    }
  }

  async function installUpdate() {
    if (!updateInfo) return;

    downloading = true;
    downloadProgress = 0;
    error = "";

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update?.available) {
        update.on("download-progress", (progress) => {
          downloadProgress = Math.round(
            (progress.downloadedBytes / progress.totalBytes) * 100,
          );
        });

        await update.downloadAndInstall();

        // Relaunch on desktop; on Android the system installer takes over
        try {
          const { relaunch } = await import("@tauri-apps/plugin-process");
          await relaunch();
        } catch {
          alert("更新已下载，正在启动安装...");
        }
      }
    } catch (e) {
      console.error("[updater] install failed:", e);
      error = `更新失败: ${e?.message || e}`;
    } finally {
      downloading = false;
    }
  }

  function dismiss() {
    updateInfo = null;
  }
</script>

<!-- ─── Update Dialog ─────────────────────────────────────────── -->
{#if updateInfo && !downloading}
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
        <p>当前版本：<span class="font-mono">{appVersion || "?"}</span></p>
        <p>新版本：<span class="font-mono">{updateInfo.version}</span></p>
        {#if updateInfo.date}
          <p>
            发布：
            <span class="font-mono"
              >{new Date(updateInfo.date).toLocaleDateString("zh-CN")}</span
            >
          </p>
        {/if}
      </div>

      {#if updateInfo.notes}
        <div
          class="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 max-h-32 overflow-y-auto"
        >
          {updateInfo.notes}
        </div>
      {/if}

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

<!-- ─── Download Progress Dialog ──────────────────────────── -->
{#if downloading}
  <div class="fixed inset-0 z-50 flex-cc bg-black/40 backdrop-blur-sm">
    <div
      class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 space-y-4"
    >
      <div class="flex-cc gap-3">
        <span class="i-carbon-circle-dash text-3xl text-blue animate-spin"
        ></span>
        <h2 class="text-xl font-bold">正在下载更新...</h2>
      </div>

      <div
        class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden"
      >
        <div
          class="h-full bg-blue rounded-full transition-all duration-300"
          style="width: {downloadProgress}%"
        ></div>
      </div>

      <div class="text-center text-sm text-gray-500">{downloadProgress}%</div>

      {#if error}
        <div class="text-center text-sm text-red p-2 bg-red/5 rounded-lg">
          {error}
        </div>
      {/if}
    </div>
  </div>
{/if}
