/**
 * 导航历史与智能返回
 *
 * 在根布局中用 afterNavigate 记录每次页面切换的来源路径，
 * goBack 从历史栈中取上一页导航，无历史时回退到首页。
 *
 * 这解决了：
 * 1. 直接输入 URL 时 history.back() 回退到浏览器空白页的问题
 * 2. 从搜索结果页进入详情页后，返回时回到搜索结果页而非首页
 */

/** 导航历史栈 */
const navigationHistory = [];

/** 是否正在执行 goBack 导航（防止 afterNavigate 重复记录） */
let isGoBackNavigation = false;

/**
 * 记录导航来源（由布局中的 afterNavigate 调用）
 * @param {{ url: { pathname: string, search: string } } | null} from - 来源页信息
 */
export function recordNavigation(from) {
  if (isGoBackNavigation) {
    isGoBackNavigation = false;
    return;
  }
  if (!from) return;
  navigationHistory.push(from.url.pathname + from.url.search);
}

/**
 * 智能返回
 *
 * 优先从导航历史栈取上一页路径跳转，
 * 无历史时跳转到 fallback 路径（默认首页 /）。
 *
 * Svelte 5 中 onclick={goBack} 会将 MouseEvent 作为第一个参数传入，
 * 所以需要判断 fallback 是否为字符串。
 *
 * @param {string} [fallback] - 无历史时的目标路径，默认 "/"
 */
export async function goBack(fallback) {
  isGoBackNavigation = true;
  const prev = navigationHistory.pop();
  const target = prev || (typeof fallback === "string" ? fallback : "/");
  const { goto } = await import("$app/navigation");
  goto(target);
}
