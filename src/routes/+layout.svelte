<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";
  import RouteLoading from "$lib/global/RouteLoading.svelte";
  import { setTheme } from "$lib/setTheme.svelte";
  import { handleVisibilityChange, wakeLock } from "$lib/wakeLock";
  import { SvelteToast } from "@zerodevx/svelte-toast";
  import { onMount } from "svelte";

  // $inspect(DATAS).with(console.trace);
  const { children } = $props();
  let innerWidth = $state(0);

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
    // Theme from localStorage
    DATAS.isDarkMode = localStorage.getItem("theme") == "dark";

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

  $effect(() => {
    DATAS.isDarkMode;
    setTheme(DATAS.isDarkMode ? "dark" : "light");
  });

  $effect(() => {
    DATAS.isMobile = innerWidth < 640;
  });

  // ── Debug: detect current origin (for Android CORS troubleshooting) ──
  let origin = $state("");
  $effect(() => {
    if (typeof window !== "undefined") {
      origin = window.location.origin;
    }
  });
</script>

<SvelteToast options={{}} />
<RouteLoading />
<Dialog />

<svelte:window bind:online={DATAS.online} bind:innerWidth />
<svelte:document onvisibilitychange={handleVisibilityChange} />

<main
  class="w-screen h-svh overflow-hidden flex-col flex-bc z-0 bg-[#EDF1F0] text-black/85 dark:(bg-[#111615] text-white)"
>
  {@render children()}
</main>

<!-- Debug: show current origin for CORS troubleshooting -->
{#if origin}
  <div
    class="fixed bottom-0 left-0 z-50 bg-black/70 text-white text-xs px-2 py-0.5 rounded-tr"
  >
    origin: {origin}
  </div>
{/if}

<style uno-preflights uno-global uno-safelist="rounded-xl space-y-5">
  :global(body) {
    margin: 0;
    padding: 0;
    display: flex;
    overflow: hidden;
  }
</style>
