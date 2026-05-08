// place files you want to import through the `$lib` alias in this folder.
import { goto } from "$app/navigation";

export function showId(id, block = "center", inline = "center") {
  // 'start' (top), 'center' (center), 'end' (bottom), 'nearest' (nearest),
  //  block -> y, inline -> x

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
 * Safe back navigation: uses history.back() when the browser history stack is deep enough,
 * otherwise falls back to the specified route to prevent the app from exiting due to replaceState chain.
 *
 * @param {string} fallback - Target route when there is no history (default '/')
 */
export function safeGoBack(fallback = "/") {
  if (window.history.length <= 2) {
    // Use replaceState to simulate history.back() semantics: discard current page without adding history
    goto(fallback, { replaceState: true });
  } else {
    history.back();
  }
}
