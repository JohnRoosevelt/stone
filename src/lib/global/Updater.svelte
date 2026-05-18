<script>
  import { onMount } from "svelte";
  import { DATAS } from "$lib/data.svelte.js";
  import { toast } from "@zerodevx/svelte-toast";

  const R2_PUBLIC = "https://r2.lelexue.cn";
  const MANIFEST_URL = `${R2_PUBLIC}/apk/update.json`;
  const APK_URL = `${R2_PUBLIC}/apk/stone-latest.apk`;

  let checking = $state(false);
  let updateInfo = $state(null); // { version, notes, date }
  let error = $state("");

  onMount(async () => {
    if (!DATAS.isTauri) return;

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
      const res = await fetch(MANIFEST_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const manifest = await res.json();

      // Get current app version from tauri.conf.json (built-in)
      let currentVersion;
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        currentVersion = await getVersion();
      } catch (_) {
        currentVersion = "0.0.0";
      }

      console.log(
        "[updater] current:",
        currentVersion,
        "remote:",
        manifest.version,
      );

      if (
        manifest.version &&
        compareVersions(manifest.version, currentVersion) > 0
      ) {
        updateInfo = {
          version: manifest.version,
          notes: manifest.notes || "新版本已发布，包含改进和修复。",
          date: manifest.pub_date,
        };
      } else if (!silent) {
        toast.push("已是最新版本", {
          theme: { classes: "toast-success" },
        });
      }
    } catch (e) {
      console.error("[updater] check failed:", e);
      if (!silent) {
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
    error = "";

    try {
      // Use Tauri shell plugin to open the APK URL in the system handler
      // On Android, this triggers the browser to download the APK,
      // then the user can tap to install.
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(APK_URL);

      // Reset dialog after triggering download
      updateInfo = null;
    } catch (e) {
      console.error("[updater] install failed:", e);
      error = `更新失败: ${e?.message || e}`;

      // Fallback: open in new window
      try {
        window.open(APK_URL, "_blank");
      } catch (_) {}
    }
  }

  function dismiss() {
    updateInfo = null;
  }

  // Simple semver comparison (positive = a > b)
  function compareVersions(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }
</script>

<!-- ─── Update Dialog ─────────────────────────────────────────── -->
{#if updateInfo}
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

      {#if error}
        <div class="text-sm text-red p-2 bg-red/5 rounded-lg text-center">
          {error}
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
