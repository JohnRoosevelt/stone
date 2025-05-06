<script>
  import { page } from "$app/state";
  import Cid from "$lib/Cid.svelte";

  const { data, children } = $props();
  let innerWidth = $state(0);
  const hidden = $derived(innerWidth < 640 && page.params.bookId);
</script>

<svelte:window bind:innerWidth />

<svelte:head>
  <title>怀著</title>
</svelte:head>

<article
  data-layout="sda"
  w-full
  h-full
  flex-col
  flex-bc
  overflow-hidden
  sm="flex-row"
>
  <section w-full h-full flex-shrink-0 overflow-hidden class:hidden sm="w-60">
    <Cid />
  </section>
  
  <section w-full h-full overflow-hidden flex-cc flex-col sm="flex-1">
    {@render children()}
  </section>
</article>
