/**
 * 应用配置常量
 *
 * 集中管理 CID 编号、导航项、首页卡片等元数据，消除散落在各文件中的硬编码。
 */

// ─── CID 类别常量 ───────────────────────────────────────────
export const CID = {
  BIBLE: "0",
  SDA: "1",
  BOOKS: "2",
};

/** CID 元数据映射 — 集中管理名称、图标、路由等信息 */
export const CID_MAP = {
  [CID.BIBLE]: { id: CID.BIBLE, name: "圣经", icon: "i-icons-bible" },
  [CID.SDA]: { id: CID.SDA, name: "怀著", icon: "i-icons-sda" },
  [CID.BOOKS]: { id: CID.BOOKS, name: "书籍", icon: "i-icons-logo" },
};

/** 所有有效 CID 列表 */
export const CID_LIST = Object.values(CID_MAP);

/** 是否为已知的 CID */
export function isValidCid(cid) {
  return cid in CID_MAP;
}

/** 获取 CID 元数据，未知 CID 返回 null */
export function getCidInfo(cid) {
  return CID_MAP[cid] ?? null;
}

// ─── 导航栏配置 ─────────────────────────────────────────────
/**
 * 导航项数组，用于 Nav 侧边栏/底部栏
 * - href: 链接地址
 * - icon: UnoCSS 图标类
 * - label: 显示文字
 * - matchCid: 若设置了该值，则当 page.params.cid === matchCid 时高亮
 * - matchExact: 若设置了该值，则当 page.url.pathname === matchExact 时高亮
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

// ─── 首页卡片配置 ───────────────────────────────────────────
/**
 * 首页导航卡片数组
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
  // { href: "/music", label: "音乐", icon: "i-carbon-music", color: "purple" }, // 暂未开放
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
