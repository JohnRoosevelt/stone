<script>
  import { page } from "$app/state";
  import { DATAS } from "$lib/data.svelte.js";
</script>

<article
  w-full
  space-y-2
  leading="170%"
  style:font-size="{DATAS.fontSize}px"
  style:background={!DATAS.isDarkMode ? DATAS.bg : ""}
>
  {#each page.data.chapterZh as { t, p, c }, i}
    <p
      style:text-indent="calc(var(--spacing) * {(t == 7 && i > 0) ||
      (page.params.cid === '0' && i === 0)
        ? parseInt(DATAS.fontSize / 2)
        : 0})"
      style:--before-left={t == 7
        ? `calc(var(--spacing) * -${parseInt(DATAS.fontSize / 2)})`
        : ""}
      id="zh-{i}"
      px-5
      data-lang="zh"
      data-pp={p}
      data-p={(page.params.cid !== "2" ? p : p - 1) + "˼"}
      data-i={i}
      class:flex-cc={t == 2 || (i === 0 && page.params.cid !== "0")}
      class:font-700={t == 2 || (i === 0 && page.params.cid !== "0")}
      class:font-500={t == 4}
      class:sticky={t == 4}
      class:top-0={t == 4}
      bg={t == 4 ? "white dark:black" : ""}
      class:relative={t == 7}
      class:z-2={t == 4}
      before={(t == 7 && i > 0) || (page.params.cid === "0" && i === 0)
        ? `content-[attr(data-p)] absolute text-green`
        : ""}
    >
      {@html c}
    </p>
  {/each}
</article>

<style>
  p {
    &::before {
      text-indent: var(--before-left);
    }
  }
</style>
