<script>
  import { page } from "$app/state";
  import Chapter from "$lib/sda/Chapter.svelte";

  const { data, children } = $props();

  let clientHeight = $state(0);
  let innerWidth = $state(0);
  const hidden = $derived(innerWidth < 640 || !page.params.chapterId);

  $effect(() => {
    page.params.chapterId;

    document.getElementById("top-article").scrollIntoView({
      behavior: "smooth",
    });
  });
</script>

<svelte:window bind:innerWidth />

<article data-layout="bookId" w-full h-full flex-bc>
  <section w-full h-full flex-shrink-0 class:hidden sm="w-60">
    <Chapter {data} />
  </section>

  <section flex-1 h-full bind:clientHeight>
    <article w-full style:height="{clientHeight}px" relative scroll-y>
      <div h-1px id="top-article"></div>
      {@render children()}
    </article>
  </section>
</article>
