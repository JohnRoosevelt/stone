<script>
  import { page } from "$app/state";

  const { children, data } = $props();

  let clientHeight = $state(0);

  let isShow = $state(false);
</script>

<svelte:window
  onmousedown={() => {
    setTimeout(() => {
      isShow = !isShow;
    }, 0);
  }}
/>

<section flex-1 h-full bind:clientHeight>
  <article
    w-full
    style:height="{clientHeight}px"
    relative
    leading="170%"
    scroll-y
    onscroll={() => (isShow = false)}
  >
    <div h-1px id="top"></div>
    {@render children()}
  </article>
</section>

<section
  fixed
  z-9
  top-0
  w-full
  h={isShow ? 8 : 0}
  px-3
  flex-bc
  transition300
  overflow-hidden
  bg="gray-100 dark:gray-900"
>
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

<section
  fixed
  z-9
  bottom-0
  w-full
  px-8
  flex-bc
  transition300
  overflow-hidden
  h={isShow ? 10 : 0}
  bg="gray-100 dark:gray-900"
  text="green 6"
>
  <button aria-label="setting">
    <span i-carbon-settings></span>
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
      }}
      href="/sda/{page.params.bookId}/{Number(page.params.chapterId) + 1}"
    >
      <span i-carbon-chevron-right></span>
    </a>
  </div>
</section>
