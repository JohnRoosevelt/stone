<script>
  import { page } from "$app/state";
  import { showId, safeGoBack } from "$lib";
  import { DATAS } from "$lib/data.svelte";

  let clientHeight = $state(0);
  let scrollPercentage = $state(0);

  $effect(() => {
    if (clientHeight > 0) {
      showId(`chapter-${page.params.chapterId}`);
    }
  });
</script>

<article class="w-full h-full overflow-hidden relative" bind:clientHeight>
  <section
    id="chapterContainer"
    style:height="{clientHeight}px"
    class="relative space-y-px scroll-y pt-12 sm:pt-0"
    onscroll={(event) => {
      const { scrollTop, scrollHeight, clientHeight } = event.target;
      scrollPercentage =
        scrollHeight - clientHeight == 0
          ? 0
          : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
    }}
  >
    <div class="h-1px" id="chapter-top"></div>
    {#each page.data?.chapters as { n }, i}
      {@const id = i + 1}
      <a
        onclick={() => {
          if (DATAS.isMobile) {
            DATAS.dialog.show = false;
          }
        }}
        id="chapter-{id}"
        data-sveltekit-replacestate
        href="/{page.params.cid}/{page.params.bookId}/{id}"
        class="flex p-2 items-center bg-gray-100 dark:bg-gray-700 relative"
        class:text-green={page.params.chapterId == id}
      >
        {n}
      </a>
    {/each}
    <div class="h-1px" id="chapter-bottom"></div>
  </section>

  <div
    class="
    absolute
    top-0
    w-full
    h-12
    flex-bc
    px-3
    bg-white dark:bg-black
    sm:hidden"
  >
    <button class="font-500">
      {page.data.book?.name} 目录
    </button>
  </div>

  <div
    class="
    absolute
    z-3
    bottom-4
    right-1
    text-7
    grid grid-cols-1
    bg-gray-200
    divide-y-2 divide-gray-100
    rounded-4
    text-gray dark:bg-gray-900 dark:divide-gray-800"
  >
    <button
      aria-label="back"
      class="flex-cc text-green px-2 py-4"
      onclick={() => safeGoBack("/" + page.params.cid)}
    >
      <span class="i-carbon-chevron-left"></span>
    </button>

    <button
      aria-label="scroll-to-top"
      class="flex-cc text-green px-2 py-4"
      class:text-green={scrollPercentage !== 0}
      class:cursor-not-allowed={scrollPercentage === 0}
      onclick={() => {
        showId("chapter-top", "end");
      }}
    >
      <span class="i-carbon-up-to-top"></span>
    </button>

    <div class="size-auto overflow-visible flex-cc py-2">
      <span class="text-3"> {scrollPercentage}% </span>
    </div>

    <button
      aria-label="scroll-to-bottom"
      class="flex-cc text-green px-2 py-4"
      class:text-green={scrollPercentage !== 100}
      class:cursor-not-allowed={scrollPercentage === 100}
      onclick={() => {
        showId("chapter-bottom");
      }}
    >
      <span class="i-carbon-down-to-bottom"></span>
    </button>
  </div>
</article>
