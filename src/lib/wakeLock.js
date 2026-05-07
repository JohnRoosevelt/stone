/**
 * 屏幕常亮管理
 *
 * Wake Lock API 需要用户手势（transient activation）才能授权。
 * 初始页面加载时没有用户手势，调用 request() 会抛出 NotAllowedError。
 * 解决方案：在用户交互（点击、翻页）后调用，或重试。
 */

/** 当前活动的 Wake Lock 实例 */
let activeLock = null;

/**
 * 请求屏幕常亮（静默失败，不抛异常）
 * @returns {Promise<boolean>} 是否成功获取
 */
export async function wakeLock() {
  try {
    // API 不可用
    if (!navigator.wakeLock) return false;

    // 释放旧的锁
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
    // NotAllowedError: 缺少用户手势，下次交互后重试
    console.log("[wakeLock]", error?.name);
    return false;
  }
}

/**
 * 释放屏幕常亮
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
 * 可见性变化处理
 * - 页面从后台切回前台时，重新请求常亮（可能因手势丢失而失败，后续交互会重试）
 */
export function handleVisibilityChange() {
  if (document.visibilityState === "visible") {
    wakeLock();
  }
}
