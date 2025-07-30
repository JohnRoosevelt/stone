import { DATAS } from "$lib/data.svelte.js";
import { wakeLock } from "$lib/wakeLock.js";
import { UAParser } from 'ua-parser-js';
import "uno.css";

export const ssr = false;
export const prerender = true;

function checkNetworkType() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || { type: 'unknown' };
  DATAS.networkType = connection.effectiveType || connection.type
  connection.addEventListener('change', checkNetworkType);
}

export async function load(params) {
  wakeLock()
  checkNetworkType()
  DATAS.isDarkMode = localStorage.getItem("theme") == 'dark';

  const parser = new UAParser();
  const result = parser.getResult();
  DATAS.uaInfo = result


  return {}
}