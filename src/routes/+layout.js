export const ssr = !process.env.TAURI;
export const prerender = true;

export async function load() {
  const isBrowser = typeof window !== "undefined";
  const isTauri = isBrowser && !!window.__TAURI_INTERNALS__;
  const isWeb = isBrowser && !isTauri;
  const platform = isTauri ? "desktop" : "web";
  console.log({ ssr, prerender, isBrowser, isTauri, isWeb, platform });
  return {};
}
