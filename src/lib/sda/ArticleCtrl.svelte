<script>
  import { page } from "$app/state";
  import { slide } from "svelte/transition";
  import { DATAS } from "$lib/data.svelte";
  import { showId, safeGoBack } from "$lib";
  import Setting from "$lib/sda/Setting.svelte";
  import Chapter from "$lib/cid/Chapter.svelte";
  import { info } from "$lib/global/Toast";

  let { isShowCtrl = $bindable(false), scrollPercentage } = $props();
</script>

{#if isShowCtrl}
  <section
    transition:slide
    absolute
    z-9
    bottom-14
    right-2
    text-7
    grid="~ cols-1"
    bg="gray-200"
    divide="y-2 gray-100"
    rounded-4
    text-gray
  >
    <button
      aria-label="返回"
      flex-cc
      text-green
      px-2
      py-4
      onclick={() => safeGoBack("/" + page.params.cid)}
    >
      <span i-carbon-chevron-left></span>
    </button>

    <button
      aria-label="scroll-to-top"
      flex-cc
      px-2
      py-4
      class:text-green={scrollPercentage !== 0}
      onclick={() => {
        showId("article-top", "end");
      }}
    >
      <span i-carbon-up-to-top></span>
    </button>

    <div size-auto overflow-visible flex-cc py-2>
      <span text-3> {scrollPercentage}% </span>
    </div>

    <button
      aria-label="scroll-to-bottom"
      flex-cc
      px-2
      py-4
      class:text-green={scrollPercentage !== 100}
      onclick={() => {
        showId("article-bottom");
      }}
    >
      <span i-carbon-down-to-bottom></span>
    </button>

    <button
      aria-label="scroll-to-bottom"
      flex-cc
      px-2
      py-4
      text-green
      onclick={() => {
        DATAS.isFullScreen = !DATAS.isFullScreen;
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err) => {
            console.error(`fullscreen error: ${err.message}`);
          });
        } else {
          document.exitFullscreen();
        }
      }}
    >
      <span i-carbon={DATAS.isFullScreen ? "screen" : "fit-to-screen"}></span>
    </button>

    <button
      aria-label="scroll-to-bottom"
      flex-cc
      px-2
      py-4
      text-green
      onclick={() => {
        DATAS.dialog = { c: Setting, show: true, p: "b" };
      }}
    >
      <span i-carbon-settings></span>
    </button>
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
    text="green 7"
  >
    <button
      flex-1
      flex-cc
      aria-label="lang"
      class:text-gray={DATAS.showSdaEnglish}
      onclick={(event) => {
        event.stopPropagation();
        // console.log(1, event.target, event.type, event.eventPhase);

        DATAS.showSdaEnglish = !DATAS.showSdaEnglish;
      }}
    >
      <span i-carbon-language></span>
    </button>

    <button
      flex-1
      flex-cc
      aria-label="media"
      text-gray
      onclick={() => {
        info("暂无相关媒体资源");
      }}
    >
      <span i-carbon-media-library></span>
    </button>

    <a href="/search" flex-1 flex-cc h-full aria-label="search">
      <span i-carbon-search></span>
    </a>

    <div flex-1 flex-cc gap-px>
      <button
        w-12
        flex-cc
        sm="hidden"
        aria-label="menu"
        onclick={(e) => {
          DATAS.dialog = { c: Chapter, show: true, p: "l" };
        }}
      >
        <span i-carbon-menu></span>
      </button>

      <a
        w-12
        flex-cc
        aria-label="previous"
        data-sveltekit-replacestate
        href={page.params.chapterId == 1
          ? ""
          : `/${page.params.cid}/${page.params.bookId}/${page.params.chapterId - 1}`}
        class:text-gray={page.params.chapterId == 1}
      >
        <span i-carbon-arrow-left></span>
      </a>

      <a
        w-12
        flex-cc
        aria-label="next"
        data-sveltekit-replacestate
        href={page.params.chapterId == page.data.chapters?.length
          ? ""
          : `/${page.params.cid}/${page.params.bookId}/${page.params.chapterId - 1 + 2}`}
        class:text-gray={page.params.chapterId == page.data.chapters?.length}
      >
        <span i-carbon-arrow-right></span>
      </a>
    </div>
  </section>
{/if}
