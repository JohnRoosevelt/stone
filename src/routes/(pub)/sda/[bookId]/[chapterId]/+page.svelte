<script>
  import { DATAS } from "$lib/data.svelte.js";

  const { data } = $props();
  // console.log(data);

  let selection = $state("");
</script>

<svelte:head>
  <title>{data.book.name} {data.titleZh}</title>
</svelte:head>

<svelte:document
  onselectionchange={() => {
    selection = document.getSelection().toString();
    console.log(selection);
  }}
/>

<article w-full px-5 pb-12 space-y-2 sm="pb-0">
  {#each data.chapterZh as { t, p, c }, i}
    {#if DATAS.showSdaEnglish}
      <p
        data-t={t}
        data-p={p + "˼"}
        data-i={i}
        class:flex-cc={t == 2}
        class:font-700={t == 2}
        class:font-500={t == 4}
        class:sticky={t == 4}
        class:top-0={t == 4}
        bg={t == 4 ? "white dark:black" : ""}
        class:z-2={t == 4}
        before={t == 7 && true
          ? `content-[attr(data-p)] absolute text-green`
          : ""}
        after={t == 7 && false ? `content-[attr(data-p)] ml-3 text-green` : ""}
      >
        {data.chapterEn[i].c}
      </p>
    {/if}

    <p
      data-t={t}
      data-p={p + "˼"}
      data-i={i}
      class:flex-cc={t == 2}
      class:font-700={t == 2}
      class:font-500={t == 4}
      class:sticky={t == 4}
      class:top-0={t == 4}
      bg={t == 4 ? "white dark:black" : ""}
      class:z-2={t == 4}
      class:indent-8={t == 7}
      before={t == 7
        ? `content-[attr(data-p)] absolute -indent-8 text-green`
        : ""}
      after={t == 7 && false ? `content-[attr(data-p)] ml-3 text-green` : ""}
    >
      {c}
    </p>
  {/each}
</article>

<!-- <div fixed top-0 bg-red-100>
  {selection}
</div> -->
