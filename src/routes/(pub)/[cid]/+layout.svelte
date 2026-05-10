<script>
  import { page } from "$app/state";
  import Dir from "$lib/cid/Dir.svelte";
  import { DATAS } from "$lib/data.svelte";
  import { getBooks } from "$lib/tauri";
  import { needsLoad, setBooks } from "$lib/booksStore.svelte.js";

  const { data, children } = $props();

  // Tauri: books come from local SQLite, loaded via Tauri API
  // Cloudflare: books come from server (D1), no need to load on client
  $effect(() => {
    const cid = Number(page.params.cid);
    if (DATAS.isTauri && needsLoad(cid)) {
      getBooks("zh", cid)
        .then((list) => setBooks(list, cid))
        .catch((e) => console.error("[cid] load books error:", e));
    }
  });

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
