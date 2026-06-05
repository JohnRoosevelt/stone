/**
 * 全局状态 — 单一来源
 *
 * 按功能分区（network / theme / device / reader / ui / dialog / touch）。
 * 旧版细分 store 文件（$lib/stores/*）已删除，新代码直接 import 这个模块：
 *   import { DATAS, TOUCHP } from "$lib/data.svelte";
 */

export const DATAS = $state({
  // ── 网络 ──
  online: false,
  networkType: "unknown",
  connectionType: "unknown",

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
