<script>
  import { afterNavigate } from "$app/navigation";
  import { DATAS, TOUCHP } from "$lib/data.svelte.js";
  import { onMount } from "svelte";

  const { data } = $props();
  // console.log(data);
  // $inspect(TOUCHP);

  $effect(() => {
    console.log('::TODO::', 'restore highlights');
    
  })

  // 恢复高亮
  function restoreHighlights() {
    const highlights = JSON.parse(localStorage.getItem("highlights") || "[]");
    if (highlights.length === 0) return;

    const text = paragraph.textContent;
    let currentNode = paragraph.firstChild;
    let currentOffset = 0;

    highlights.forEach((highlight) => {
      // 找到对应的文本范围
      const startOffset = highlight.startOffset;
      const endOffset = startOffset + highlight.length;

      // 创建范围
      const range = document.createRange();
      let startSet = false;

      function setRange(node, offset, targetOffset, isStart) {
        if (!node) return false;
        if (node.nodeType === Node.TEXT_NODE) {
          const nodeLength = node.textContent.length;
          if (offset + nodeLength >= targetOffset) {
            if (isStart) {
              range.setStart(node, targetOffset - offset);
              startSet = true;
            } else {
              range.setEnd(node, targetOffset - offset);
            }
            return true;
          }
          offset += nodeLength;
        }
        for (let child of node.childNodes) {
          if (setRange(child, offset, targetOffset, isStart)) {
            return true;
          }
          offset += child.textContent.length;
        }
        return false;
      }


      setRange(paragraph, 0, startOffset, true);
      if (startSet) {
        setRange(paragraph, 0, endOffset, false);
        // 应用高亮
        const span = document.createElement("span");
        span.className = "highlight";
        try {
          range.surroundContents(span);
        } catch (e) {
          console.warn("无法恢复高亮，可能由于文本结构变化", e);
        }
      }
    });
  }
</script>

<svelte:head>
  <title>{data.book.name} {data.titleZh}</title>
</svelte:head>

<article
  w-full
  space-y-2
  leading="170%"
  style:font-size="{DATAS.fontSize}px"
  style:background={!DATAS.isDarkMode ? DATAS.bg : ""}
>
  {#each data.chapterZh as { t, p, c }, i}
    {#if DATAS.showSdaEnglish}
      <p
        id="en-{i}"
        px-5
        class:bg-blue-100={TOUCHP[i]?.zh}
        data-lang="en"
        data-t={t}
        data-pp={p}
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
      id="zh-{i}"
      px-5
      class:bg-blue-100={TOUCHP[i]?.zh}
      data-lang="zh"
      data-lang-origin="en"
      data-t={t}
      data-pp={p}
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
      after={t == 7 && false
        ? `content-[attr(data-lang-origin)] ml-3 text-green`
        : ""}
    >
      {c}
    </p>
  {/each}
</article>
