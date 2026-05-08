import { redirect } from "@sveltejs/kit";
import { browser } from "$app/environment";

export const prerender = false;
export const ssr = false;

/** @type {import('@sveltejs/kit').LayoutLoad} */
export async function load({ url }) {
  // Tauri client allows all tools pages (including import panel)
  const isTauri = browser && !!window.__TAURI_INTERNALS__;
  if (isTauri) return {};

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
