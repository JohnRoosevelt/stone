import { isTauri } from "$lib/tauri";

export const ssr = !process.env.TAURI;
export const prerender = true;

export async function load() {
  const isTauriEnv = isTauri();
  console.log({ ssr, prerender, isTauri: isTauriEnv });
  return {};
}
