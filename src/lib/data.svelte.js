/**
 * 全局状态
 *
 * 按功能分区组织，新代码可直接从细分 store 文件导入：
 *   import { networkStore } from "$lib/stores/network.svelte";
 *   import { themeStore }   from "$lib/stores/theme.svelte";
 *   import { readerStore }  from "$lib/stores/reader.svelte";
 *   import { deviceStore }  from "$lib/stores/device.svelte";
 *   import { uiStore }      from "$lib/stores/ui.svelte";
 *   import { dialogStore }  from "$lib/stores/dialog.svelte";
 *   import { touchStore, touchP } from "$lib/stores/touch.svelte";
 */

export const DATAS = $state({
  // ── 网络 ──
  online: false,
  networkType: "unknown",

  // ── 主题 ──
  isDarkMode: false,

  // ── 设备 ──
  uaInfo: {},
  dbInfo: {},

  // ── 阅读器 ──
  fontSize: 16,
  isFullScreen: false,
  bg: "#F8F9FA",
  showSdaEnglish: false,

  // ── UI 布局 ──
  isMobile: false,

  // ── 对话框 ──
  dialog: {
    show: false,
    animate: {},
    p: "c",
    c: null,
  },

  // ── 触摸 ──
  touchInfo: {},
});

export const TOUCHP = $state({});
