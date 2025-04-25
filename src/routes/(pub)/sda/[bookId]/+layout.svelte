<script>
  import { page } from "$app/state";
  import { showId } from "$lib";
  import { DATAS, TOUCHP } from "$lib/data.svelte";
  import { info } from "$lib/global/Toast";
  import Chapter from "$lib/sda/Chapter.svelte";
  import Setting from "$lib/sda/Setting.svelte";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { afterNavigate, goto } from "$app/navigation";

  const { data, children } = $props();

  let clientHeight = $state(0);
  let innerWidth = $state(0);
  const isMobile = $derived(innerWidth < 640);
  const hidden = $derived(isMobile);

  let isShow = $state(false);
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
    let isLongPress = false;
    let pressTimer = 0;

    function handleClick(event) {
      console.log(event.target);
      isShow = !isShow;
    }

    function handleMousedown(event) {
      const lang = event.target.getAttribute("data-lang");
      const pIndex = event.target.getAttribute("data-i");

      if (!lang || !pIndex) {
        return;
      }

      pressTimer = setTimeout(() => {
        isLongPress = true;
        console.log("长按触发！", { lang, pIndex });
        info(`长按了第 ${pIndex} 段`);
        // TOUCHP[pIndex] = TOUCHP[pIndex] || {};
        // TOUCHP[pIndex][lang] = true;
      }, 500);
    }

    function handleMouseup() {
      clearTimeout(pressTimer);
    }

    $effect(() => {
      node.addEventListener("click", handleClick);
      node.addEventListener("mousedown", handleMousedown);
      node.addEventListener("mouseup", handleMouseup);
      node.addEventListener("touchstart", handleMousedown);
      node.addEventListener("touchend", handleMouseup);
      node.addEventListener("touchmove", handleMouseup);

      return () => {
        node.removeEventListener("click", handleClick);
        node.removeEventListener("mousedown", handleMousedown);
        node.removeEventListener("mouseup", handleMouseup);
        node.removeEventListener("touchstart", handleMousedown);
        node.removeEventListener("touchend", handleMouseup);
        node.removeEventListener("touchmove", handleMouseup);
      };
    });
  }
</script>

<svelte:window bind:innerWidth />

<article data-layout="bookId" w-full h-full flex-bc>
  {#if !isMobile}
    <section w-60 h-full flex-shrink-0>
      <Chapter />
    </section>
  {/if}

  <section flex-1 h-full relative bind:clientHeight use:articleSection>
    <article
      style:height="{clientHeight}px"
      style:font-size="{DATAS.fontSize}px"
      style:background-color={true ? DATAS.bg : ""}
      w-full
      relative
      scroll-y
      leading="170%"
      onscroll={(event) => {
        isShow = false;

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
    {@render RArticleMobile()}
  </section>
</article>

{#snippet RArticleMobile()}
  {#if isShow}
    <section
      transition:slide
      absolute
      z-9
      top-0
      w-full
      h-12
      px-3
      flex-bc
      transition300
      overflow-hidden
      bg="gray-100 dark:gray-900"
    >
      <div flex-cc>
        <a href="/sda" data-sveltekit-replacestate flex-cc gap-px>
          <span i-carbon-chevron-left text-6 text-green font-700></span>
          <span underline underline-offset-4 flex-shrink-0 font-500
            >{data.book.name}</span
          >
          <span truncate mx-1>{page.data.titleZh}</span>
        </a>
      </div>

      <div
        text-5
        grid="~ cols-3"
        text="gray"
        flex="shrink-0"
        bg="gray-200"
        divide="x-1 gray-100"
        rounded-4
      >
        <button
          aria-label="scroll-to-top"
          flex-cc
          px-1
          py-px
          class:text-green={scrollPercentage !== 0}
          onclick={(event) => {
            // event.stopPropagation();
            // event.preventDefault();
            showId("article-top", "end");
          }}
        >
          <span i-carbon-up-to-top></span>
        </button>

        <div overflow-visible flex-cc size="auto">
          <span text-3> {scrollPercentage}% </span>
        </div>

        <button
          aria-label="scroll-to-bottom"
          flex-cc
          px-1
          py-px
          class:text-green={scrollPercentage !== 100}
          onclick={() => {
            showId("article-bottom");
          }}
        >
          <span i-carbon-down-to-bottom></span>
        </button>
      </div>
    </section>

    <section
      transition:slide
      absolute
      z-9
      bottom-0
      w-full
      px-4
      flex-bc
      transition300
      overflow-hidden
      h-12
      bg="gray-100 dark:gray-900"
      text="green 6"
    >
      <button
        px-2
        py-1
        aria-label="setting"
        onclick={() => {
          DATAS.dialog = { c: Setting, show: true, p: "b" };
          isShow = false;
        }}
      >
        <span i-carbon-settings></span>
      </button>

      <button
        px-2
        py-1
        aria-label="lang"
        class:text-gray={DATAS.showSdaEnglish}
        onclick={() => {
          DATAS.showSdaEnglish = !DATAS.showSdaEnglish;
          isShow = false;
        }}
      >
        <span i-carbon-language></span>
      </button>

      <button
        px-2
        py-1
        aria-label="media"
        text-gray
        onclick={() => {
          info("暂无相关媒体资源");
        }}
      >
        <span i-carbon-media-library></span>
      </button>

      <button
        px-2
        py-1
        aria-label="search"
        flex-cc
        px-1
        py-px
        text-gray
        onclick={() => {
          console.log("to search");
          // goto(`?s=${page.params.chapterId}`, {replaceState: true})
          // DATAS.dialog = { c: Setting, show: true, p: "b" };
          info("搜索功能网页中暂不支持");
        }}
      >
        <span i-carbon-search></span>
      </button>

      <div flex-cc gap-2>
        <button
          px-2
          py-1
          sm="hidden"
          aria-label="menu"
          onclick={(e) => {
            DATAS.dialog = { c: Chapter, show: true, p: "l" };
            isShow = false;
          }}
        >
          <span i-carbon-menu></span>
        </button>

        <button
          px-2
          py-1
          aria-label="pre"
          disabled={page.params.chapterId == 1}
          class:text-gray={page.params.chapterId == 1}
          onclick={(e) => {
            goto(page.params.chapterId - 1, { replaceState: true });
            isShow = false;
          }}
        >
          <span i-carbon-chevron-left></span>
        </button>

        <button
          px-2
          py-1
          aria-label="next"
          disabled={page.params.chapterId == page.data.dirZh?.length}
          class:text-gray={page.params.chapterId == page.data.dirZh?.length}
          onclick={(e) => {
            goto(page.params.chapterId - 1 + 2, { replaceState: true });
            isShow = false;
          }}
        >
          <span i-carbon-chevron-right></span>
        </button>
      </div>
    </section>
  {/if}
{/snippet}
