<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";
  import DialogC from "$lib/global/DialogC.svelte";
  import DialogX from "$lib/global/DialogX.svelte";
  import DialogY from "$lib/global/DialogY.svelte";
  import RouteLoading from "$lib/global/RouteLoading.svelte";
  import { setTheme } from "$lib/setTheme.svelte";
  import { wakeLock } from "$lib/wakeLock";
  import { SvelteToast } from "@zerodevx/svelte-toast";

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

  $effect(() => {
    DATAS.isDarkMode;
    setTheme(DATAS.isDarkMode ? "dark" : "light");
  });
</script>

<SvelteToast options={{}} />
<RouteLoading />
<DialogC />
<DialogX />
<DialogY />

<svelte:window bind:online={DATAS.online} />
<!-- <svelte:window bind:online={DATAS.online} /> -->
<svelte:document onvisibilitychange={handleVisibilityChange} />

<main
  w-screen
  h-screen
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
