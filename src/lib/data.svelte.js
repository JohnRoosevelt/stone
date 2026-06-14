/**
 * Global state
 *
 * Organized by functional areas; new code can import directly from sub-store files:
 *   import { networkStore } from "$lib/stores/network.svelte";
 *   import { themeStore }   from "$lib/stores/theme.svelte";
 *   import { readerStore }  from "$lib/stores/reader.svelte";
 *   import { deviceStore }  from "$lib/stores/device.svelte";
 *   import { uiStore }      from "$lib/stores/ui.svelte";
 *   import { dialogStore }  from "$lib/stores/dialog.svelte";
 *   import { touchStore, touchP } from "$lib/stores/touch.svelte";
 */

import { fetchHotKeywords } from "$lib/tauri";

export const DATAS = $state({
  // ── Network ──
  online: false,
  networkType: "unknown",
  connectionType: "unknown",

  // ── Theme ──
  /** "system" | "light" | "dark" — follows OS pref by default; pages can override */
  themeMode: "system",
  /** Derived: true when the dark class should be active on <html> */
  isDarkMode: false,

  // ── Device ──
  uaInfo: {},
  dbInfo: {},
  isTauri: false,

  // ── Reader ──
  fontSize: 16,
  isFullScreen: false,
  bg: "#F8F9FA",
  showSdaEnglish: false,

  // ── UI Layout ──
  isMobile: false,

  // ── Dialog ──
  dialog: {
    show: false,
    animate: {},
    p: "c",
    c: null,
  },

  // ── Touch ──
  touchInfo: {},

  // ── Hot Search Keywords (in-memory cache, populated at app start + on /search mount) ──
  hotKeywords: [],
});

export const TOUCHP = $state({});

/**
 * Silently fetch hot keywords and update DATAS.hotKeywords.
 * Safe to call multiple times — race-safe via single in-flight promise.
 * Failures are swallowed (cache stays at previous value).
 */
let _inFlight = null;
export async function refreshHotKeywords() {
  if (_inFlight) return _inFlight;
  _inFlight = (async () => {
    try {
      const data = await fetchHotKeywords();
      if (Array.isArray(data) && data.length > 0) {
        DATAS.hotKeywords = data;
      }
    } catch {
      // ignore — keep prior cache
    } finally {
      _inFlight = null;
    }
  })();
  return _inFlight;
}
