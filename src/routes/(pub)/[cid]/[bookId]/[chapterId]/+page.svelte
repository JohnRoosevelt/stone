<script>
  import LongpressCtrl from "$lib/sda/LongpressCtrl.svelte";
  import ArticleCtrl from "$lib/sda/ArticleCtrl.svelte";
  import Article from "./Article.svelte";
  import { page } from "$app/state";
  import { beforeNavigate } from "$app/navigation";
  import { DATAS } from "$lib/data.svelte.js";
  import { saveReadingProgress } from "$lib/tauri";
  import { onMount } from "svelte";

  let clientHeight = $state(0);
  let isShowCtrl = $state(false);
  let isShowLongpressCtrl = $state(false);
  let scrollPercentage = $state(0);
  let articleEl = $state(null);
  let lastSavedPct = $state(-1);

  // ── Reading progress persistence ──
  // Strategy: debounced save on scroll (real-time) + immediate save on leave (no data loss)

  async function doSaveProgress(pct) {
    if (!DATAS.isTauri) return;
    if (pct === lastSavedPct) return; // skip if unchanged
    try {
      await saveReadingProgress({
        cid: Number(page.params.cid),
        book_id: Number(page.params.bookId),
        lang_code: "zh",
        chapter_id: Number(page.params.chapterId),
        scroll_percentage: pct,
      });
      lastSavedPct = pct;
    } catch (err) {
      console.error("Failed to save reading progress:", err);
    }
  }

  let saveTimer = null;
  function debouncedSaveProgress(pct) {
    if (!DATAS.isTauri) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => doSaveProgress(pct), 500);
  }

  /** Flush pending save before navigating away (more reliable than onDestroy) */
  beforeNavigate(() => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    // Save immediately before navigation (Tauri invoke is fast enough)
    if (DATAS.isTauri && scrollPercentage !== lastSavedPct) {
      const cid = Number(page.params.cid);
      const bookId = Number(page.params.bookId);
      const chapterId = Number(page.params.chapterId);
      const pct = scrollPercentage;
      saveReadingProgress({
        cid,
        book_id: bookId,
        lang_code: "zh",
        chapter_id: chapterId,
        scroll_percentage: pct,
      }).catch(() => {});
    }
  });

  // ── Scroll position restoration ──
  onMount(() => {
    const fromDir = sessionStorage.getItem(
      "restoreScroll_" + page.params.bookId,
    );
    if (fromDir) {
      sessionStorage.removeItem("restoreScroll_" + page.params.bookId);
      const savedPct = parseInt(fromDir, 10);
      if (savedPct > 0 && articleEl) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const scrollTarget =
              (savedPct / 100) *
              (articleEl.scrollHeight - articleEl.clientHeight);
            articleEl.scrollTo({ top: scrollTarget, behavior: "auto" });
            // Immediately persist the restored position as progress
            scrollPercentage = savedPct;
            doSaveProgress(savedPct);
          });
        });
      }
    }
  });
</script>

<svelte:head>
  <title>{page.data.book?.name} {page.data.title}</title>
</svelte:head>

<svelte:document
  onselectionchange={() => {
    const selection = document.getSelection().toString();
    isShowLongpressCtrl = Boolean(selection);
    if (isShowLongpressCtrl) {
      isShowCtrl = false;
    }
  }}
/>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
  flex-1
  h-full
  flex-cc
  relative
  bind:clientHeight
  onclick={() => {
    if (isShowLongpressCtrl) return;
    isShowCtrl = !isShowCtrl;
  }}
>
  <article
    bind:this={articleEl}
    style:height="{clientHeight}px"
    w-full
    relative
    scroll-y
    class="pb-50vh"
    onscroll={(e) => {
      isShowCtrl = false;
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const pct =
        scrollHeight - clientHeight === 0
          ? 0
          : Math.round((scrollTop / (scrollHeight - clientHeight)) * 100);
      scrollPercentage = pct;

      // Save reading progress to DB (only in Tauri mode)
      if (DATAS.isTauri) {
        debouncedSaveProgress(pct);
      }
    }}
  >
    <div h-1px id="article-top"></div>
    {#key page.params.chapterId}
      <Article />
    {/key}
    <div h-1px id="article-bottom"></div>
  </article>

  <ArticleCtrl bind:isShowCtrl {scrollPercentage} />
  <LongpressCtrl bind:isShowLongpressCtrl />
</section>
