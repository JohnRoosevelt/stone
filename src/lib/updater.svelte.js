/**
 * Shared updater state for checking and installing app updates.
 * Both Updater.svelte and the settings page use this module.
 *
 * The R2 bucket (r2.lelexue.cn) is the primary download host — fast
 * in China (Cloudflare edge) and no unauthenticated rate limits. The
 * CI writes `apk/stone-latest.apk` + `apk/update.json` to R2 on every
 * tag push; this client reads those. GitHub Releases is still updated
 * as a mirror for non-CN users / history.
 */

const R2_PUBLIC = "https://r2.lelexue.cn";

function manifestUrl() {
  return `${R2_PUBLIC}/apk/update.json?t=${Date.now()}`;
}
// `stone-latest.apk` is the always-latest pointer that CI keeps
// overwriting on every release. The install path opens this URL via
// the system browser, which downloads whatever the CI just shipped.
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

// Simple semver comparison (positive = a > b).
// Treats null/undefined/empty as "older than anything" so a fresh
// remote version still gets reported when the running app version is
// missing (e.g. dev mode, or @tauri-apps/api/app not available).
function compareVersions(a, b) {
  const safeSplit = (v) => {
    if (!v || typeof v !== "string") return [0, 0, 0];
    return v.split(".").map(Number);
  };
  const pa = safeSplit(a);
  const pb = safeSplit(b);
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

  // Tauri Android WebView's fetch can hang indefinitely on flaky networks
  // (no built-in timeout, and once a request stalls the "finally" never runs,
  // which leaves `updater.checking` stuck at true → button permanently
  // shows the spinner). 10s is generous for a small JSON manifest.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(manifestUrl(), { signal: controller.signal });
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
      compareVersions(manifest.version, currentVersion) > 0 &&
      manifest.version !== getDismissedVersion()
    ) {
      updater.updateInfo = {
        version: manifest.version,
        notes: manifest.notes || "新版本已发布，包含改进和修复。",
        date: manifest.pub_date,
      };
    } else if (!silent) {
      const { success } = await import("$lib/global/Toast");
      success("已是最新版本");
    }
  } catch (e) {
    if (e?.name === "AbortError") {
      console.warn("[updater] check timeout after 10s");
    } else {
      console.error("[updater] check failed:", e);
    }
    if (!silent) {
      const { toast } = await import("@zerodevx/svelte-toast");
      toast.push("检查更新失败，请检查网络连接", {
        theme: { classes: "toast-error" },
      });
    }
  } finally {
    clearTimeout(timeoutId);
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

// Persist dismissed version across sessions so a user who tapped "稍后再说"
// doesn't get the same version re-prompted on next launch / 6h interval tick.
const DISMISS_KEY = "stone:updater:dismissedVersion";

function getDismissedVersion() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(DISMISS_KEY);
}

function setDismissedVersion(version) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DISMISS_KEY, version);
}

export function dismiss() {
  if (updater.updateInfo) {
    setDismissedVersion(updater.updateInfo.version);
  }
  updater.updateInfo = null;
}
