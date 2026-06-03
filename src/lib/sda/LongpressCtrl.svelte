<script>
  import { page } from "$app/state";
  import { CID } from "$lib/config";
  import { info } from "$lib/global/Toast";
  import { slide } from "svelte/transition";
  import {
    saveParagraphAnnotations,
    clearParagraphAnnotations,
    isTauri as isTauriEnv,
  } from "$lib/tauri";
  import {
    buildSegmentCss,
    collectSegmentsFromDom,
    appendSegment,
    removeSegment,
  } from "$lib/sda/annotationUtil";

  let { isShowLongpressCtrl = $bindable(false) } = $props();
  let colors2 = $state({
    OrangeRed: false, // 	Orange Red
    Tomato: false, // 	Tomato
    Magenta: false, // Magenta

    Lime: false, // 	Lime
    LawnGreen: false, // 		Lawn Green
    MediumSpringGreen: false, // 	Medium Spring Green

    MediumBlue: false, // Medium Blue
    RoyalBlue: false, // 	Royal Blue
    MediumSlateBlue: false, // 	Medium Slate Blue
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
    document.addEventListener("selectionchange", syncTypeFromSelection);
    return () =>
      document.removeEventListener("selectionchange", syncTypeFromSelection);
  });

  /**
   * Compute the (start, end) character offsets of `range` within `pEl`'s
   * plain text. Returns null if the range crosses outside the paragraph
   * (which shouldn't happen because we bail on `parent.nodeName === "ARTICLE"`
   * above, but defensive).
   */
  function rangeOffsetsInParagraph(pEl, range) {
    const pre = document.createRange();
    pre.setStart(pEl, 0);
    pre.setEnd(range.startContainer, range.startOffset);
    const start = pre.toString().length;
    const length = range.toString().length;
    return { start, end: start + length, length };
  }

  async function selectionEdit(event) {
    event.stopPropagation();

    const pickedStyle = event.target.getAttribute("data-type");
    type = pickedStyle;

    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const parent = range.commonAncestorContainer;

    if (parent.nodeName === "ARTICLE") {
      info("只能在一段内处理标记");
      selection.removeAllRanges();
      return;
    }

    // Locate the paragraph that owns this selection.
    let node = parent;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
    const pEl = node.closest?.("[data-i]");
    if (!pEl) {
      info("保存失败：找不到段落");
      return;
    }
    const pIndex = pEl.getAttribute("data-i");

    const { start, end } = rangeOffsetsInParagraph(pEl, range);
    if (end <= start) {
      console.warn("[annotation] empty range, skipping save");
      return;
    }

    // Re-collect the paragraph's segments from the DOM (this is the source
    // of truth for what's currently shown). Then either:
    //   (a) toggle a same-(start,end,style) segment off
    //   (b) add a new segment for the picked style
    let segments = collectSegmentsFromDom(pEl);
    console.log(
      `[anno] selection: p=${pIndex} style=${pickedStyle} color=${color} range=[${start},${end}] existing_segments=${JSON.stringify(segments)}`,
    );

    const isToggleOff = segments.some(
      (s) =>
        s.start === start &&
        s.end === end &&
        s.style === pickedStyle &&
        s.color === color,
    );

    if (isToggleOff) {
      // User re-tapped the same style on the same span → remove it.
      segments = removeSegment(segments, {
        start,
        end,
        style: pickedStyle,
        color,
      });
      console.log(
        `[anno] toggle_off: p=${pIndex} range=[${start},${end}] style=${pickedStyle} → segments=${segments.length}`,
      );
    } else {
      // Add a new segment. (If the same range already has a different style,
      // this becomes a second segment on the same range — the renderer will
      // layer it on top of the existing span via a nested or sibling <span>.)
      segments = appendSegment(segments, {
        start,
        end,
        style: pickedStyle,
        color,
      });
      console.log(
        `[anno] toggle_on: p=${pIndex} range=[${start},${end}] style=${pickedStyle} color=${color} → segments=${segments.length}`,
      );
    }

    // Persist the merged segments list.
    await persistSegments(pEl, pIndex, segments, range, pickedStyle);
  }

  /**
   * Update the DOM to reflect the new segments list, then push the full
   * list to the DB. The DOM update is "rebuild this paragraph's spans from
   * scratch" — simpler than mutating in place and the article re-renders
   * fast enough that the flicker is invisible.
   */
  async function persistSegments(pEl, pIndex, segments, sourceRange, pickedStyle) {
    if (!isTauriEnv()) return;

    // 1) Rebuild the DOM: strip all existing annotation spans, then apply
    //    the new segments back-to-front (descending start) so earlier
    //    inserts don't shift the offsets of later ones.
    pEl.querySelectorAll("span[data-start]").forEach((sp) => {
      const parent = sp.parentNode;
      while (sp.firstChild) parent.insertBefore(sp.firstChild, sp);
      parent.removeChild(sp);
      parent.normalize();
    });

    const sorted = [...segments].sort((a, b) => b.start - a.start);
    for (const seg of sorted) {
      const startLoc = locateTextOffset(pEl, seg.start);
      const endLoc = locateTextOffset(pEl, seg.end);
      if (!startLoc || !endLoc) continue;
      const r = document.createRange();
      try {
        r.setStart(startLoc.node, startLoc.offset);
        r.setEnd(endLoc.node, endLoc.offset);
      } catch {
        continue;
      }
      const sp = document.createElement("span");
      sp.style.cssText = buildSegmentCss(seg.style, seg.color);
      sp.setAttribute("data-start", String(seg.start));
      sp.setAttribute("data-end", String(seg.end));
      sp.setAttribute("data-style", seg.style);
      sp.setAttribute("data-color", seg.color);
      sp.addEventListener("click", (e) => {
        e.stopPropagation();
        const sel = window.getSelection();
        sel.removeAllRanges();
        const rr = document.createRange();
        rr.selectNodeContents(e.target);
        sel.addRange(rr);
      });
      try {
        r.surroundContents(sp);
      } catch {
        // Range crosses an element boundary (overlapping with another
        // segment we just inserted). Extract-and-reinsert as a fallback.
        try {
          const frag = r.extractContents();
          sp.appendChild(frag);
          r.insertNode(sp);
        } catch {
          /* give up on this segment */
        }
      }
    }

    // 2) Push the merged list to the DB. Empty list → delete the row.
    try {
      if (segments.length === 0) {
        await clearParagraphAnnotations(
          Number(page.params.cid),
          Number(page.params.bookId),
          Number(page.params.chapterId),
          "zh",
          Number(pIndex),
        );
      } else {
        await saveParagraphAnnotations({
          cid: Number(page.params.cid),
          book_id: Number(page.params.bookId),
          chapter_id: Number(page.params.chapterId),
          lang_code: "zh",
          p_index: Number(pIndex),
          segments,
        });
      }
      info("标记已保存");
    } catch (err) {
      console.error("Failed to save annotations:", err);
      info("保存失败");
    }
  }

  /**
   * Locate the text node (and offset within it) that contains the
   * `targetOffset`-th character of `root`'s concatenated text content.
   * Returns `{ node, offset }` or null if out of range.
   */
  function locateTextOffset(root, targetOffset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = targetOffset;
    let n;
    while ((n = walker.nextNode())) {
      const len = n.textContent.length;
      if (remaining <= len) return { node: n, offset: remaining };
      remaining -= len;
    }
    return null;
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
