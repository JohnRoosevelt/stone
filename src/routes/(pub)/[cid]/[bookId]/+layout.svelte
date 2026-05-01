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

  // 手机端：从书籍目录进来时弹出章节列表方便选章
  // 从搜索结果（URL 带锚点）进来时不弹，直接定位到段落
  afterNavigate(({ from, to }) => {
    if (!from) return;
    if (from.route.id === to.route.id) return;
    if (!DATAS.isMobile) return;
    if (to.url.hash) return;
    DATAS.dialog = { c: Chapter, show: true, p: "l" };
  });
</script>

<article data-layout="bookId" w-full h-full flex-bc>
  <section
    w={DATAS.isFullScreen || DATAS.isMobile ? 0 : 60}
    transition300
    h-full
    flex-shrink-0
  >
    <Chapter />
  </section>

  {@render children()}
</article>
