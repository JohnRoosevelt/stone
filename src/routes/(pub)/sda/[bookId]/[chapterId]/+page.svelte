<script>
  import { afterNavigate } from "$app/navigation";
  import { DATAS, TOUCHP } from "$lib/data.svelte.js";
  import { onMount } from "svelte";

  const { data } = $props();
  // console.log(data);
  $inspect(TOUCHP);

  let selection = $state("");
</script>

<svelte:head>
  <title>{data.book.name} {data.titleZh}</title>
</svelte:head>

<!-- <svelte:document
  onselectionchange={() => {
    selection = document.getSelection().toString();
    console.log({selection});
  }}
/> -->

<article w-full pb-12 space-y-2 sm="pb-0">
  {#each data.chapterZh as { t, p, c }, i}
    {#if DATAS.showSdaEnglish}
      <p
        px-5
      class:bg-blue-100={TOUCHP[i]?.zh}
        data-lang="en"
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
      px-5
      class:bg-blue-100={TOUCHP[i]?.zh}
      data-lang="zh"
      data-lang-origin="en"
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
      after={t == 7 && false ? `content-[attr(data-lang-origin)] ml-3 text-green` : ""}
    >
      {c}
    </p>
  {/each}
</article>

<!-- <div fixed top-0 bg-red-100>
  {selection}
</div> -->
