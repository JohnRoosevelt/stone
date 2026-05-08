/**
 * Screen wake lock management
 *
 * The Wake Lock API requires a user gesture (transient activation) to grant permission.
 * On initial page load there is no user gesture, so calling request() will throw a NotAllowedError.
 * Solution: call after user interaction (click, page turn), or retry.
 */

/** Currently active Wake Lock instance */
let activeLock = null;

/**
 * Request screen wake lock (silently fails, does not throw)
 * @returns {Promise<boolean>} whether the lock was successfully acquired
 */
export async function wakeLock() {
  try {
    // API not available
    if (!navigator.wakeLock) return false;

    // Release old lock
    if (activeLock) {
      activeLock.release().catch(() => {});
      activeLock = null;
    }

    const wl = await navigator.wakeLock.request("screen");
    activeLock = wl;

    wl.addEventListener("release", () => {
      activeLock = null;
    });

    return true;
  } catch (error) {
    // NotAllowedError: Missing user gesture, will retry on next interaction
    console.log("[wakeLock]", error?.name);
    return false;
  }
}

/**
 * Release screen wake lock
 */
export async function releaseWakeLock() {
  if (activeLock) {
    try {
      await activeLock.release();
    } catch (_) {}
    activeLock = null;
  }
}

/**
 * Handle visibility change
 * - When the page comes back to the foreground from the background, re-request the wake lock
 *   (may fail due to lost gesture, subsequent interactions will retry)
 */
export function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    wakeLock();
  }
}
