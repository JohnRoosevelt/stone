<script>
  import { page } from "$app/state";
  import bible from "$lib/bible/bible.json";
  import { onMount } from "svelte";
  import { showId } from "$lib";

  let clientHeight = $state(0);
  let activeId = $state("");
  let selectId = $state("");

  const groupByTag = bible.reduce((pre, cur) => {
    if (!pre[cur.title]) {
      pre[cur.title] = [];
    }
    pre[cur.title].push(cur);
    return pre;
  }, {});

  // console.log({ bible, groupByTag });

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
    class="pb-12"
  >
    {#each Object.entries(groupByTag) as [tag, group]}
      <div id={tag} space-y-px>
        <div
          px-3
          sticky
          top-0
          z-3
          class={activeId === tag ? "text-green font-700" : ""}
          bg="white dark:black"
        >
          {tag}
        </div>
        {#each group as book}
          {@render Rbook(book)}
        {/each}
      </div>
    {/each}
  </section>

  <section absolute w-full h-12 bottom-0 z-3 flex-cc gap-2>
    {#each Object.entries(groupByTag) as [tag]}
      <button
        onclick={() => {
          selectId = tag;
          showId(tag, "start");
        }}
        aria-label={tag}
        flex-cc
        flex-1
        h-full
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
  <div flex-bc h-12 px-3 bg-gray-100 dark="bg-gray-700">
    <a flex-1 href="/bible/{book.id}/1">
      <p flex-bc class:text-green={page.params.bookId == book.id}>
        <span>{book.name.zh}</span>
        <span flex>
          <!-- https://symbl.cc/cn/unicode-table/#spacing-modifier-letters -->
          <!-- u+20FB -->
          <span text-green>˻</span>
          <span> {book.name.en} {book.name.ZH} </span>
          <span text-green>˼</span>
          <!-- u+20FC -->
        </span>
      </p>
    </a>
  </div>
{/snippet}
