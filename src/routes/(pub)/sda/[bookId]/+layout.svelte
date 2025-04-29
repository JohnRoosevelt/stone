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

  // onclick show the top info and bottom ctrl
  // handel long press fun
  function articleSection(node) {
    let pressTimer = 0;

    function handleMousedown(event) {
      pressTimer = setTimeout(() => {
        if (isShowCtrl) {
          isShowCtrl = false;
        }

        const lang = event.target.getAttribute("data-lang");
        const pIndex = event.target.getAttribute("data-i");

        console.log({ pIndex, lang });

        if (!lang || !pIndex) {
          return;
        }
        // info(`长按了第 ${pIndex} 段`);
        DATAS.touchInfo = { pIndex, lang };
        isShowLongpressCtrl = true;
      }, 500);
    }

    function handleMouseup(event) {
      clearTimeout(pressTimer);

      const selection = window.getSelection();
      const selectedText = selection.toString();
      console.log("mouseup", { selectedText });
      console.log(event.target, event.target.nodeType, event.target.tagName);


      if (selectedText) {
        return;
      }

      isShowCtrl = !isShowCtrl;
    }

    $effect(() => {
      if (isMobile) {
        node.addEventListener("touchstart", handleMousedown, { passive: true });
        node.addEventListener("touchend", handleMouseup, { passive: true });
        node.addEventListener("touchmove", handleMouseup, { passive: true });
        return () => {
          node.removeEventListener("touchstart", handleMousedown);
          node.removeEventListener("touchend", handleMouseup);
          node.removeEventListener("touchmove", handleMouseup);
        };
      }

      node.addEventListener("mousedown", handleMousedown);
      node.addEventListener("mouseup", handleMouseup);
      return () => {
        node.removeEventListener("mousedown", handleMousedown);
        node.removeEventListener("mouseup", handleMouseup);
      };
    });
  }
</script>

<svelte:window bind:innerWidth />

<!-- <svelte:document
  onselectionchange={() => {
    const selection = document.getSelection().toString();
    console.log({ selection });
  }}
/> -->

<article data-layout="bookId" w-full h-full flex-bc>
  {#if !isMobile}
    <section w-60 h-full flex-shrink-0>
      <Chapter />
    </section>
  {/if}

  <section flex-1 h-full relative bind:clientHeight use:articleSection>
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
    <!-- {@render RArticleMobile()} -->
    <!-- <LongpressCtrl bind:isShowLongpressCtrl bind:isShowEdit /> -->
  </section>
</article>
