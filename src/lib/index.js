// place files you want to import through the `$lib` alias in this folder.
import { goto } from "$app/navigation";

export function showId(id, block = "center", inline = "center") {
  // 'start'（顶部）、'center'（居中）、'end'（底部）、'nearest'（最近）,
  //  block -> y,   inline -> x

  setTimeout(() => {
    const element = document.getElementById(id);
    // console.log({ id, element, block, inline });
    if (element) {
      element.scrollIntoView({
        block,
        inline,
        behavior: "smooth",
      });
    }
  }, 0);
}

export async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 安全返回：当浏览器历史栈足够深时用 history.back()，
 * 否则 fallback 到指定路由，避免因 replaceState 链导致直接退出应用。
 *
 * @param {string} fallback - 没有历史记录时的目标路由（默认 '/'）
 */
export function safeGoBack(fallback = "/") {
  if (window.history.length <= 2) {
    goto(fallback);
  } else {
    history.back();
  }
}
