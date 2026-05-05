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

  // Client-side initialization (runs only in browser, not during SSR)
  onMount(async () => {
    // Theme from localStorage
    DATAS.isDarkMode = localStorage.getItem("theme") == "dark";

    wakeLock();

    // Network type detection
    const connection = navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection || { type: "unknown", effectiveType: "" };
    DATAS.networkType =
      connection.effectiveType || connection.type || "unknown";
    DATAS.connectionType = connection.type || "unknown";
    connection.addEventListener("change", () => {
      DATAS.networkType =
        connection.effectiveType || connection.type || "unknown";
      DATAS.connectionType = connection.type || "unknown";
    });

    // 后续 Tauri 版本将使用 Rust SQLite 替代
    console.log("[App] SQLite Worker removed, Tauri native SQL pending");
  });

  $effect(() => {
    DATAS.isDarkMode;
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
