<script>
  import { page } from "$app/state";
  import { showId } from "$lib";
  import { DATAS } from "$lib/data.svelte";
  import Chapter from "$lib/sda/Chapter.svelte";
  import DialogChapter from "$lib/sda/DialogChapter.svelte";
  import Setting from "$lib/sda/Setting.svelte";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";

  const { data, children } = $props();

  let clientHeight = $state(0);
  let innerWidth = $state(0);
  const isMobile = $derived(innerWidth < 640);
  const hidden = $derived(isMobile);

  let isShow = $state(false);
  let scrollPercentage = $state(0);

  onMount(() => {
    return () => {
      DATAS.isOpenChapterDir = false;
    };
  });

  $effect(() => {
    page.params.chapterId;
    showId("article-top");
  });

  function articleSection(node) {
    function handleClick(event) {
      // console.log(event.target, event.target.getAttribute("data-area"));
      // if (!event.target.getAttribute("data-area")) {
      // }
      isShow = !isShow;
    }
    $effect(() => {
      node.addEventListener("click", handleClick);

      return () => {
        node.removeEventListener("click", handleClick);
      };
    });
  }
</script>

<svelte:window bind:innerWidth />
{#if isMobile}
  <DialogChapter />
{/if}
<Setting />

<article data-layout="bookId" w-full h-full flex-bc>
  {#if !isMobile}
    <section w-60 h-full flex-shrink-0>
      <Chapter />
    </section>
  {/if}

  <section flex-1 h-full relative bind:clientHeight use:articleSection>
    <article
      w-full
      style:height="{clientHeight}px"
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
      h-10
      px-3
      flex-bc
      transition300
      overflow-hidden
      bg="gray-100 dark:gray-900"
    >
      <div flex-cc>
        <button
          flex-cc
          gap-px
          onclick={() => {
            history.back();
          }}
        >
          <span i-carbon-chevron-left text-6 text-green></span>
          <span underline underline-offset-4 flex-shrink-0 text-3
            >{data.book.name}</span
          >
          <span text-3 truncate mx-2>{page.data.titleZh}</span>
        </button>
      </div>

      <div text-5 flex-cc gap-2 flex="shrink-0">
        <div flex-cc gap-2px>
          {#if scrollPercentage > 5}
            <button
              aria-label="scroll-to-top"
              flex-cc
              text-green
              onclick={(event) => {
                // event.stopPropagation();
                event.preventDefault();
                showId("article-top");
              }}
            >
              <span i-carbon-up-to-top></span>
            </button>
          {/if}

          <span text-3> {scrollPercentage}% </span>

          {#if scrollPercentage < 95}
            <button
              aria-label="scroll-to-bottom"
              flex-cc
              text-green
              onclick={() => {
                showId("article-bottom");
              }}
            >
              <span i-carbon-down-to-bottom></span>
            </button>
          {/if}
        </div>

        <button
          aria-label="share"
          flex-cc
          onclick={() => {
            console.log("to search");
          }}
        >
          <span i-carbon-search></span>
        </button>
      </div>
    </section>

    <section
      transition:slide
      absolute
      z-9
      bottom-0
      w-full
      px-8
      flex-bc
      transition300
      overflow-hidden
      h-10
      bg="gray-100 dark:gray-900"
      text="green 6"
    >
      <button
        aria-label="setting"
        onclick={() => {
          DATAS.isOpenSdaSeting = true;
          isShow = false;
        }}
      >
        <span i-carbon-settings></span>
      </button>

      <button
        aria-label="lang"
        class:text-gray={DATAS.showSdaEnglish}
        onclick={() => {
          DATAS.showSdaEnglish = !DATAS.showSdaEnglish;
          isShow = false;
        }}
      >
        <span i-carbon-language></span>
      </button>

      <button aria-label="media" text-gray>
        <span i-carbon-media-library></span>
      </button>

      <div flex-cc gap-4>
        <button
          sm="hidden"
          aria-label="menu"
          onclick={(e) => {
            isShow = false;
            DATAS.isOpenChapterDir = true;
          }}
        >
          <span i-carbon-menu></span>
        </button>

        <a
          aria-label="pre"
          data-sveltekit-replacestate
          onclick={(e) => {
            document.getElementById("article-top").scrollIntoView({
              behavior: "smooth",
            });
            isShow = false;
          }}
          href="/sda/{page.params.bookId}/{page.params.chapterId - 1}"
        >
          <span i-carbon-chevron-left></span>
        </a>

        <a
          aria-label="next"
          data-sveltekit-replacestate
          onclick={(e) => {
            document.getElementById("article-top").scrollIntoView({
              behavior: "smooth",
            });
            isShow = false;
          }}
          href="/sda/{page.params.bookId}/{Number(page.params.chapterId) + 1}"
        >
          <span i-carbon-chevron-right></span>
        </a>
      </div>
    </section>
  {/if}
{/snippet}
