<script>
  import LongpressCtrl from "$lib/sda/LongpressCtrl.svelte";
  import ArticleCtrl from "$lib/sda/ArticleCtrl.svelte";
  import Sda from "./sda.svelte";
  import Bible from "./bible.svelte";
  import Book from "./book.svelte";
  import { page } from "$app/state";

  let clientHeight = $state(0);
  let isShowCtrl = $state(false);
  let isShowLongpressCtrl = $state(false);
  let scrollPercentage = $state(0);

  const Content = $derived.by(() => {
    let rz;

    switch (page.params.cid) {
      case "bible":
        rz = Bible;
        break;

      case "sda":
        rz = Sda;
        break;

      case "book":
        rz = Book;
        break;

      default:
        break;
    }
    return rz;
  });
</script>

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
<section
  flex-1
  h-full
  flex-cc
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
    class="pb-50vh"
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
    {#key page.params.chapterId}
      <Content />
    {/key}
    <div h-1px id="article-bottom"></div>
  </article>

  <ArticleCtrl bind:isShowCtrl {scrollPercentage} />
  <LongpressCtrl bind:isShowLongpressCtrl />
</section>
