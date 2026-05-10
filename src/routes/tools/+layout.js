import { redirect } from "@sveltejs/kit";
import { browser } from "$app/environment";
import { isTauri } from "$lib/tauri";

export const prerender = false;
export const ssr = false;

/** @type {import('@sveltejs/kit').LayoutLoad} */
export async function load({ url }) {
  // Tauri client allows all tools pages (including import panel)
  const isTauriEnv = isTauri();
  if (isTauriEnv) return {};

  // Web side: check admin token
  const token = url.searchParams.get("t");
  if (token === "stone2024") {
    localStorage.setItem("stone_admin", token);
    return {};
  }

  const saved = browser ? localStorage.getItem("stone_admin") : null;
  if (saved === "stone2024") return {};

  // Unauthenticated → redirect to home
  throw redirect(302, "/");
}
