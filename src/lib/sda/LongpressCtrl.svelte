<script>
  import { page } from "$app/state";
  import { info } from "$lib/global/Toast";
  import { slide } from "svelte/transition";

  let { isShowLongpressCtrl = $bindable(false) } = $props();
  let type = $state("");

  $effect(() => {
    if (isShowLongpressCtrl) {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const parent = range.commonAncestorContainer;
      // console.log(parent.nodeName, parent.nodeType, Node.TEXT_NODE);
      if (parent.nodeType === Node.TEXT_NODE) {
        type = "";
        return;
      }
      const dataType = parent.getAttribute("data-type");
      // console.log("set type", dataType);
      type = dataType;
    }
  });

  function selectionEdit(event) {
    event.stopPropagation();

    const dataType = event.target.getAttribute("data-type");
    const bg = event.target.getAttribute("bg");
    const text = event.target.getAttribute("text");
    const underline = event.target.getAttribute("underline");
    const decoration = event.target.getAttribute("decoration");
    console.log({ dataType, bg, text, underline, decoration });
    type = dataType;

    let className;
    if (underline) {
      const underlineAtribite = underline.replace("~ ", "").split(" ");
      const decorationAtribite = decoration.split(" ");

      className = "underline ";
      for (let i of underlineAtribite) {
        className += `underline-${i} `;
      }

      for (let i of decorationAtribite) {
        className += `decoration-${i} `;
      }

      console.log({ underlineAtribite, decorationAtribite });
    }

    if (bg) {
      className = `bg-${bg}`;
    }

    if (text) {
      className = `text-${text}`;
    }

    console.log({ className });

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const parent = range.commonAncestorContainer;
    console.log(parent.nodeName, parent.nodeType, Node.TEXT_NODE);

    if (parent.nodeType !== Node.TEXT_NODE) {
      console.log("has style", parent.nodeName, parent.className);

      if (parent.className !== className) {
        parent.className = className;
        parent.setAttribute("data-type", dataType);
        return;
      }
      console.log(".... remove");
      const target = parent.parentNode;
      while (parent.firstChild) {
        target.insertBefore(parent.firstChild, parent);
      }
      target.removeChild(parent);
      target.normalize();

      return;
    }

    console.log("set new ...");

    const span = document.createElement("span");
    span.className = className;
    span.setAttribute("data-type", dataType);

    span.addEventListener("click", (e) => {
      e.stopPropagation();

      // const target = e.currentTarget;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(e.target);
      selection.removeAllRanges();
      selection.addRange(range);
    });

    // removeEdit(span)
    range.surroundContents(span);

    saveHighlight(selection.toString(), range);

    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(newRange);
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
</script>

{#if isShowLongpressCtrl}
  <section
    transition:slide
    absolute
    z-9
    bottom-14
    right-2
    text-7
    grid="~ cols-1"
    bg="gray-200"
    divide="y-2 gray-100"
    rounded-4
    overflow-hidden
  >
    <button
      data-type="underline-wavy"
      aria-label="select-edit"
      flex-cc
      w-10
      h={type === "underline-wavy" ? 24 : 14}
      underline="~ offset-4"
      decoration="2 wavy red-500"
      onclick={selectionEdit}
    >
      A
    </button>

    <button
      data-type="underline"
      aria-label="select-edit"
      flex-cc
      w-10
      h={type === "underline" ? 24 : 14}
      underline="~ offset-4"
      decoration="2 red-500"
      class:text-green={false}
      onclick={selectionEdit}
    >
      A
    </button>

    <button
      data-type="bg"
      aria-label="select-edit"
      flex-cc
      w-10
      h={type === "bg" ? 24 : 14}
      bg="red"
      class:text-green={false}
      onclick={selectionEdit}
    >
      A
    </button>

    <button
      data-type="text"
      aria-label="select-edit"
      flex-cc
      w-10
      h={type === "text" ? 24 : 14}
      text="red"
      class:text-green={false}
      onclick={selectionEdit}
    >
      A
    </button>
  </section>

  <section
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
      flex-1
      h-full
      onclick={(event) => {
        const selection = window.getSelection();
        const selectedText = selection.toString();
        console.log({ selectedText });

        if (!selectedText) {
          return;
        }

        const range = selection.getRangeAt(0);
        let parent = range.commonAncestorContainer;

        if (parent.nodeType === Node.TEXT_NODE) {
          parent = parent.parentNode;
        }

        const newRange = document.createRange();
        newRange.selectNodeContents(parent);

        selection.removeAllRanges();
        selection.addRange(newRange);
      }}
    >
      <span i-carbon-select-window></span>
    </button>

    <button
      aria-label="copy"
      flex-1
      h-full
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
      flex-1
      h-full
      onclick={() => {
        // isShowLongpressCtrl = false;
        console.log("show color select");
      }}
    >
      <span i-carbon-tag-edit></span>
    </button>

    <button
      aria-label="close"
      flex-1
      h-full
      text-red
      onclick={(event) => {
        event.stopPropagation();
        isShowLongpressCtrl = false;
        const selection = window.getSelection();
        selection.removeAllRanges();
      }}
    >
      <span i-carbon-close></span>
    </button>
  </section>
{/if}
