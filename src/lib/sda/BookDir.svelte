<script>
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import books from "$lib/sda.json";

  let clientHeight = $state(0);
  let activeId = $state("");
  let selectId = $state("");

  const fav = [
    { name: "先祖与先知", id: 1 },
    { name: "先知与君王", id: 2 },
    { name: "历代愿望", id: 3 },
    { name: "使徒行述", id: 4 },
    { name: "善恶之争", id: 5 },
    { name: "基督比喻实训", id: 11 },
    { name: "福山宝训", id: 12 },
    { name: "喜乐的泉源", id: 13 },
    { name: "乡村生活", id: 77 },
    { name: "末世大事记", id: 81 },
    { name: "救赎的故事", id: 107 },
  ];

  const groupByTag = books.reduce((pre, cur) => {
    if (!pre[cur.tag]) {
      pre[cur.tag] = [];
    }
    pre[cur.tag].push(cur);
    return pre;
  }, {});

  function observeHeaders() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeId = entry.target.id;
          }
        });
      },
      {
        root: document.getElementById("booksContainer"),
        rootMargin: "-1px 0px -99% 0px",
        threshold: 0,
      },
    );

    const ids = ["fav", ...Object.keys(groupByTag)];
    ids.forEach((id) => observer.observe(document.getElementById(id)));
  }
  onMount(() => {
    observeHeaders();
  });

  function showId(id) {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
      });
    }
  }
</script>

<article bind:clientHeight w-full h-full relative overflow-hidden>
  <section
    id="booksContainer"
    style:height="{clientHeight}px"
    relative
    scroll-y
  >
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
    <button
      onclick={() => {
        selectId = "fav";
        showId("fav");
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

    {#each Object.entries(groupByTag) as [tag]}
      <button
        onclick={() => {
          selectId = tag;
          showId(tag);
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
    <a flex-1 href="/sda/{book.id}/1">
      <p class:text-green={page.params.bookId == book.id}>
        {book.name}
      </p>
    </a>
  </div>
{/snippet}
