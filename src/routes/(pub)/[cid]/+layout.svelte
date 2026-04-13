<script>
  import { page } from "$app/state";
  import Dir from "$lib/cid/Dir.svelte";
  import { DATAS } from "$lib/data.svelte";

  const { data, children } = $props();

  const hidden = $derived(
    (DATAS.isMobile && page.params.bookId) ||
      (page.params.bookId && DATAS.isFullScreen),
  );
</script>

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
    <Dir />
  </section>

  <section w-full h-full overflow-hidden flex-cc flex-col sm="flex-1">
    {@render children()}
  </section>
</article>
