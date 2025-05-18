<script>
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import books from "$lib/book/book.json";
  import { DATAS } from "$lib/data.svelte";
  import { showId } from "$lib";

  let clientHeight = $state(0);
  let activeId = $state("");
  let selectId = $state("");

  const groupByTag = books.reduce((pre, cur) => {
    if (!pre[cur.tag]) {
      pre[cur.tag] = [];
    }
    pre[cur.tag].push(cur);
    return pre;
  }, {});

  console.log(groupByTag);
  

  function observeHeaders() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeId = entry.target.id;
            if (activeId == selectId) {
              selectId = "";
            }
          }
        });
      },
      {
        root: document.getElementById("booksContainer"),
        rootMargin: "-1px 0px -99% 0px",
        threshold: 0,
      },
    );

    const ids = [...Object.keys(groupByTag)];
    ids.forEach((id) => observer.observe(document.getElementById(id)));
  }
  onMount(() => {
    observeHeaders();
  });
</script>

<article bind:clientHeight w-full h-full relative overflow-hidden font-500>
  <section
    id="booksContainer"
    style:height="{clientHeight}px"
    relative
    scroll-y
  >
    {#each Object.entries(groupByTag) as [tag, group]}
      <div id={tag} space-y-px class:min-h-full={tag == "Z"}>
        <div
          px-3
          sticky
          top-0
          z-3
          bg="white dark:black"
          class={activeId === tag ? "text-green font-700" : ""}
        >
          {tag}
        </div>
        {#each group as book}
          {@render Rbook(book)}
        {/each}
      </div>
    {/each}
  </section>

  <section absolute w-auto h-full top-0 right-4 z-3 flex-col flex-cc gap-px>
    {#each Object.entries(groupByTag) as [tag]}
      <button
        onclick={() => {
          selectId = tag;
          showId(tag, "start");
        }}
        aria-label={tag}
        size-6
        flex-cc
        p-1
        rounded-1
        class={activeId === tag
          ? "text-green font-700 bg-gray-200 dark:(bg-gray-600)"
          : selectId == tag
            ? "text-red bg-gray-300 dark:(bg-gray-800)"
            : "bg-gray-300 dark:(bg-gray-800)"}
        >{tag}
      </button>
    {/each}
  </section>
</article>

{#snippet Rbook(book)}
  <div flex-bc h-12 px-3 pr-12 bg-gray-100 dark="bg-gray-700">
    <a flex-1 href="/book/{book.id}/1">
      <p class:text-green={page.params.bookId == book.id}>
        {book.name}
      </p>
    </a>
  </div>
{/snippet}
