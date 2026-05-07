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
    class="absolute z-9 bottom-14 right-2 text-7 grid grid-cols-1 bg-gray-200 divide-y-2 divide-gray-100 rounded-4 text-gray dark:bg-gray-700 dark:divide-gray-800"
  >
    <button
      aria-label="返回"
      class="flex-cc text-green px-2 py-4"
      onclick={() => safeGoBack("/" + page.params.cid)}
    >
      <span class="i-carbon-chevron-left"></span>
    </button>

    <button
      aria-label="scroll-to-top"
      class="flex-cc px-2 py-4"
      class:text-green={scrollPercentage !== 0}
      onclick={() => {
        showId("article-top", "end");
      }}
    >
      <span class="i-carbon-up-to-top"></span>
    </button>

    <div class="size-auto overflow-visible flex-cc py-2">
      <span class="text-3"> {scrollPercentage}% </span>
    </div>

    <button
      aria-label="scroll-to-bottom"
      class="flex-cc px-2 py-4"
      class:text-green={scrollPercentage !== 100}
      onclick={() => {
        showId("article-bottom");
      }}
    >
      <span class="i-carbon-down-to-bottom"></span>
    </button>

    <button
      aria-label="scroll-to-bottom"
      class="flex-cc px-2 py-4
      text-green"
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
      <span
        class={DATAS.isFullScreen
          ? "i-carbon-screen"
          : "i-carbon-fit-to-screen"}
      ></span>
    </button>

    <button
      aria-label="scroll-to-bottom"
      class="
      flex-cc
      px-2
      py-4
      text-green"
      onclick={() => {
        DATAS.dialog = { c: Setting, show: true, p: "b" };
      }}
    >
      <span class="i-carbon-settings"></span>
    </button>
  </section>

  <section
    transition:slide
    class="
    absolute
    z-9
    bottom-0
    w-full
    px-4
    flex-bc
    transition300
    overflow-hidden
    h-12
    bg-gray-100 dark:bg-gray-900
    text-green text-7"
  >
    <button
      class="
      flex-1
      flex-cc"
      aria-label="lang"
      class:text-gray={DATAS.showSdaEnglish}
      onclick={(event) => {
        event.stopPropagation();
        // console.log(1, event.target, event.type, event.eventPhase);

        DATAS.showSdaEnglish = !DATAS.showSdaEnglish;
      }}
    >
      <span class="i-carbon-language"></span>
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
      <span class="i-carbon-media-library"></span>
    </button>

    <a href="/search" flex-1 flex-cc h-full aria-label="search">
      <span class="i-carbon-search"></span>
    </a>

    <div class="flex-1 flex-cc gap-px">
      <button
        class="
          w-12
          flex-cc
          sm:hidden"
        aria-label="menu"
        onclick={(e) => {
          DATAS.dialog = { c: Chapter, show: true, p: "l" };
        }}
      >
        <span class="i-carbon-menu"></span>
      </button>

      <a
        class="
          w-12
          flex-cc
        "
        aria-label="previous"
        data-sveltekit-replacestate
        href={page.params.chapterId == 1
          ? ""
          : `/${page.params.cid}/${page.params.bookId}/${page.params.chapterId - 1}`}
        class:text-gray={page.params.chapterId == 1}
      >
        <span class="i-carbon-arrow-left"></span>
      </a>

      <a
        class="
          w-12
          flex-cc"
        aria-label="next"
        data-sveltekit-replacestate
        href={page.params.chapterId == page.data.chapters?.length
          ? ""
          : `/${page.params.cid}/${page.params.bookId}/${page.params.chapterId - 1 + 2}`}
        class:text-gray={page.params.chapterId == page.data.chapters?.length}
      >
        <span class="i-carbon-arrow-right"></span>
      </a>
    </div>
  </section>
{/if}
