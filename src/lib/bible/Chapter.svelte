<script>
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { showId } from "$lib";
  import { DATAS } from "$lib/data.svelte";

  // const { data } = $props();
  // console.log(data);

  let clientHeight = $state(0);
  let innerWidth = $state(0);
  const isMobile = $derived(innerWidth < 640);

  let scrollPercentage = $state(0);

  $effect(() => {
    if (clientHeight > 0) {
      showId(`chapter-${page.params.chapterId}`);
    }
  });
</script>

<svelte:window bind:innerWidth />

<article w-full h-full overflow-hidden relative bind:clientHeight>
  <section
    id="chapterContainer"
    style:height="{clientHeight}px"
    relative
    space-y-px
    scroll-y
    pt-12
    sm="pt-0"
    onscroll={(event) => {
      const { scrollTop, scrollHeight, clientHeight } = event.target;

      scrollPercentage =
        scrollHeight - clientHeight == 0
          ? 0
          : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
      // console.log({ scrollPercentage, scrollTop, scrollHeight, clientHeight });
    }}
  >
    <div h-1px id="chapter-top"></div>
    {#each page.data?.dirZh as { id }}
      <a
        onclick={async (e) => {
          if (isMobile) {
            DATAS.dialog.show = false;
          }
        }}
        id="chapter-{id}"
        data-sveltekit-replacestate
        href="/bible/{page.params.bookId}/{id}"
        flex-cc
        p-2
        items-center
        bg-gray-100
        dark="bg-gray-700"
        relative
        class={false ? "text-green" : ""}
        class:text-green={page.params.chapterId == id}
      >
        {id}
      </a>
    {/each}
    <div h-1px id="chapter-bottom"></div>
  </section>

  <div
    absolute
    top-0
    w-full
    h-12
    flex-bc
    px-3
    bg="white dark:black"
    sm="hidden"
  >
    <button font-500>
      {page.data.book?.name.zh} 目录
      <span text-3 ml-2>
        {page.data.book?.name.en}
        {page.data.book?.name.ZH}
      </span>
    </button>

    <!-- <a data-sveltekit-replacestate text-green href="/sda">
      书籍目录
    </a> -->
  </div>

  <div
    absolute
    z-3
    bottom-4
    right-1
    text-7
    grid="~ cols-1"
    bg="gray-200"
    divide="y-2 gray-100"
    rounded-4
    text-gray
  >
    <a
      href="/bible"
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
        showId("chapter-top", "end");
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
        showId("chapter-bottom");
      }}
    >
      <span i-carbon-down-to-bottom></span>
    </button>
  </div>
</article>
