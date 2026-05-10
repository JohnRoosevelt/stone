<script>
  import AppDownloadBanner from "$lib/global/AppDownloadBanner.svelte";
  import Footer from "$lib/global/Footer.svelte";
  import Header from "$lib/global/Header.svelte";
  import Nav from "$lib/global/Nav.svelte";
  import { DATAS } from "$lib/data.svelte";

  const { children } = $props();
</script>

<Header />

<AppDownloadBanner />

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
    <Nav />
  {/if}
  {@render children()}
</article>

<Footer />
