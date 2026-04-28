<script>
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { DATAS } from "$lib/data.svelte";
  import { showId } from "$lib";

  let clientHeight = $state(0);
  let activeId = $state("");
  let selectId = $state("");

  const fav = $derived(page.data.books.filter((b) => b.featured));

  const groupByTag = page.data.books.reduce((pre, cur) => {
    if (!pre[cur.title]) {
      pre[cur.title] = [];
    }
    pre[cur.title].push(cur);
    return pre;
  }, {});

  const sortedTags = $derived(
    Object.entries(groupByTag).sort(([a], [b]) => a.localeCompare(b)),
  );

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

    const ids = [
      ...(fav.length > 0 ? ["fav"] : []),
      ...Object.keys(groupByTag),
    ];
    ids.forEach((id) => observer.observe(document.getElementById(id)));
  }

  $effect(() => {
    if (page.data.books.length === 0) return;
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
    {#if fav.length > 0}
      <div id="fav" space-y-px>
        <div
          px-3
          sticky
          top-0
          z-3
          bg="white dark:black"
          class={activeId === "fav" ? "text-green font-700" : ""}
        >
          <span i-carbon-star-filled></span>
        </div>
        {#each fav as book}
          {@render Rbook(book)}
        {/each}
      </div>
    {/if}

    {#each sortedTags as [tag, group]}
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
    {#if fav.length > 0}
      <button
        onclick={() => {
          selectId = "fav";
          showId("fav", "start");
        }}
        aria-label="fav"
        size-6
        flex-cc
        p-1
        rounded-1
        class={activeId === "fav"
          ? "text-green font-700 bg-gray-200 dark:(bg-gray-600)"
          : selectId == "fav"
            ? "text-red bg-gray-300 dark:(bg-gray-800)"
            : "bg-gray-300 dark:(bg-gray-800)"}
      >
        <span i-carbon-star-filled></span>
      </button>
    {/if}

    {#each sortedTags as [tag]}
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
    <a flex-1 href="/{page.params.cid}/{book.book_id}/1">
      <p class:text-green={page.params.bookId == book.book_id}>
        {book.name}
      </p>
    </a>
  </div>
{/snippet}
