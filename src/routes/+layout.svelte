<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";
  import RouteLoading from "$lib/global/RouteLoading.svelte";
  import { setTheme } from "$lib/setTheme.svelte";
  import { wakeLock } from "$lib/wakeLock";
  import { SvelteToast } from "@zerodevx/svelte-toast";
  import { UAParser } from "ua-parser-js";
  import { onMount } from "svelte";

  // $inspect(DATAS).with(console.trace);
  const { children } = $props();

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      console.log(new Date(), document.visibilityState);
      wakeLock();
    } else {
      console.log(new Date(), document.visibilityState);
    }
  }

  // Client-side initialization (runs only in browser, not during SSR)
  onMount(() => {
    wakeLock();

    // Network type detection
    const connection = navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection || { type: "unknown" };
    DATAS.networkType = connection.effectiveType || connection.type;
    connection.addEventListener("change", () => {
      DATAS.networkType = connection.effectiveType || connection.type;
    });

    // Theme from localStorage
    DATAS.isDarkMode = localStorage.getItem("theme") == "dark";

    // UA parsing
    const parser = new UAParser();
    DATAS.uaInfo = parser.getResult();
  });

  $effect(() => {
    DATAS.isDarkMode;
    setTheme(DATAS.isDarkMode ? "dark" : "light");
  });
</script>

<SvelteToast options={{}} />
<RouteLoading />
<Dialog />

<svelte:window bind:online={DATAS.online} />
<svelte:document onvisibilitychange={handleVisibilityChange} />

<main
  w-screen
  h-dvh
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
