<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";
  import RouteLoading from "$lib/global/RouteLoading.svelte";
  import { setTheme } from "$lib/setTheme.svelte";
  import { handleVisibilityChange, wakeLock } from "$lib/wakeLock";
  import { SvelteToast } from "@zerodevx/svelte-toast";
  import { onMount } from "svelte";

  const { children } = $props();
  let innerWidth = $state(0);

  // ── Network info (browser only — Tauri uses native APIs) ──
  let connection = $state(null);

  function updateNetworkInfo(netInfo) {
    if (!netInfo) return;
    DATAS.networkType = netInfo.effectiveType || netInfo.type || "unknown";
    DATAS.connectionType = netInfo.type || "unknown";
  }

  function initTheme() {
    const saved = localStorage.getItem("themeMode");
    if (saved === "light" || saved === "dark") {
      DATAS.isDarkMode = saved === "dark";
      return;
    }
    // Migrate legacy "theme" key
    const legacy = localStorage.getItem("theme");
    if (legacy === "dark" || legacy === "light") {
      DATAS.isDarkMode = legacy === "dark";
      localStorage.removeItem("theme");
      localStorage.setItem("themeMode", legacy);
    }
  }

  function initOsScheme() {
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    m.addEventListener("change", (e) => {
      if (DATAS.themeMode === "system") DATAS.isDarkMode = e.matches;
    });
  }

  function initNetwork() {
    connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null;
    if (connection) {
      updateNetworkInfo(connection);
      connection.addEventListener("change", () => updateNetworkInfo(connection));
    } else {
      DATAS.networkType = "unknown";
      DATAS.connectionType = "unknown";
    }
  }

  // Client-side initialization (runs only in browser, not during SSR)
  onMount(() => {
    // 1) Theme restore + OS preference watcher
    initTheme();
    initOsScheme();
    // 2) Wake Lock (silently fails without user gesture; reader pages
    //    call wakeLock() again on entry)
    wakeLock();
    // 3) Network status
    initNetwork();
  });

  // Apply the dark class to <html> whenever isDarkMode flips
  $effect(() => {
    setTheme(DATAS.isDarkMode ? "dark" : "light");
  });

  $effect(() => {
    DATAS.isMobile = innerWidth < 640;
  });
</script>

<SvelteToast options={{}} />
<RouteLoading />
<Dialog />

<svelte:window bind:online={DATAS.online} bind:innerWidth />
<svelte:document onvisibilitychange={handleVisibilityChange} />

<main
  w-screen
  h-svh
  overflow-hidden
  flex-col
  flex-bc
  z-0
  bg="#EDF1F0"
  text="black/85"
  dark="bg-[#111615] text-white"
>
  {@render children()}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    display: flex;
    overflow: hidden;
  }
</style>
