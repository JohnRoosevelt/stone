<script>
  import { page } from "$app/state";
  import { slide } from "svelte/transition";
  import { goto } from "$app/navigation";
  import { DATAS } from "$lib/data.svelte";
  import { showId } from "$lib";
  import Setting from "$lib/sda/Setting.svelte";
  import Chapter from "$lib/sda/Chapter.svelte";
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
    <a
      href="/sda"
      data-sveltekit-replacestate
      aria-label="scroll-to-back"
      flex-cc
      text-green
      px-2
      py-4
    >
      <span i-carbon-chevron-left></span>
    </a>

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
    px-8
    flex-bc
    transition300
    overflow-hidden
    h-12
    bg="gray-100 dark:gray-900"
    text="green 7"
  >
    <button
      flex-1
      h-full
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
      h-full
      aria-label="media"
      text-gray
      onclick={() => {
        info("暂无相关媒体资源");
      }}
    >
      <span i-carbon-media-library></span>
    </button>

    <button
      flex-1
      h-full
      aria-label="search"
      text-gray
      onclick={() => {
        console.log("to search");
        // goto(`?s=${page.params.chapterId}`, {replaceState: true})
        // DATAS.dialog = { c: Setting, show: true, p: "b" };
        info("网页中暂不支持搜索");
      }}
    >
      <span i-carbon-search></span>
    </button>

    <div flex-1 h-full flex-cc gap-px>
      <button
        w-12
        h-full
        sm="hidden"
        aria-label="menu"
        onclick={(e) => {
          DATAS.dialog = { c: Chapter, show: true, p: "l" };
        }}
      >
        <span i-carbon-menu></span>
      </button>

      <button
        w-12
        h-full
        aria-label="pre"
        disabled={page.params.chapterId == 1}
        class:text-gray={page.params.chapterId == 1}
        onclick={(e) => {
          goto(page.params.chapterId - 1, { replaceState: true });
        }}
      >
        <span i-carbon-arrow-left></span>
      </button>

      <button
        w-12
        h-full
        aria-label="next"
        disabled={page.params.chapterId == page.data.dirZh?.length}
        class:text-gray={page.params.chapterId == page.data.dirZh?.length}
        onclick={(e) => {
          goto(page.params.chapterId - 1 + 2, { replaceState: true });
        }}
      >
        <span i-carbon-arrow-right></span>
      </button>
    </div>
  </section>
{/if}
