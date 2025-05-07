<script>
  import { page } from "$app/state";
  import { info } from "$lib/global/Toast";
  import { slide } from "svelte/transition";

  let { isShowLongpressCtrl = $bindable(false) } = $props();
  let colors2 = $state({
    OrangeRed: false, // 	橙红色
    Tomato: false, // 	番茄
    Magenta: false, // 洋红

    Lime: false, // 	酸橙色
    LawnGreen: false, // 		草坪绿
    MediumSpringGreen: false, // 	春绿

    MediumBlue: false, // 适中的蓝色
    RoyalBlue: false, // 皇家蓝
    MediumSlateBlue: false, // 暗蓝灰色
  });

  let colors = $state([
    { name: "OrangeRed", desc: "橙红色" },
    { name: "Tomato", desc: "番茄红" },
    { name: "Magenta", desc: "洋红色" },

    { name: "Lime", desc: "" },
    { name: "LawnGreen", desc: "" },
    { name: "MediumSpringGreen", desc: "" },

    { name: "MediumBlue", desc: "" },
    { name: "RoyalBlue", desc: "" },
    { name: "MediumSlateBlue", desc: "" },
  ]);
  let color = $state(colors[0].name);
  let type = $state("");
  let isShowColor = $state(false);

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
      return;
    }
    // isShowColor = false;
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
  {#if isShowColor}
    <section
      transition:slide
      absolute
      z-9
      grid="~ cols-3"
      gap-px
      bg="gray-200"
      divide="1 gray-100"
      rounded-4
      overflow-hidden
    >
      {#each colors as { name }}
        <input
          cursor-pointer
          w-24
          h-24
          relative
          style:background={name}
          type="radio"
          name="colors"
          value={name}
          bind:group={color}
        />
      {/each}
    </section>
  {/if}

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

          const pp = parent.parentNode.getAttribute("data-pp");
          console.log(pp, page.data);
          

          let bookName, chapterName, content;
          switch (page.params.cid) {
            case "bible":
              bookName = page.data.book.name.ZH;
              chapterName = page.data.titleZh;
              content = `${bookName} ${chapterName}:${pp}˼ ${selectedText}`;
              break;

            case "sda":
              bookName = page.data.book.name;
              chapterName = page.data.titleZh;
              content = `${selectedText}   ${pp}˼ \n\n —— ${bookName} ${chapterName} `;
              break;

            default:
              break;
          }
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
        isShowColor = !isShowColor;
        console.log("show color select");
      }}
    >
      <span i-carbon-circle-filled style="background-color: var(--color);"
      ></span>
    </button>
  </section>
{/if}

<style>
  input[type="radio"] {
    -webkit-appearance: none; /* 覆盖浏览器默认样式 */
    -moz-appearance: none;
    appearance: none;
  }

  input[type="radio"]:checked::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
  }
</style>
