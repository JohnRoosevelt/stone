<script>
  import Footer from "$lib/global/Footer.svelte";
  import FooterPc from "$lib/global/FooterPC.svelte";
  import HearderPc from "$lib/global/HearderPC.svelte";
  import NavPc from "$lib/global/NavPC.svelte";
  import { DATAS } from "$lib/data.svelte";

  const { children } = $props();
</script>

{#if !DATAS.isMobile}
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
  {#if !DATAS.isMobile}
    <NavPc />
  {/if}
  {@render children()}
</article>

{#if DATAS.isMobile}
  <Footer />
{:else}
  <FooterPc />
{/if}
