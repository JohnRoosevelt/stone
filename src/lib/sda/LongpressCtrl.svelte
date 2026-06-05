<script>
  import { page } from "$app/state";
  import { CID } from "$lib/config";
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
    if (!isShowLongpressCtrl) return;

    // Keep the toolbar's selected style in sync with whatever segment the
    // user's selection currently overlaps. Each segment <span> has
    // `data-style` set, so we just walk up from the selection endpoints.
    function findDataType(node) {
      let el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentNode;
      while (el && el !== document.body) {
        const dt = el.getAttribute?.("data-style");
        if (dt) return dt;
        el = el.parentElement;
      }
      return null;
    }

    function syncTypeFromSelection() {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      if (sel.toString().length === 0) return;
      const range = sel.getRangeAt(0);
      const dt =
        findDataType(range.startContainer) ?? findDataType(range.endContainer);
      if (dt) type = dt;
    }

    syncTypeFromSelection();
    // rAF-throttle selectionchange — `findDataType` walks the DOM ancestor
    // chain, which is unnecessary work for every selection tick during a
    // long drag-select on mobile.
    let raf = 0;
    function throttledSync() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        syncTypeFromSelection();
      });
    }
    document.addEventListener("selectionchange", throttledSync);
    return () => {
      document.removeEventListener("selectionchange", throttledSync);
      if (raf) cancelAnimationFrame(raf);
    };
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
    } else if (dataType === "underline") {
      cssText = `text-decoration-line: underline;
        text-underline-offset: 4px;
        text-decoration-thickness: 2px;
        text-decoration-color: ${color};`;
    } else if (dataType === "bg") {
      cssText = `background-color: ${color};`;
    } else if (dataType === "text") {
      cssText = `color: ${color};`;
    }
    if (!cssText) return;

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) return; // empty selection — nothing to annotate

    const startNode =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentNode
        : range.startContainer;
    const pEl = startNode?.closest?.("[data-i]");
    if (!pEl) {
      info("只能在一段内处理标记");
      selection.removeAllRanges();
      return;
    }

    // Web 划线 **不存**任何地方 — 纯 DOM 操作, 刷新即丢
    // (与 Tauri/Android 端持久化到本地 SQLite 不同; 按 user 设计原则)
    // 这一段 = 一整段加 css (不能用 span 拆 — 简单可靠)
    if (pEl.getAttribute("data-type") === dataType) {
      // 同一段同一 style 再次点击 → 清除划线
      pEl.removeAttribute("data-type");
      pEl.style.cssText = "";
      info("已清除（本页面刷新后丢失）");
    } else {
      pEl.setAttribute("data-type", dataType);
      pEl.style.cssText = cssText;
      info("已划线（本页面刷新后丢失）");
    }
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

          let pp = parent.getAttribute("data-pp");
          console.log(pp, parent.nodeType, parent.nodeName);

          if (parent.nodeName === "SPAN") {
            pp = parent.parentNode.getAttribute("data-pp");
          }
          console.log(pp, parent);

          let bookName, chapterName, content;
          switch (page.params.cid) {
            case CID.BIBLE:
              bookName = page.data.book.name;
              chapterName = page.data.title;
              content = `${bookName} ${chapterName}:${pp}˼ ${selectedText}`;
              break;

            case CID.SDA:
            case CID.BOOKS:
              bookName = page.data.book.name;
              chapterName = page.data.title;
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
