/**
 * 智能返回
 *
 * 优先 history.back() 回退，
 * 无历史时跳转到 fallback 路径（默认首页 /）。
 *
 * @param {string} [fallback] - 无历史时的目标路径，默认 "/"
 */
export async function goBack(fallback) {
  if (typeof history !== "undefined" && window.history.length > 1) {
    history.back();
    return;
  }
  const { goto } = await import("$app/navigation");
  goto(fallback || "/");
}
