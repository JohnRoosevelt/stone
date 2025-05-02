<script>
  import { page } from "$app/state";
  import { info } from "$lib/global/Toast";
  import { slide } from "svelte/transition";

  let { isShowLongpressCtrl = $bindable(false), color = "red" } = $props();
  let type = $state("");

  $effect(() => {
    if (isShowLongpressCtrl) {
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      const parent = range.commonAncestorContainer;
      // console.log(parent.nodeName, parent.nodeType, parent.parentNode);
      if (parent.nodeType === Node.TEXT_NODE) {
        type = "";
        return;
      }
    }
  });

  function selectionEdit(event) {
    event.stopPropagation();

    const dataType = event.target.getAttribute("data-type");
    type = dataType;

    let cssText;
    if (dataType === "underline-wavy") {
      cssText = `text-decoration-line: underline;
        text-underline-offset: 4px;
        text-decoration-thickness: 2px;
        text-decoration-style: wavy;
        text-decoration-color: ${color};`;
    }

    if (dataType === "underline") {
      cssText = `text-decoration-line: underline;
        text-underline-offset: 4px;
        text-decoration-thickness: 2px;
        text-decoration-color: ${color};`;
    }

    if (dataType === "bg") {
      cssText = `background-color: ${color};`;
    }

    if (dataType === "text") {
      cssText = `color: ${color};`;
    }

    console.log({ cssText });

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const parent = range.commonAncestorContainer;
    console.log(parent.nodeName, parent.nodeType, Node.TEXT_NODE);

    if (parent.nodeName === "ARTICLE") {
      info("只能在一段内处理标记");
      selection.removeAllRanges();
      return;
    }

    if (parent.nodeType !== Node.TEXT_NODE) {
      const dataType = parent.getAttribute("data-type");

      // console.log("has style", parent, parent.nodeName, dataType, type);

      if (dataType !== type) {
        console.log(".... change", dataType, "to ", type);
        parent.setAttribute("data-type", type);
        parent.style.cssText = cssText;

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
    span.style.cssText = cssText;
    span.setAttribute("data-type", dataType);

    span.addEventListener("click", (e) => {
      e.stopPropagation();

      // const target = e.currentTarget;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(e.target);
      selection.removeAllRanges();
      selection.addRange(range);

      const dataType = e.target.getAttribute("data-type");
      // console.log("set type", dataType);
      type = dataType;
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
    style="--color: {color}"
  >
    <button
      data-type="underline-wavy"
      aria-label="select-edit"
      flex-cc
      w-10
      h={type === "underline-wavy" ? 24 : 14}
      class="underline underline-offset-4 decoration-2 decoration-wavy"
      style="text-decoration-color: var(--color);"
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
      class="underline underline-offset-4 decoration-2"
      style="text-decoration-color: var(--color);"
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
      style="background-color: var(--color);"
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
      style="color: var(--color);"
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
    px-0
    text="7 green"
    transition:slide
    bg="gray-100 dark:gray-900"
    style="--color: {color}"
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
      <span i-carbon-circle-filled style="background-color: var(--color);"
      ></span>
    </button>
  </section>
{/if}

<style>
  /* article {
    text-decoration-line: underline;
    text-underline-offset: 4px;
    text-decoration-thickness: 2px;
    text-decoration-style: wavy;
    text-decoration-color: var(--color);
  } */
</style>
