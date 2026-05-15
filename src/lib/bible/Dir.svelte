<script>
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { showId } from "$lib";
  import { getAllReadingProgress, isTauri } from "$lib/tauri";

  let { bookList = page.data.books || [] } = $props();

  let clientHeight = $state(0);
  let activeId = $state("");
  let selectId = $state("");
  /** Map of "cid-bookId" -> reading progress record */
  let progressMap = $state({});

  const groupByTag = $derived(
    bookList.reduce((pre, cur) => {
      if (!pre[cur.title]) {
        pre[cur.title] = [];
      }
      pre[cur.title].push(cur);
      return pre;
    }, {}),
  );

  // console.log({ bible, groupByTag });

  // Load reading progress for all books
  async function loadProgress() {
    if (!isTauri()) return;
    try {
      const list = await getAllReadingProgress();
      const map = {};
      for (const rp of list) {
        const key = rp.cid + "-" + rp.book_id;
        map[key] = rp;
      }
      progressMap = map;
    } catch (err) {
      console.error("Failed to load reading progress:", err);
    }
  }

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
    loadProgress();
    observeHeaders();
  });
</script>

<article
  bind:clientHeight
  class="w-full h-full relative overflow-hidden font-500"
>
  <section
    id="booksContainer"
    style:height="{clientHeight}px"
    class="h-full pb-12 relative scroll-y"
  >
    {#each Object.entries(groupByTag) as [tag, group]}
      <div id={tag} class="space-y-px">
        <div
          class={[
            activeId === tag && "text-green font-700",
            "px-3 sticky top-0 z-3 bg-white dark:bg-black",
          ]}
        >
          {tag}
        </div>
        {#each group as book}
          {@render Rbook(book)}
        {/each}
      </div>
    {/each}
  </section>

  <section class="absolute w-full h-12 bottom-0 z-3 flex-cc gap-2">
    {#each Object.entries(groupByTag) as [tag]}
      <button
        onclick={() => {
          selectId = tag;
          showId(tag, "start");
        }}
        aria-label={tag}
        class={[
          "flex-cc flex-1 h-full rounded-1",
          activeId === tag
            ? "text-green font-700 bg-gray-200 dark:bg-gray-600"
            : selectId == tag
              ? "text-red bg-gray-300 dark:bg-gray-800"
              : "bg-gray-300 dark:bg-gray-800",
        ]}
        >{tag}
      </button>
    {/each}
  </section>
</article>

{#snippet Rbook(book)}
  {@const key = "0-" + book.book_id}
  {@const rp = progressMap[key]}
  {@const chapterLink = rp
    ? `/0/${book.book_id}/${rp.chapter_id}`
    : `/0/${book.book_id}/1`}
  <div class="flex-bc h-12 px-3 bg-gray-100 dark:bg-gray-700">
    <a
      flex-1
      href={chapterLink}
      onclick={() => {
        if (rp && rp.scroll_percentage > 0) {
          sessionStorage.setItem(
            "restoreScroll_" + book.book_id,
            String(rp.scroll_percentage),
          );
        }
      }}
    >
      <p flex-bc class:text-green={page.params.bookId == book.book_id}>
        <span>{book.name}</span>
        <span flex class="gap-1">
          <!-- https://symbl.cc/cn/unicode-table/#spacing-modifier-letters -->
          <!-- u+20FB -->
          <span text-green>˻</span>
          <span>{book.abbreviation}</span>
          <span text-green>˼</span>
          <!-- u+20FC -->
          {#if rp}
            <span class="text-2 text-gray-400"
              >{rp.chapter_id}˼ {rp.scroll_percentage}%</span
            >
          {/if}
        </span>
      </p>
    </a>
  </div>
{/snippet}

<style
  uno-global
  uno-safelist="text-green font-700 bg-gray-200 dark:bg-gray-600 text-red bg-gray-300 dark:bg-gray-800"
></style>
