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
  class="w-full h-6 bg-white text-3 px-3 flex-bc max-sm:hidden sm:flex dark:bg-gray-900"
>
  <div class="flex-cc gap-4">
    <div class="flex-cc gap-1">
      {#if DATAS.online}
        {#if DATAS.connectionType === "wifi"}
          <span class="i-carbon-wifi text-green"></span>
          <span>WiFi</span>
        {:else if DATAS.connectionType === "cellular"}
          <span class="i-carbon-radio"></span>
          <span>{DATAS.networkType}</span>
        {:else}
          <span class="i-carbon-network-3 text-green"></span>
          <span>{DATAS.networkType}</span>
        {/if}
      {:else}
        <span class="i-carbon-wifi-off text-gray-400"></span>
        <span>离线</span>
      {/if}
    </div>

    <button
      class="flex-cc gap-x-2 bg-gray-200 px-1 py-px rounded-1 dark:bg-gray-700"
      aria-label="theme"
      onclick={() => (DATAS.isDarkMode = !DATAS.isDarkMode)}
    >
      <span class="i-carbon-sun" class:text-green={!DATAS.isDarkMode}></span>
      <span class="i-carbon-moon" class:text-green={DATAS.isDarkMode}></span>
    </button>
  </div>
</footer>
