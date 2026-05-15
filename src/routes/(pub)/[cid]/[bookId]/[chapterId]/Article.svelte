<script>
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { CID } from "$lib/config";
  import { DATAS } from "$lib/data.svelte.js";
  import { searchState } from "$lib/bible/searchStore.svelte.js";
  import { getAnnotations } from "$lib/tauri";

  /** Load and apply saved annotations for the current chapter */
  async function loadAnnotations() {
    if (!DATAS.isTauri) return;
    try {
      const annotations = await getAnnotations(
        Number(page.params.cid),
        Number(page.params.bookId),
        Number(page.params.chapterId),
        "zh",
      );
      if (!annotations || annotations.length === 0) return;

      // Group annotations by paragraph index
      const byParagraph = {};
      for (const ann of annotations) {
        if (!byParagraph[ann.p_index]) byParagraph[ann.p_index] = [];
        byParagraph[ann.p_index].push(ann);
      }

      for (const [pIdx, anns] of Object.entries(byParagraph)) {
        const pEl = document.querySelector(`[data-i="${pIdx}"]`);
        if (!pEl) continue;

        // Sort annotations by start_offset descending so we don't mess up offsets
        anns.sort((a, b) => b.start_offset - a.start_offset);

        for (const ann of anns) {
          // Find the text node range for this annotation
          const textNode = pEl.firstChild;
          if (!textNode || textNode.nodeType !== Node.TEXT_NODE) continue;

          const range = document.createRange();
          range.setStart(textNode, ann.start_offset);
          range.setEnd(textNode, ann.start_offset + ann.length);

          // Build CSS based on annotation type
          let cssText = "";
          switch (ann.ann_type) {
            case "underline-wavy":
              cssText = `text-decoration-line: underline; text-underline-offset: 4px; text-decoration-thickness: 2px; text-decoration-style: wavy; text-decoration-color: ${ann.color};`;
              break;
            case "underline":
              cssText = `text-decoration-line: underline; text-underline-offset: 4px; text-decoration-thickness: 2px; text-decoration-color: ${ann.color};`;
              break;
            case "bg":
              cssText = `background-color: ${ann.color};`;
              break;
            case "text":
              cssText = `color: ${ann.color};`;
              break;
          }

          const span = document.createElement("span");
          span.style.cssText = cssText;
          span.setAttribute("data-type", ann.ann_type);
          span.setAttribute("data-ann-id", ann.id);

          // Add click handler for re-selecting
          span.addEventListener("click", (e) => {
            e.stopPropagation();
            const selection = window.getSelection();
            const selRange = document.createRange();
            selRange.selectNodeContents(e.target);
            selection.removeAllRanges();
            selection.addRange(selRange);

            // Trigger LongpressCtrl by setting type
            const dt = e.target.getAttribute("data-type");
            document.querySelector("[data-type='" + dt + "']");
          });

          try {
            range.surroundContents(span);
          } catch (e) {
            console.warn("Could not surround annotation contents:", e);
          }
        }
      }
      console.log(`Loaded ${annotations.length} annotations`);
    } catch (err) {
      console.error("Failed to load annotations:", err);
    }
  }

  onMount(() => {
    // Load saved annotations
    loadAnnotations();

    const hash = page.url.hash || window.location.hash;
    if (!hash.startsWith("#zh-")) return;
    const id = hash.slice(1);

    // Wait two frames to ensure SvelteKit hash navigation and rendering are complete
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (!el) return;

        // Find scrollable parent container, manually scroll to center
        const scrollParent =
          el.closest("[scroll-y]") || el.closest(".scroll-y");
        if (scrollParent) {
          const elRect = el.getBoundingClientRect();
          const parentRect = scrollParent.getBoundingClientRect();
          const offset =
            elRect.top -
            parentRect.top -
            parentRect.height / 2 +
            elRect.height / 2;
          scrollParent.scrollBy({ top: offset, behavior: "smooth" });
        } else {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }

        // Full paragraph highlight animation
        el.classList.add("search-highlight");
        setTimeout(() => el.classList.remove("search-highlight"), 3000);

        // Add red dashed border to keywords (persistent, supports multiple words)
        const keyword = searchState.query?.trim();
        if (!keyword) return;

        const words = keyword.split(/\s+/).filter(Boolean);
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const nodesToReplace = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          const hasMatch = words.some((w) =>
            new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi").test(
              node.textContent,
            ),
          );
          if (hasMatch) nodesToReplace.push(node);
        }
        for (const node of nodesToReplace) {
          const text = node.textContent;
          const sorted = [...words].sort((a, b) => b.length - a.length);
          const ranges = [];
          for (const w of sorted) {
            const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(escaped, "gi");
            let m;
            while ((m = re.exec(text)) !== null) {
              ranges.push({ start: m.index, end: m.index + m[0].length });
            }
          }
          ranges.sort((a, b) => a.start - b.start);
          const unique = ranges.filter(
            (r, i) => i === 0 || r.start !== ranges[i - 1].start,
          );
          let html = text;
          for (let i = unique.length - 1; i >= 0; i--) {
            const { start, end } = unique[i];
            html =
              html.slice(0, start) +
              '<mark class="keyword-mark">' +
              html.slice(start, end) +
              "</mark>" +
              html.slice(end);
          }
          const span = document.createElement("span");
          span.innerHTML = html;
          node.parentNode.replaceChild(span, node);
        }
      });
    });
  });
</script>

<article
  class="w-full space-y-2 leading-(170%)"
  style:font-size="{DATAS.fontSize}px"
  style:background={!DATAS.isDarkMode ? DATAS.bg : ""}
>
  {#each page.data.sections as sec, i}
    {@const id = i + 1}
    <!-- { t, p, c } (type, paragraph, content) -->
    {@const t = sec.t || 7}
    {@const p = sec.p || id}
    {@const c = sec.c || ""}

    <p
      style:text-indent="calc(var(--spacing) * {(t == 7 && i > 0) ||
      (page.params.cid === CID.BIBLE && i === 0)
        ? parseInt(DATAS.fontSize / 2)
        : 0})"
      style:--before-left={t == 7
        ? `calc(var(--spacing) * -${parseInt(DATAS.fontSize / 2)})`
        : ""}
      id="zh-{id}"
      class={[
        "px-5",
        t == 4 && "bg-white dark:bg-black",
        (t == 7 && i > 0) || (page.params.cid === CID.BIBLE && i === 0)
          ? "before:(content-[attr(data-p)] absolute text-green)"
          : "",
      ]}
      data-lang="zh"
      data-pp={p}
      data-p={(page.params.cid !== CID.BOOKS ? p : p - 1) + "˼"}
      data-i={i}
      class:flex-cc={t == 2 || (i === 0 && page.params.cid !== CID.BIBLE)}
      class:font-700={t == 2 || (i === 0 && page.params.cid !== CID.BIBLE)}
      class:font-500={t == 4}
      class:sticky={t == 4}
      class:top-0={t == 4}
      class:relative={t == 7}
      class:z-2={t == 4}
    >
      {@html c}
    </p>
  {/each}
</article>

<!-- before={(t == 7 && i > 0) || (page.params.cid === CID.BIBLE && i === 0)
  ? `content-[attr(data-p)] absolute text-green`
  : ""} -->

<style>
  p {
    &::before {
      text-indent: var(--before-left);
    }
  }

  /* Full paragraph highlight (green background + red dashed border, fades after 3s pulse) */
  :global(p.search-highlight) {
    animation: highlight-pulse 3s ease-out forwards;
    border-radius: 4px;
  }

  @keyframes highlight-pulse {
    0% {
      background-color: rgba(74, 222, 128, 0.25);
      box-shadow: 0 0 0 2.5px rgba(239, 68, 68, 0.7);
      border-radius: 4px;
    }
    30% {
      background-color: rgba(74, 222, 128, 0.15);
      box-shadow: 0 0 0 2.5px rgba(239, 68, 68, 0.4);
      border-radius: 4px;
    }
    70% {
      background-color: rgba(74, 222, 128, 0.05);
      box-shadow: 0 0 0 2.5px rgba(239, 68, 68, 0.15);
      border-radius: 4px;
    }
    100% {
      background-color: transparent;
      box-shadow: 0 0 0 0 transparent;
      border-radius: 4px;
    }
  }

  /* Keyword red dashed border (persistent, outline doesn't affect layout) */
  :global(mark.keyword-mark) {
    outline: 1.5px dashed rgba(239, 68, 68, 0.7);
    outline-offset: -0.5px;
    border-radius: 2px;
    background: transparent;
  }
</style>
