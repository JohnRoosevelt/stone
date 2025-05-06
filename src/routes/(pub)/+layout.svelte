<script>
  import Footer from "$lib/global/Footer.svelte";
  import FooterPc from "$lib/global/FooterPC.svelte";
  import HearderPc from "$lib/global/HearderPC.svelte";
  import NavPc from "$lib/global/NavPC.svelte";

  const { children } = $props();

  let innerWidth = $state(0);
  const isMobile = $derived(innerWidth < 640);
</script>

<svelte:window bind:innerWidth />

{#if !isMobile}
  <HearderPc />
{/if}

<article
  data-layout="pub"
  w-full
  flex-1
  flex
  flex-col
  overflow-hidden
  sm="flex-row"
>
  {#if !isMobile}
    <NavPc />
  {/if}
  {@render children()}
</article>

{#if isMobile}
  <Footer />
{:else}
  <FooterPc />
{/if}
