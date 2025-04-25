import { DATAS } from "$lib/data.svelte.js";
import { wakeLock } from "$lib/wakeLock.js";
import "uno.css";

export const ssr = false;
export const prerender = true;

export async function load(params) {
  wakeLock()
  DATAS.isDarkMode = localStorage.getItem("theme") == 'dark';

  return {}
}