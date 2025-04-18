<script>
  import { page } from "$app/state";

  const { data } = $props();
  let clientHeight = $state(0);
  console.log(data);

  $effect(() => {
    data.bookId;
    document.getElementById("top-chapter").scrollIntoView({
      behavior: "smooth",
    });
  });
</script>

<article w-full h-full overflow-hidden relative bind:clientHeight>
  <section
    id="chapterContainer"
    style:height="{clientHeight}px"
    relative
    space-y-px
    scroll-y
    pb-12
    sm="pb-0"
  >
    <div h-1px id="top-chapter"></div>
    {#each data.dirZh as { n }, i}
      <a
        data-sveltekit-replacestate
        href="/sda/{data.bookId}/{i + 1}"
        h-10
        flex
        pl-3
        items-center
        bg-gray-100
        dark="bg-gray-700"
        relative
        class={false ? "text-green" : ""}
        class:text-green={page.params.chapterId == i + 1}
      >
        {n}
      </a>
    {/each}
    <div h-1px id="foot-chapter"></div>
  </section>

  <div absolute bottom-0 w-full h-12 flex-bc px-3 bg="white dark:black" sm="hidden">
    <button>
      {data.book.name} 目录
    </button>

    <a data-sveltekit-replacestate text-green href="/sda">
      书籍目录
    </a>
  </div>
</article>
