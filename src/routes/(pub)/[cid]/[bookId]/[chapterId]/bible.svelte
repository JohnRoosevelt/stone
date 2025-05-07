<script>
  import { page } from "$app/state";
  import { DATAS } from "$lib/data.svelte.js";

  $effect(() => {
    console.log("::TODO::", "restore highlights bible", page.data.titleZh);
  });

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
  <title>{page.data.book.name.zh} {page.data.titleZh}</title>
</svelte:head>

<article
  w-full
  space-y-2
  leading="170%"
  style:font-size="{DATAS.fontSize}px"
  style:background={!DATAS.isDarkMode ? DATAS.bg : ""}
>
  {#each page.data.chapterZh as { id, c }, i}
    <p
      id="zh-{i}"
      px-5
      data-lang="zh"
      data-pp={id}
      data-p={id + "˼"}
      data-i={i}
      indent-8
      before="content-[attr(data-p)] absolute -indent-8 text-green"
    >
      {c}
    </p>
  {/each}
</article>
