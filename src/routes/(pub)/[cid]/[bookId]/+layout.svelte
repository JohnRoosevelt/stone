<script>
  import { page } from "$app/state";
  import { showId } from "$lib";
  import { DATAS } from "$lib/data.svelte";
  import Chapter from "$lib/cid/Chapter.svelte";
  import { onMount } from "svelte";
  import { afterNavigate } from "$app/navigation";

  const { children } = $props();

  onMount(() => {
    return () => {
      if (DATAS.isMobile) {
        DATAS.dialog = { c: null, show: false };
      }
    };
  });

  $effect(() => {
    if (!DATAS.isMobile) {
      DATAS.dialog = { c: null, show: false };
    }
  });

  $effect(() => {
    page.params.chapterId;
    showId(`chapter-${page.params.chapterId}`);
    showId("article-top", "end");
  });

  // Mobile: show chapter list when coming from book directory for easy chapter selection
  // Don't show dialog when coming from search results (URL with hash), jump directly to paragraph
  afterNavigate(({ from, to }) => {
    if (!from) return;
    if (from.route.id === to.route.id) return;
    if (!DATAS.isMobile) return;
    if (to.url.hash) return;
    DATAS.dialog = { c: Chapter, show: true, p: "l" };
  });
</script>

<article data-layout="bookId" class="w-full h-full flex-bc">
  <section
    class={[
      DATAS.isFullScreen || DATAS.isMobile ? "w-0" : "w-60",
      "transition300 h-full flex-shrink-0",
    ]}
  >
    <Chapter />
  </section>

  {@render children()}
</article>
