import { redirect } from "@sveltejs/kit";
import { browser } from "$app/environment";

export const prerender = false;
export const ssr = false;

// Inlined env check — keeps tools/ off the $lib/tauri.js import graph
// (5KB+ of module-level code that this layout never invokes anyway).
function inTauri() {
  return browser && typeof window.__TAURI_INTERNALS__ !== "undefined";
}

const ADMIN_TOKEN = "stone2024";
const ADMIN_TOKEN_EXP_KEY = "stone_admin_exp";
const ADMIN_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function storeToken() {
  localStorage.setItem("stone_admin", ADMIN_TOKEN);
  localStorage.setItem(
    ADMIN_TOKEN_EXP_KEY,
    String(Date.now() + ADMIN_TOKEN_TTL_MS),
  );
}

function isTokenValid() {
  if (localStorage.getItem("stone_admin") !== ADMIN_TOKEN) return false;
  const exp = Number(localStorage.getItem(ADMIN_TOKEN_EXP_KEY) || 0);
  if (!exp || Date.now() > exp) {
    localStorage.removeItem("stone_admin");
    localStorage.removeItem(ADMIN_TOKEN_EXP_KEY);
    return false;
  }
  return true;
}

/** @type {import('@sveltejs/kit').LayoutLoad} */
export async function load({ url }) {
  // Tauri client allows all tools pages (including import panel)
  if (inTauri()) return {};

  // ?t=stone2024 → accept and store with 7-day expiry
  if (url.searchParams.get("t") === ADMIN_TOKEN) {
    storeToken();
    return {};
  }

  // Re-use an unexpired token
  if (browser && isTokenValid()) return {};

  // Unauthenticated → redirect to home
  throw redirect(302, "/");
}
