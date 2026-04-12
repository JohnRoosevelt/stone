<script>
  import { page } from "$app/state";
  import { showId } from "$lib";
  import { DATAS } from "$lib/data.svelte";
  import Chapter from "$lib/cid/Chapter.svelte";
  import { onMount } from "svelte";
  import { afterNavigate } from "$app/navigation";

  const { children } = $props();

  let innerWidth = $state(0);
  const isMobile = $derived(innerWidth < 640);

  onMount(() => {
    return () => {
      if (isMobile) {
        DATAS.dialog = { c: null, show: false };
      }
    };
  });

  $effect(() => {
    if (!isMobile) {
      DATAS.dialog = { c: null, show: false };
    }
  });

  $effect(() => {
    page.params.chapterId;
    showId(`chapter-${page.params.chapterId}`);
    showId("article-top", "end");
  });

  // in mobile, open the chapter dir at left
  afterNavigate(({ from, to }) => {
    if (!from) return;
    const isSameRoute = from.route.id === to.route.id;
    if (isSameRoute) return;
    if (!isMobile) return;
    DATAS.dialog = { c: Chapter, show: true, p: "l" };
  });
</script>

<svelte:window bind:innerWidth />

<article data-layout="bookId" w-full h-full flex-bc>
  <section
    w={DATAS.isFullScreen || isMobile ? 0 : 60}
    transition300
    h-full
    flex-shrink-0
  >
    <Chapter />
  </section>

  {@render children()}
</article>
