<script>
  import { page } from "$app/state";
  import { info } from "$lib/global/Toast";
  import { slide } from "svelte/transition";

  let { isShow = $bindable(false) } = $props();

  function saveHighlight(text, range) {
    let parent = range.commonAncestorContainer;

    if (parent.nodeType === Node.TEXT_NODE) {
      parent = parent.parentNode;
    }

    const pIndex = parent.getAttribute("data-i");

    const preRange = document.createRange();
    preRange.setStart(parent.firstChild, 0);
    preRange.setEnd(range.startContainer, range.startOffset);

    // console.log(target.firstChild, range.startContainer, range.startOffset, preRange);
    const startOffset = preRange.toString().length;

    const highlight = {
      pIndex,
      text,
      startOffset,
      length: text.length,
    };

    console.log({ highlight });

    // 从 localStorage 获取现有高亮或初始化空数组
    // let highlights = JSON.parse(localStorage.getItem("highlights") || "[]");
    // highlights.push(highlight);
    // localStorage.setItem("highlights", JSON.stringify(highlights));
  }
</script>

<!-- <svelte:document
  onselectionchange={() => {
    selection = document.getSelection().toString();
    console.log({selection});
  }}
/> -->

{#if isShow}
  <div
    absolute
    z-9
    bottom-0
    left-0
    w-full
    h-12
    flex-bc
    px-8
    text="7 green"
    transition:slide
    bg="gray-100 dark:gray-900"
  >
    <button
      aria-label="select"
      onclick={(event) => {
        const selection = window.getSelection();
        const selectedText = selection.toString();

        if (!selectedText) {
          return;
        }
        const range = selection.getRangeAt(0);

        let parent = range.commonAncestorContainer;

        if (parent.nodeType === Node.TEXT_NODE) {
          parent = parent.parentNode;
        }

        const newRange = document.createRange();
        newRange.selectNodeContents(parent); // 选择目标元素的内容

        selection.removeAllRanges();
        selection.addRange(newRange);
        // isShow = false;
      }}
    >
      <span i-carbon-select-window></span>
    </button>
    <button
      aria-label="copy"
      onclick={async () => {
        try {
          const selection = window.getSelection();
          const selectedText = selection.toString();

          if (!selectedText) {
            return;
          }
          const range = selection.getRangeAt(0);

          let parent = range.commonAncestorContainer;

          if (parent.nodeType === Node.TEXT_NODE) {
            parent = parent.parentNode;
          }

          const pp = parent.getAttribute("data-pp");

          const content = `${selectedText}   ${pp}˼ \n\n —— ${page.data.book.name} ${page.data.titleZh} `;
          console.log({ content });
          await navigator.clipboard.writeText(content);
          info("已复制到剪贴板!");
          selection.removeAllRanges();
        } catch (err) {
          console.error("复制失败:", err);
        }
        isShow = false;
      }}
    >
      <span i-carbon-copy></span>
    </button>
    <button
      aria-label="edit"
      onclick={() => {
        isShow = false;
        const selection = window.getSelection();
        const selectedText = selection.toString();

        if (!selectedText) {
          return;
        }
        const range = selection.getRangeAt(0);
        const span = document.createElement("span");
        span.className = "bg-red";
        range.surroundContents(span);

        saveHighlight(selectedText, range);

        selection.removeAllRanges();
      }}
    >
      <span i-carbon-edit></span>
    </button>
    <button
      aria-label="close"
      onclick={() => {
        isShow = false;
      }}
    >
      <span i-carbon-close></span>
    </button>
  </div>
{/if}
