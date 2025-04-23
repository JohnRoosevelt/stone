<script>
  import { page } from "$app/state";
  import { DATAS } from "$lib/data.svelte";
  import Setting from "$lib/sda/Setting.svelte";
  import { slide } from "svelte/transition";

  const { children, data } = $props();

  let clientHeight = $state(0);

  let isShow = $state(false);
  let scrollPercentage = $state(0);

  function showId(id) {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
      });
    }
  }
</script>

<Setting />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
  flex-1
  h-full
  bind:clientHeight
  onmousedown={() => {
    isShow = !isShow;
  }}
>
  <article
    w-full
    style:height="{clientHeight}px"
    relative
    leading="170%"
    scroll-y
    onscroll={(event) => {
      isShow = false;

      const { scrollTop, scrollHeight, clientHeight } = event.target;

      scrollPercentage = Math.round(
        (scrollTop / (scrollHeight - clientHeight)) * 100,
      );
      // console.log({ scrollPercentage, scrollTop, scrollHeight, clientHeight });
    }}
  >
    <div h-1px id="top"></div>
    {@render children()}
    <div h-1px id="bottom"></div>
  </article>
</section>

{#if isShow}
  <section
    transition:slide
    fixed
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
      <button flex-cc gap-px onclick={() => history.back()}>
        <span i-carbon-chevron-left text-6 text-green></span>
        <span underline underline-offset-4 flex-shrink-0 text-3
          >{data.book.name}</span
        >
        <span text-3 truncate mx-2>{data.titleZh}</span>
      </button>
    </div>

    <div text-5 flex-cc gap-2 flex="shrink-0">
      <div flex-cc gap-2px>
        {#if scrollPercentage > 5}
          <button
            aria-label="scroll-to-top"
            flex-cc
            text-green
            onclick={() => {
              showId('top')
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
              showId('bottom')
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
    fixed
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
      <a
        aria-label="menu"
        data-sveltekit-replacestate
        onclick={(e) => {
          document.getElementById("top").scrollIntoView({
            behavior: "smooth",
          });
          isShow = false;
        }}
        href="/sda/{page.params.bookId}"
      >
        <span i-carbon-menu></span>
      </a>

      <a
        aria-label="pre"
        data-sveltekit-replacestate
        onclick={(e) => {
          document.getElementById("top").scrollIntoView({
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
          document.getElementById("top").scrollIntoView({
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
