<script>
  import Footer from "$lib/global/Footer.svelte";
    import FooterPc from "$lib/global/FooterPC.svelte";
    import HearderPc from "$lib/global/HearderPC.svelte";
    import NavPc from "$lib/global/NavPC.svelte";

  const { children } = $props();
</script>

<HearderPc />
<article data-layout="pub" w-full flex-1 flex flex-col overflow-hidden sm="flex-row">
  <NavPc />
  {@render children()}
</article>
<Footer />
<FooterPc />
