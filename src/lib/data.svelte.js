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

export const DATAS = $state({
  // ── Network ──
  online: false,
  networkType: "unknown",
  connectionType: "unknown",

  // ── Theme ──
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
});

export const TOUCHP = $state({});
