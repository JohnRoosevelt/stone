<script>
  import LongpressCtrl from "$lib/sda/LongpressCtrl.svelte";
  import ArticleCtrl from "$lib/sda/ArticleCtrl.svelte";
  import Article from "./Article.svelte";
  import { page } from "$app/state";

  let clientHeight = $state(0);
  let isShowCtrl = $state(false);
  let isShowLongpressCtrl = $state(false);
  let scrollPercentage = $state(0);
  let scrollRaf = $state(0);
</script>

<svelte:head>
  <title>{page.data.book?.name} {page.data.title}</title>
</svelte:head>

<svelte:document
  onselectionchange={() => {
    const selection = document.getSelection().toString();
    isShowLongpressCtrl = Boolean(selection);
    if (isShowLongpressCtrl) {
      isShowCtrl = false;
    }
  }}
/>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<section
  flex-1
  h-full
  flex-cc
  relative
  bind:clientHeight
  aria-label="文章内容"
  tabindex="0"
  onclick={() => {
    if (isShowLongpressCtrl) return;
    isShowCtrl = !isShowCtrl;
  }}
  onkeydown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isShowLongpressCtrl) return;
      isShowCtrl = !isShowCtrl;
    }
  }}
>
  <article
    style:height="{clientHeight}px"
    w-full
    relative
    scroll-y
    class="pb-50vh"
    onscroll={(e) => {
      isShowCtrl = false;
      // rAF-throttle to avoid heavy $state writes on every wheel/touch tick
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const pct =
          scrollHeight - clientHeight === 0
            ? 0
            : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
        if (pct !== scrollPercentage) scrollPercentage = pct;
      });
    }}
  >
    <div h-1px id="article-top"></div>
    {#key page.params.chapterId}
      <Article />
    {/key}
    <div h-1px id="article-bottom"></div>
  </article>

  <ArticleCtrl bind:isShowCtrl {scrollPercentage} />
  <LongpressCtrl bind:isShowLongpressCtrl />
</section>
