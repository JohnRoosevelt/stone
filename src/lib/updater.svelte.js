/**
 * Shared updater state for checking and installing app updates.
 * Both Updater.svelte and the settings page use this module.
 */

const R2_PUBLIC = "https://r2.lelexue.cn";
function manifestUrl() {
  return `${R2_PUBLIC}/apk/update.json?t=${Date.now()}`;
}
export const APK_URL = `${R2_PUBLIC}/apk/stone-latest.apk`;

/**
 * Wrap state in a single object so we can mutate properties,
 * which is allowed when exporting from a module.
 */
export const updater = $state({
  checking: false,
  /** @type {{ version: string, notes: string, date: string } | null} */
  updateInfo: null,
  error: "",
});

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

/**
 * Check for updates.
 * @param {boolean} [silent=false] - If true, suppress success/error toasts.
 */
export async function checkForUpdate(silent = false) {
  if (updater.checking) return;
  updater.checking = true;
  updater.error = "";

  try {
    const res = await fetch(manifestUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = await res.json();

    // Get current app version from tauri
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
      updater.updateInfo = {
        version: manifest.version,
        notes: manifest.notes || "新版本已发布，包含改进和修复。",
        date: manifest.pub_date,
      };
    } else if (!silent) {
      const { toast } = await import("@zerodevx/svelte-toast");
      toast.push("已是最新版本", {
        theme: { classes: "toast-success" },
      });
    }
  } catch (e) {
    console.error("[updater] check failed:", e);
    if (!silent) {
      const { toast } = await import("@zerodevx/svelte-toast");
      toast.push("检查更新失败，请检查网络连接", {
        theme: { classes: "toast-error" },
      });
    }
  } finally {
    updater.checking = false;
  }
}

export async function installUpdate() {
  if (!updater.updateInfo) return;
  updater.error = "";

  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(APK_URL);
    updater.updateInfo = null;
  } catch (e) {
    console.error("[updater] install failed:", e);
    updater.error = `更新失败: ${e?.message || e}`;

    try {
      window.open(APK_URL, "_blank");
    } catch (_) {}
  }
}

export function dismiss() {
  updater.updateInfo = null;
}
