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
      <span i-carbon-circle-filled class:text-green={DATAS.online}></span>
      <span>{DATAS.online ? DATAS.networkType : "offline"}</span>
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
