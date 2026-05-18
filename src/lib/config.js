/**
 * Application configuration constants
 *
 * Centrally manage CID numbers, navigation items, home page cards, and other metadata,
 * eliminating hardcoded values scattered across files.
 */

// ─── CID Category Constants ───────────────────────────────────────────
export const CID = {
  BIBLE: "0",
  SDA: "1",
  BOOKS: "2",
};

/** CID metadata map — centrally manage names, icons, routes, etc. */
export const CID_MAP = {
  [CID.BIBLE]: { id: CID.BIBLE, name: "圣经", icon: "i-icons-bible" },
  [CID.SDA]: { id: CID.SDA, name: "怀著", icon: "i-icons-sda" },
  [CID.BOOKS]: { id: CID.BOOKS, name: "书籍", icon: "i-icons-logo" },
};

/** List of all valid CIDs */
export const CID_LIST = Object.values(CID_MAP);

/** Whether it is a known CID */
export function isValidCid(cid) {
  return cid in CID_MAP;
}

/** Validate numeric CID (0=bible, 1=sda, 2=book), returns undefined if invalid */
export function validateCid(cid) {
  const n = Number(cid);
  return Number.isInteger(n) && n >= 0 && n <= 2 ? n : undefined;
}

/** Get CID metadata, returns null for unknown CID */
export function getCidInfo(cid) {
  return CID_MAP[cid] ?? null;
}

// ─── Navigation Bar Configuration ─────────────────────────────────────────────
/**
 * Navigation items array, used for Nav sidebar/bottom bar
 * - href: link URL
 * - icon: UnoCSS icon class
 * - label: displayed text
 * - matchCid: if set, highlights when page.params.cid === matchCid
 * - matchExact: if set, highlights when page.url.pathname === matchExact
 * - matchPrefix: if set, highlights when page.url.pathname starts with this string
 * - appOnly: if true, only shows in Tauri (APP) mode
 */
export const NAV_ITEMS = [
  {
    href: "/",
    icon: "i-carbon-home",
    label: "首页",
    matchExact: "/",
  },
  {
    href: `/${CID.SDA}`,
    icon: "i-icons-sda",
    label: "怀著",
    matchCid: CID.SDA,
  },
  {
    href: "/search",
    icon: "i-carbon-search",
    label: "搜索",
    matchPrefix: "/search",
    appOnly: false,
  },
  {
    href: `/${CID.BIBLE}`,
    icon: "i-icons-bible",
    label: "圣经",
    matchCid: CID.BIBLE,
  },
  {
    href: "/my",
    icon: "i-carbon-user-settings",
    label: "我的",
    matchExact: "/my",
  },
];

// ─── Home Page Card Configuration ───────────────────────────────────────────
/**
 * Home page navigation card array
 */
export const HOME_CARDS = [
  {
    href: `/${CID.BIBLE}`,
    label: "圣经",
    icon: "i-icons-bible",
    color: "blue",
  },
  {
    href: `/${CID.SDA}`,
    label: "预言之灵",
    icon: "i-icons-sda",
    color: "green",
  },
  // { href: "/music", label: "音乐", icon: "i-carbon-music", color: "purple" }, // Not yet available
  {
    href: "/my",
    label: "用户中心",
    icon: "i-carbon-user-avatar",
    color: "purple",
  },
  {
    href: `/${CID.BOOKS}`,
    label: "教育资料",
    icon: "i-carbon-education",
    color: "orange",
  },
];
