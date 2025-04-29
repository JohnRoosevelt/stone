<script>
  import { page } from "$app/state";
  import { showId } from "$lib";
  import { DATAS } from "$lib/data.svelte";
  import { info } from "$lib/global/Toast";
  import Chapter from "$lib/sda/Chapter.svelte";
  import { onMount } from "svelte";
  import { afterNavigate } from "$app/navigation";
  import LongpressCtrl from "$lib/sda/LongpressCtrl.svelte";
  import ArticleCtrl from "$lib/sda/ArticleCtrl.svelte";

  const { data, children } = $props();

  let clientHeight = $state(0);
  let innerWidth = $state(0);
  const isMobile = $derived(innerWidth < 640);
  const hidden = $derived(isMobile);

  let isShowCtrl = $state(false);
  let isShowLongpressCtrl = $state(false);
  let scrollPercentage = $state(0);

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
    showId(`chapter-${page.data.chapterId}`);
    showId("article-top", "end");
  });

  // in mobile, open the chapter dir at left
  afterNavigate(({ from, to }) => {
    const isSameRoute = from.route.id === to.route.id;
    if (!isSameRoute) {
      if (!from.route.id) return;
      if (!isMobile) return;
      DATAS.dialog = { c: Chapter, show: true, p: "l" };
    }
  });
</script>

<svelte:window bind:innerWidth />

<svelte:document
  onselectionchange={() => {
    const selection = document.getSelection().toString();
    isShowLongpressCtrl = Boolean(selection);
    if (isShowLongpressCtrl) {
      isShowCtrl = false;
    }
  }}
/>

<article data-layout="bookId" w-full h-full flex-bc>
  {#if !isMobile}
    <section w-60 h-full flex-shrink-0>
      <Chapter />
    </section>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <section
    flex-1
    h-full
    relative
    bind:clientHeight
    onclick={(event) => {
      // console.log(2, event.target, event.type, event.eventPhase);

      if (isShowLongpressCtrl) {
        return;
      }
      isShowCtrl = !isShowCtrl;
    }}
  >
    <article
      style:height="{clientHeight}px"
      style=""
      w-full
      relative
      scroll-y
      onscroll={(event) => {
        isShowCtrl = false;

        const { scrollTop, scrollHeight, clientHeight } = event.target;

        scrollPercentage = Math.round(
          (scrollTop / (scrollHeight - clientHeight)) * 100,
        );
        // console.log({ scrollPercentage, scrollTop, scrollHeight, clientHeight });
      }}
    >
      <div h-1px id="article-top"></div>
      {@render children()}
      <div h-1px id="article-bottom"></div>
    </article>

    <ArticleCtrl bind:isShowCtrl {scrollPercentage} />
    <LongpressCtrl bind:isShowLongpressCtrl />
  </section>
</article>
