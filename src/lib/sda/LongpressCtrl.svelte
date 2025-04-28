<script>
  import { page } from "$app/state";
  import { info } from "$lib/global/Toast";
  import { slide } from "svelte/transition";

  let {
    isShowLongpressCtrl = $bindable(false),
    isShowEdit = $bindable(false),
  } = $props();

  function selectionEdit(event) {
    const bg = event.target.getAttribute("bg");
    const text = event.target.getAttribute("text");
    const underline = event.target.getAttribute("underline");
    const decoration = event.target.getAttribute("decoration");
    console.log({ bg, text, underline, decoration });

    const selection = window.getSelection();
    const selectedText = selection.toString();

    if (!selectedText) {
      return;
    }

    const range = selection.getRangeAt(0);
    const span = document.createElement("span");

    if (underline) {
      const underlineAtribite = underline.replace("~ ", "").split(" ");
      const decorationAtribite = decoration.split(" ");

      span.className = "underline ";
      for (let i of underlineAtribite) {
        span.className += `underline-${i} `;
      }

      for (let i of decorationAtribite) {
        span.className += `decoration-${i} `;
      }

      console.log({ underlineAtribite, decorationAtribite }, span.className);
    }

    if (bg) {
      span.className = `bg-${bg}`;
    }

    if (text) {
      span.className = `text-${text}`;
    }

    span.addEventListener("click", (e) => {
      // const target = e.currentTarget;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(e.target.parentNode);
      selection.removeAllRanges();
      selection.addRange(range);

      const selectedText = selection.toString();
      console.log("xxx", { selectedText }, e.target.parentNode);
      info(selectedText);
      isShowEdit = true;
    });
    range.surroundContents(span);

    saveHighlight(selectedText, range);

    selection.removeAllRanges();
    isShowEdit = false;

    //     event.stopPropagation();
  }

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

  function removeEdit(event) {
    // event.stopPropagation();

    const span = event.target;
    const text = span.textContent;
    const range = document.createRange();
    range.selectNodeContents(span);

    // 计算高亮的 startOffset
    // const preRange = document.createRange();
    // preRange.setStart(paragraph.firstChild, 0);
    // preRange.setEnd(range.startContainer, range.startOffset);
    // const startOffset = preRange.toString().length;

    // 从 localStorage 中移除对应的标记
    // let highlights = JSON.parse(localStorage.getItem("highlights") || "[]");
    // highlights = highlights.filter(
    //   (highlight) =>
    //     !(
    //       highlight.text === text &&
    //       highlight.startOffset === startOffset &&
    //       highlight.length === text.length
    //     ),
    // );
    // localStorage.setItem("highlights", JSON.stringify(highlights));

    // 从 DOM 中移除高亮，恢复原始文本
    const parent = span.parentNode;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
    parent.normalize(); // 合并相邻的文本节点
  }
</script>

<!-- <svelte:document
  onselectionchange={() => {
    const selection = document.getSelection().toString();
    console.log({selection});
    if (!selection) {
      isShowEdit = false
    }
  }}
/> -->

{#if isShowLongpressCtrl}
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
        // isShowLongpressCtrl = false;
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
        isShowLongpressCtrl = false;
      }}
    >
      <span i-carbon-copy></span>
    </button>
    <button
      aria-label="edit"
      onclick={() => {
        isShowLongpressCtrl = false;
        isShowEdit = true;
      }}
    >
      <span i-carbon-tag-edit></span>
    </button>
    <button
      aria-label="close"
      text-red
      onclick={() => {
        isShowLongpressCtrl = false;
        const selection = window.getSelection();
        selection.removeAllRanges();
      }}
    >
      <span i-carbon-close></span>
    </button>
  </div>
{/if}

{#if isShowEdit}
  <div
    absolute
    z-9
    bottom-0
    left-0
    w-full
    h-12
    flex-bc
    px-8
    text="7"
    transition:slide
    bg="gray-100 dark:gray-900"
  >
    <button
      aria-label="edit"
      underline="~ offset-4"
      decoration="2 wavy red-500"
      onclick={selectionEdit}
    >
      A
    </button>

    <button
      aria-label="edit"
      underline="~ offset-4"
      decoration="2 red-500"
      onclick={selectionEdit}
    >
      A
    </button>

    <button aria-label="edit" text="red" onclick={selectionEdit}> A </button>

    <button bg="red" px="2" aria-label="edit" onclick={selectionEdit}>
      A
    </button>

    <button aria-label="close" text-red onclick={removeEdit}>
      <span i-carbon-edit-off></span>
    </button>
  </div>
{/if}
