<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";
  import InitialImport from "$lib/global/InitialImport.svelte";
  import RouteLoading from "$lib/global/RouteLoading.svelte";
  import { isTauri } from "$lib/tauri";
  import { setTheme } from "$lib/setTheme.svelte";
  import { handleVisibilityChange, wakeLock } from "$lib/wakeLock";
  import Updater from "$lib/global/Updater.svelte";
  import { SvelteToast } from "@zerodevx/svelte-toast";
  import { onMount } from "svelte";

  // $inspect(DATAS).with(console.trace);
  const { children } = $props();
  let innerWidth = $state(0);

  // ── OS-level dark mode preference ──
  let osDark = $state(false);
  let osMedia = $state(null);

  /** Derive isDarkMode from themeMode and the OS preference */
  function syncDarkMode() {
    if (DATAS.themeMode === "system") {
      DATAS.isDarkMode = osDark;
    } else {
      DATAS.isDarkMode = DATAS.themeMode === "dark";
    }
  }

  // ── Network information management ──────────────────────────
  /** NetworkInformation object (may be null) */
  let connection = $state(null);

  /** Update network status to global store */
  function updateNetworkInfo(netInfo) {
    if (!netInfo) return;
    DATAS.networkType = netInfo.effectiveType || netInfo.type || "unknown";
    DATAS.connectionType = netInfo.type || "unknown";
  }

  // Client-side initialization (runs only in browser, not during SSR)
  onMount(async () => {
    // ── Detect Tauri environment once at startup ──
    DATAS.isTauri = isTauri();

    // ── Restore persisted themeMode, defaulting to "system" ──
    const saved = localStorage.getItem("themeMode");
    if (saved === "light" || saved === "dark" || saved === "system") {
      DATAS.themeMode = saved;
    } else {
      // Migrate legacy "theme" key
      const legacy = localStorage.getItem("theme");
      if (legacy === "dark" || legacy === "light") {
        DATAS.themeMode = legacy;
        localStorage.removeItem("theme");
      }
    }

    // ── Watch OS colour-scheme ──
    osMedia = window.matchMedia("(prefers-color-scheme: dark)");
    osDark = osMedia.matches;
    osMedia.addEventListener("change", (e) => {
      osDark = e.matches;
    });

    // ── Wake Lock ──
    // wakeLock() silently fails on initial load without user gesture
    // It only takes effect when the user opens an article to read (called actively on reader pages)
    wakeLock();

    // ── Network Information ──
    connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null;

    if (connection) {
      updateNetworkInfo(connection);
      // Listen for network changes
      connection.addEventListener("change", () => {
        updateNetworkInfo(connection);
      });
    } else {
      DATAS.networkType = "unknown";
      DATAS.connectionType = "unknown";
    }
  });

  // ── Sync themeMode → isDarkMode whenever either changes ──
  $effect(() => {
    // Re-run whenever themeMode or the OS preference changes
    DATAS.themeMode;
    osDark;
    syncDarkMode();
  });

  // ── Persist themeMode whenever it changes ──
  $effect(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("themeMode", DATAS.themeMode);
    }
  });

  // ── Apply the dark class to <html> ──
  $effect(() => {
    DATAS.isDarkMode;
    setTheme(DATAS.isDarkMode ? "dark" : "light");
  });

  $effect(() => {
    DATAS.isMobile = innerWidth < 640;
  });
</script>

<SvelteToast options={{}} />
<InitialImport />
<RouteLoading />
<Dialog />
<Updater />
<svelte:window bind:online={DATAS.online} bind:innerWidth />
<svelte:document onvisibilitychange={handleVisibilityChange} />

<main
  class="w-screen h-svh overflow-hidden flex-col flex-bc z-0 bg-[#EDF1F0] text-black/85 dark:(bg-[#111615] text-white)"
>
  {@render children()}
</main>

<style uno-preflights uno-global uno-safelist="rounded-xl space-y-5">
  :global(body) {
    margin: 0;
    padding: 0;
    display: flex;
    overflow: hidden;
  }
</style>
