<script>
  import { page } from "$app/state";
  import { DATAS } from "$lib/data.svelte";
  import Nav from "./Nav.svelte";

  const hidden = $derived(!page.route.id.includes("(home)"));
</script>

{#if DATAS.isMobile}
  <Nav />
{/if}

<!-- only show on desktop -->
<footer
  class="w-full h-6 bg-white text-3 px-3 hidden flex-bc hidden"
  dark="bg-gray-900"
  sm="flex"
>
  <div flex-cc gap-4>
    <div flex-cc gap-1>
      {#if DATAS.online}
        {#if DATAS.connectionType === "wifi"}
          <span i-carbon-wifi text-green></span>
          <span>WiFi</span>
        {:else if DATAS.connectionType === "cellular"}
          <span i-carbon-radio></span>
          <span>{DATAS.networkType}</span>
        {:else}
          <span i-carbon-network-3 text-green></span>
          <span>{DATAS.networkType}</span>
        {/if}
      {:else}
        <span i-carbon-wifi-off text-gray-400></span>
        <span>离线</span>
      {/if}
    </div>

    <button
      flex-cc
      gap-x-2
      bg-gray-200
      px-1
      py-px
      rounded-1
      aria-label="theme"
      dark="bg-gray-700"
      onclick={() => (DATAS.isDarkMode = !DATAS.isDarkMode)}
    >
      <span i-carbon-sun class:text-green={!DATAS.isDarkMode}></span>
      <span i-carbon-moon class:text-green={DATAS.isDarkMode}></span>
    </button>
  </div>
</footer>
