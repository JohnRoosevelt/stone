<script>
  import { page } from "$app/state";
  import { CID } from "$lib/config";
  import { info } from "$lib/global/Toast";
  import { slide } from "svelte/transition";
  import {
    saveAnnotation,
    replaceAnnotation,
    deleteAnnotation,
    isTauri as isTauriEnv,
  } from "$lib/tauri";

  let { isShowLongpressCtrl = $bindable(false) } = $props();
  let colors2 = $state({
    OrangeRed: false, // 	Orange Red
    Tomato: false, // 	Tomato
    Magenta: false, // Magenta

    Lime: false, // 	Lime
    LawnGreen: false, // 		Lawn Green
    MediumSpringGreen: false, // 	Medium Spring Green

    MediumBlue: false, // Medium Blue
    RoyalBlue: false, // Royal Blue
    MediumSlateBlue: false, // Medium Slate Blue
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

    // Walk from a node up the ancestor chain looking for a `data-type` attribute
    // (e.g. a previously-saved underline / wavy / bg / text span). Used to keep
    // the toolbar's "selected type" in sync with what the user is currently
    // touching — both for newly-created spans and for spans reloaded from DB
    // by Article.svelte.
    function findDataType(node) {
      let el = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentNode;
      while (el && el !== document.body) {
        const dt = el.getAttribute?.("data-type");
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

    // Run once immediately (in case LongpressCtrl opens on top of an existing
    // selection that already has a data-type), then keep in sync while open.
    syncTypeFromSelection();
    document.addEventListener("selectionchange", syncTypeFromSelection);
    return () =>
      document.removeEventListener("selectionchange", syncTypeFromSelection);
  });

  async function selectionEdit(event) {
    event.stopPropagation();

    const dataType = event.target.getAttribute("data-type");
    type = dataType;

    let cssText;
    if (dataType === "underline_wavy") {
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
        // Switch the type of an existing annotation. Just rewrite the DOM
        // span's data-type + cssText; the DB side is handled by
        // `replaceAnnotation` (used inside saveHighlight) which atomically
        // deletes any prior row at the same (p_index, start_offset, length)
        // and inserts the new one. So no manual delete here.
        parent.setAttribute("data-type", type);
        parent.style.cssText = cssText;

        await saveHighlight(selection.toString(), range, parent);
        return;
      }
      console.log(".... remove");
      const target = parent.parentNode;
      while (parent.firstChild) {
        target.insertBefore(parent.firstChild, parent);
      }
      target.removeChild(parent);
      target.normalize();

      // Also delete the DB row for the removed span, if it had one.
      const removedAnnId = parent.getAttribute("data-ann-id");
      if (isTauriEnv() && removedAnnId && !removedAnnId.startsWith("local-")) {
        deleteAnnotation(Number(removedAnnId)).catch((e) => {
          console.warn("[annotation] failed to delete removed ann", e);
        });
      }

      return;
    }

    console.log("set new ...");

    // Capture the selected text BEFORE surroundContents. On Android WebView,
    // clicking the toolbar button can fire `selectionchange` and clear the
    // selection between the click and the `selection.toString()` read below,
    // so the value we'd otherwise persist is an empty string.
    const selectedText = selection.toString();
    if (!selectedText) {
      console.warn("[annotation] empty selection, skipping save");
      return;
    }

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

    await saveHighlight(selectedText, range, span);

    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }

  async function saveHighlight(text, range, targetSpan) {
    // Only persist annotations in Tauri mode
    if (!isTauriEnv()) return;

    // Walk up from the selection to find the paragraph element (`<p data-i="...">`).
    // The common ancestor may be a previously-saved <span> inside a paragraph
    // (e.g. selecting text inside an existing wavy underline), so reading
    // `data-i` off the immediate parent returns null and the annotation is
    // persisted with a null p_index → it can never be re-applied when the
    // chapter reloads.
    let node = range.commonAncestorContainer;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    const pEl = node.closest?.("[data-i]");
    const pIndex = pEl ? pEl.getAttribute("data-i") : null;

    if (!pIndex) {
      console.warn("[annotation] could not locate paragraph for save", { node });
      info("保存失败：找不到段落");
      return;
    }

    // Offset from the start of the paragraph (not from the firstChild, which
    // may itself be a SPAN if there are existing annotations).
    const preRange = document.createRange();
    preRange.setStart(pEl, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;

    console.log({ pIndex, startOffset, length: text.length });

    try {
      // Use replaceAnnotation instead of saveAnnotation so that an
      // existing row at the same (p_index, start_offset, length) is
      // atomically replaced. This way the toolbar never produces
      // duplicate rows, even if the user picks the exact same span twice
      // (which can happen when the selection parent is a freshly-split
      // text node, not the span itself).
      const id = await replaceAnnotation({
        cid: Number(page.params.cid),
        book_id: Number(page.params.bookId),
        chapter_id: Number(page.params.chapterId),
        lang_code: "zh",
        p_index: Number(pIndex),
        start_offset: startOffset,
        length: text.length,
        text: text,
        ann_type: type,
        color: color,
      });
      // Stamp the new DB id back onto the span so the next time the user
      // changes / removes this annotation we know which row to delete.
      if (targetSpan) {
        targetSpan.setAttribute("data-ann-id", String(id));
      }
      console.log("Annotation saved to DB, id:", id);
      info("标记已保存");
    } catch (err) {
      console.error("Failed to save annotation:", err);
      info("保存失败");
    }
  }
</script>

{#if isShowLongpressCtrl}
  <!-- center -->
  {#if isShowColor}
    <section
      transition:slide
      class="absolute z-9 grid grid-cols-3 gap-px bg-gray-200 divide-1 divide-gray-100 rounded-4 overflow-hidden dark:bg-gray-800"
    >
      {#each colors as { name }}
        <input
          class="cursor-pointer w-24 h-24 relative"
          style:background={name}
          type="radio"
          name="colors"
          value={name}
          bind:group={color}
        />
      {/each}
    </section>
  {/if}

  <!-- right -->
  <section
    transition:slide
    class="absolute z-9 bottom-14 right-2 text-7 grid grid-cols-1 bg-gray-200 divide-y-2 divide-gray-100 rounded-4 overflow-hidden dark:bg-gray-800"
    style="--color: {color}"
  >
    <button
      data-type="underline_wavy"
      aria-label="select-edit"
      class={[
        "underline underline-offset-4 decoration-2 decoration-wavy w-10 flex-cc",
        type === "underline_wavy" ? "h-24" : "h-12",
      ]}
      style="text-decoration-color: var(--color);"
      onclick={selectionEdit}
    >
      A
    </button>

    <button
      data-type="underline"
      aria-label="select-edit"
      class={[
        "underline underline-offset-4 decoration-2 w-10 flex-cc",
        type === "underline" ? "h-24" : "h-12",
      ]}
      style="text-decoration-color: var(--color);"
      onclick={selectionEdit}
    >
      A
    </button>

    <button
      data-type="bg"
      aria-label="select-edit"
      class={["bg w-10 flex-cc", type === "bg" ? "h-24" : "h-12"]}
      style="background-color: var(--color);"
      onclick={selectionEdit}
    >
      A
    </button>

    <button
      data-type="text"
      aria-label="select-edit"
      class={["text w-10 flex-cc", type === "text" ? "h-24" : "h-12"]}
      style="color: var(--color);"
      onclick={selectionEdit}
    >
      A
    </button>
  </section>

  <!-- bottom -->
  <section
    class="
    absolute
    z-9
    bottom-0
    left-0
    w-full
    h-12
    flex-bc
    px-0
    text-7 text-green
    bg-gray-100 dark:bg-gray-900"
    transition:slide
    style="--color: {color}"
  >
    <button
      aria-label="select"
      class="flex-1 h-full"
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
      <span class="i-carbon-select-window"></span>
    </button>

    <button
      aria-label="copy"
      class="flex-1 h-full"
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
      <span class="i-carbon-copy"></span>
    </button>

    <button
      aria-label="edit"
      class="flex-1 h-full"
      onclick={() => {
        isShowColor = !isShowColor;
        console.log("show color select");
      }}
    >
      <span
        class="i-carbon-circle-filled"
        style="background-color: var(--color);"
      ></span>
    </button>
  </section>
{/if}

<style>
  input[type="radio"] {
    -webkit-appearance: none; /* Override browser default style */
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
