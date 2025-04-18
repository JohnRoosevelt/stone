<script>
  import { page } from "$app/state";

  const { children, data } = $props();

  let clientHeight = $state(0);

  let isShow = $state(false);

  function onscroll() {
    isShow = false;
  }

  function onmousedown() {
    isShow = true;
  }
</script>

<svelte:window {onmousedown} />

<section flex-1 h-full bind:clientHeight>
  <article w-full style:height="{clientHeight}px" relative scroll-y {onscroll}>
    <div h-1px id="top"></div>
    {@render children()}
  </article>
</section>

{#if isShow}
  <section fixed z-9 top-0 w-full h-12 px-3 flex-bc bg="gray-100 dark:gray-900">
    <div flex-cc>
      <button flex-cc gap-px text-green onclick={() => history.back()}>
        <span i-carbon-chevron-left text-2xl></span>
        <span underline underline-offset-4 truncate text-3>{data.book.name}</span>
      </button>
    </div>
    <div text-3>
      {data.titleZh}
    </div>
  </section>

  <section fixed z-9 bottom-0 w-full h-12 px-3 flex-bc bg="gray-100 dark:gray-900" text="green 4">
    <button text-2xl aria-label="setting">
      <span i-carbon-settings></span>
    </button>
    <button text-2xl aria-label="media">
      <span i-carbon-media-library></span>
    </button>

    <div flex-cc gap-4>
      <a
        data-sveltekit-replacestate
        px-2
        py-1
        rounded-1
        bg="gray-200 dark:gray-800"
        onclick={(e) => {
          isShow = false;
          document.getElementById("top").scrollIntoView({
            behavior: "smooth",
          });
        }}
        href="/sda/{page.params.bookId}"
      >
        目录
      </a>

      <a
        data-sveltekit-replacestate
        px-2
        py-1
        rounded-1
        bg="gray-200 dark:gray-800"
        onclick={(e) => {
          isShow = false;
          document.getElementById("top").scrollIntoView({
            behavior: "smooth",
          });
        }}
        href="/sda/{page.params.bookId}/{page.params.chapterId - 1}"
      >
        上一章
      </a>

      <a
        data-sveltekit-replacestate
        px-2
        py-1
        rounded-1
        bg="gray-200 dark:gray-800"
        onclick={(e) => {
          isShow = false;
          document.getElementById("top").scrollIntoView({
            behavior: "smooth",
          });
        }}
        href="/sda/{page.params.bookId}/{Number(page.params.chapterId) + 1}"
      >
        下一章
      </a>
    </div>
  </section>
{/if}
