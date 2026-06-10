<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { safeGoBack } from "$lib";
  import {
    getAllAnnotations,
    deleteAnnotation,
    clearAnnotations,
  } from "$lib/tauri";
  import { info } from "$lib/global/Toast";

  // ── State ────────────────────────────────────────────────────
  let annotations = $state([]);
  let loading = $state(true);
  let loadError = $state("");
  let busy = $state(false); // global clear in progress
  let deletingIds = $state(new Set()); // individual delete in progress

  // Confirm dialog
  let showConfirm = $state(false);
  let dialogEl = $state(null);

  // Detail dialog
  let detailItem = $state(null); // the chapter item to show
  let detailEl = $state(null);
  let detailDeleting = $state(false);

  // Book detail dialog
  let bookDetailItem = $state(null); // the book object
  let bookDetailEl = $state(null);
  let bookDetailDeleting = $state(false);

  // ── Load ─────────────────────────────────────────────────────
  async function load() {
    loading = true;
    loadError = "";
    try {
      annotations = await getAllAnnotations();
      // Default: expand the book + chapter containing the most recent annotation
      if (annotations.length > 0) {
        const latest = annotations.reduce((a, b) =>
          new Date(a.updated_at) > new Date(b.updated_at) ? a : b,
        );
        expandedBooks = new Set([`${latest.cid}-${latest.book_id}`]);
        expandedChapters = new Set([
          `${latest.cid}-${latest.book_id}-${latest.chapter_id}`,
        ]);
      }
    } catch (e) {
      console.error("[annotations] load failed:", e);
      loadError = "加载失败";
    } finally {
      loading = false;
    }
  }

  onMount(load);

  // ── Helpers ──────────────────────────────────────────────────
  function goBack() {
    safeGoBack("/my");
  }

  // ── Collapse/expand ──────────────────────────────────────────
  let expandedBooks = $state(new Set());
  let expandedChapters = $state(new Set());

  function toggleBook(key) {
    const next = new Set(expandedBooks);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedBooks = next;
  }

  function toggleChapter(key) {
    const next = new Set(expandedChapters);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedChapters = next;
  }

  function goToChapter(cid, book_id, chapter_id) {
    goto(`/${cid}/${book_id}/${chapter_id}`);
  }

  function goToParagraph(cid, book_id, chapter_id, p_index) {
    goto(`/${cid}/${book_id}/${chapter_id}#zh-${p_index}`);
  }

  // Most recent annotation row (for default expansion)
  function mostRecentItem(anns) {
    if (!anns || anns.length === 0) return null;
    return anns.reduce((a, b) =>
      new Date(a.updated_at) > new Date(b.updated_at) ? a : b,
    );
  }

  // Open detail modal
  function openDetail(item) {
    detailItem = item;
    if (detailEl) detailEl.showModal();
  }
  function closeDetail() {
    if (detailEl) detailEl.close();
    detailItem = null;
  }

  // Book detail
  function openBookDetail(book) {
    bookDetailItem = book;
    if (bookDetailEl) bookDetailEl.showModal();
  }
  function closeBookDetail() {
    if (bookDetailEl) bookDetailEl.close();
    bookDetailItem = null;
  }

  // Delete item from detail modal
  async function handleDeleteFromDetail() {
    if (!detailItem || detailDeleting) return;
    detailDeleting = true;
    try {
      await deleteAnnotation(detailItem.id);
      annotations = annotations.filter((a) => a.id !== detailItem.id);
      info("已删除");
      closeDetail();
    } catch (e) {
      console.error("[annotations] delete failed:", e);
      info("删除失败");
    } finally {
      detailDeleting = false;
    }
  }

  // Delete all annotations for a book
  async function handleDeleteBookFromDetail() {
    if (!bookDetailItem || bookDetailDeleting) return;
    bookDetailDeleting = true;
    try {
      const bookKey = `${bookDetailItem.cid}-${bookDetailItem.book_id}`;
      const toDelete = annotations
        .filter((a) => `${a.cid}-${a.book_id}` === bookKey)
        .map((a) => a.id);
      await Promise.all(toDelete.map((id) => deleteAnnotation(id)));
      annotations = annotations.filter(
        (a) => `${a.cid}-${a.book_id}` !== bookKey,
      );
      info(`已删除 ${toDelete.length} 条标记`);
      closeBookDetail();
    } catch (e) {
      console.error("[annotations] delete book failed:", e);
      info("删除失败");
    } finally {
      bookDetailDeleting = false;
    }
  }

  // ── Group: book > chapter > items ────────────────────────────
  let books = $derived.by(() => {
    const map = new Map();
    for (const a of annotations) {
      const bookKey = `${a.cid}-${a.book_id}`;
      if (!map.has(bookKey)) {
        map.set(bookKey, {
          cid: a.cid,
          book_id: a.book_id,
          book_name: a.book_name || "未知书籍",
          chapters: new Map(),
          allAnnotations: [],
        });
      }
      const bg = map.get(bookKey);
      bg.allAnnotations.push(a);

      const chKey = `${a.cid}-${a.book_id}-${a.chapter_id}`;
      if (!bg.chapters.has(chKey)) {
        bg.chapters.set(chKey, {
          chapter_id: a.chapter_id,
          chapter_title: a.chapter_title || `第${a.chapter_id}章`,
          items: [],
          segmentCount: 0,
        });
      }
      const cg = bg.chapters.get(chKey);
      cg.items.push(a);
      cg.segmentCount += a.segments.length;
    }
    // Attach most recent annotation per book
    for (const book of map.values()) {
      book.mostRecentAnnotation = book.allAnnotations.reduce((a, b) =>
        new Date(a.updated_at) > new Date(b.updated_at) ? a : b,
      );
      delete book.allAnnotations;
    }
    return [...map.values()];
  });

  let totalSegments = $derived(
    books.reduce(
      (s, b) =>
        s + [...b.chapters.values()].reduce((t, c) => t + c.segmentCount, 0),
      0,
    ),
  );

  // ── Delete one ──────────────────────────────────────────────
  async function handleDelete(item) {
    if (deletingIds.has(item.id)) return;
    deletingIds = new Set([...deletingIds, item.id]);
    try {
      await deleteAnnotation(item.id);
      annotations = annotations.filter((a) => a.id !== item.id);
      info("已删除");
    } catch (e) {
      console.error("[annotations] delete failed:", e);
      info("删除失败");
    } finally {
      deletingIds.delete(item.id);
      deletingIds = new Set(deletingIds);
    }
  }

  // ── Clear all ───────────────────────────────────────────────
  function openConfirm() {
    if (annotations.length === 0) return;
    showConfirm = true;
    dialogEl?.showModal();
  }

  function closeConfirm() {
    showConfirm = false;
    dialogEl?.close();
  }

  async function confirmClear() {
    if (busy) return;
    closeConfirm();
    busy = true;
    try {
      const n = await clearAnnotations();
      info(`已清空 ${n} 条标记`);
      annotations = [];
      setTimeout(() => goto("/my"), 800);
    } catch (e) {
      console.error("[annotations] clear failed:", e);
      info("清空失败");
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>我的标记 - 脚前的灯</title>
</svelte:head>

<style>
  /* Center all native dialogs on this page */
  dialog {
    margin: auto;
    position: fixed;
    inset: 0;
  }
</style>

<!-- ── Top bar ──────────────────────────────────────────────────── -->
<div
  class="h-12 px-4 flex items-center gap-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
>
  <button
    class="w-8 h-8 flex items-center justify-center text-gray-500"
    aria-label="返回"
    onclick={goBack}
  >
    <span class="i-carbon-arrow-left text-green-500 text-4"></span>
  </button>
  <span class="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200"
    >我的标记</span
  >

  {#if annotations.length > 0}
    <button
      class="text-sm text-red disabled:opacity-50"
      disabled={busy}
      onclick={openConfirm}
      aria-label="清空所有"
    >
      {#if busy}
        <span class="i-line-md-loading-twotone-loop text-4 animate-spin"></span>
      {:else}
        清空所有
      {/if}
    </button>
  {/if}
</div>

<!-- ── Content (scrollable, full width) ─────────────────────── -->
<div class="px-4 py-4">
  {#if loading}
    <div class="flex flex-cc py-12 text-gray-400 text-sm">
      <span class="i-line-md-loading-twotone-loop text-5 animate-spin"></span>
      <span class="ml-2">加载中…</span>
    </div>
  {:else if loadError}
    <div class="flex flex-cc py-12 text-red text-sm">{loadError}</div>
  {:else if annotations.length === 0}
    <div class="flex flex-cc flex-col py-16 text-gray-400">
      <span class="i-carbon-bookmark text-6 mb-3"></span>
      <span class="text-sm">暂无标记</span>
      <span class="text-xs mt-1 opacity-60">阅读时选中文字即可添加标记</span>
    </div>
  {:else}
    <!-- Summary -->
    <div class="text-xs text-gray-400 mb-4">
      共 {annotations.length} 段落，{totalSegments} 处标记
    </div>

    <!-- Books > Chapters > Items -->
    {#each books as book}
      {@const bookKey = `${book.cid}-${book.book_id}`}
      {@const bookExpanded = expandedBooks.has(bookKey)}
      {@const chapterList = [...book.chapters.values()]}
      {@const bookTotal = chapterList.reduce((s, c) => s + c.segmentCount, 0)}

      <!-- Book row -->
      <div class="mb-3">
        <!-- Clickable row: left=navigate to most recent, middle=expand arrow, right=detail -->
        <div
          class="flex items-center rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <!-- Left: navigate to most recent annotation in this book -->
          <button
            class="flex-1 flex items-center gap-2 px-1 py-1 text-left"
            onclick={() => {
              const ann = book.mostRecentAnnotation;
              goToParagraph(ann.cid, ann.book_id, ann.chapter_id, ann.p_index);
            }}
            title="跳转到最新标记"
          >
            <span class="text-gray-300 dark:text-gray-600">
              <span class="i-carbon-location text-4"></span>
            </span>
            <span
              class="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1"
            >
              {book.book_name}
            </span>
            <span class="text-xs text-gray-400 mr-1">
              {bookTotal} 处
            </span>
          </button>

          <!-- Divider -->
          <div class="w-px h-6 bg-gray-100 dark:bg-gray-800 shrink-0"></div>

          <!-- Expand arrow -->
          <button
            class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            onclick={() => toggleBook(bookKey)}
            aria-label={bookExpanded ? "收起" : "展开"}
            aria-expanded={bookExpanded}
          >
            <span
              class={[
                "text-xs transition-transform",
                bookExpanded ? "rotate-90" : "",
              ]}
            >
              <span class="i-carbon-chevron-right text-4"></span>
            </span>
          </button>

          <!-- Detail button -->
          <button
            class="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-green shrink-0"
            onclick={() => openBookDetail(book)}
            title="管理标记"
            aria-label="管理此书的标记"
          >
            <span class="i-carbon-list text-4"></span>
          </button>
        </div>

        <!-- Chapters (shown when book expanded) -->
        {#if bookExpanded}
          <div class="mt-1 pl-4 border-l border-gray-100 dark:border-gray-800">
            {#each chapterList as chapter}
              {@const chKey = `${book.cid}-${book.book_id}-${chapter.chapter_id}`}
              {@const chExpanded = expandedChapters.has(chKey)}

              <!-- Chapter row -->
              <div class="mb-1">
                <div
                  class="w-full flex items-center gap-1.5 text-left px-1 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  onclick={() => toggleChapter(chKey)}
                  role="button"
                  tabindex="0"
                  aria-expanded={chExpanded}
                  onkeydown={(e) => e.key === "Enter" && toggleChapter(chKey)}
                >
                  <span
                    class={[
                      "text-xs text-gray-400 transition-transform",
                      chExpanded ? "rotate-90" : "",
                    ]}
                  >
                    <span class="i-carbon-chevron-right"></span>
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400 flex-1">
                    {chapter.chapter_title}
                  </span>
                  <span class="text-xs text-gray-400 mr-1">
                    {chapter.segmentCount} 处
                  </span>
                  <!-- navigate icon -->
                  <button
                    class="w-8 h-8 flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-green shrink-0 mr-1"
                    title="跳转到此章节"
                    onclick={(e) => {
                      e.stopPropagation();
                      goToChapter(book.cid, book.book_id, chapter.chapter_id);
                    }}
                    aria-label="跳转到章节"
                  >
                    <span class="i-carbon-arrow-right text-4"></span>
                  </button>
                </div>

                <!-- Items (shown when chapter expanded) -->
                {#if chExpanded}
                  <div class="mt-1 pl-4 space-y-1">
                    {#each chapter.items as item}
                      {@const recent = mostRecentItem(item.segments)}
                      <!-- Full row: click → jump to most recent; right slot → detail -->
                      <div
                        class="flex items-center rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden"
                      >
                        <!-- Main clickable area -->
                        <button
                          class="flex-1 flex items-center gap-2 px-3 py-3 text-left text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onclick={() =>
                            goToParagraph(
                              book.cid,
                              book.book_id,
                              chapter.chapter_id,
                              item.p_index,
                            )}
                          title="跳转到此段落"
                        >
                          <span
                            class="text-gray-300 dark:text-gray-600 shrink-0"
                          >
                            <span class="i-carbon-location text-4"></span>
                          </span>
                          <span class="flex-1">
                            <span>第{item.p_index}段</span>
                            <span class="ml-1.5 text-xs text-gray-400"
                              >{item.segments.length} 处标记</span
                            >
                          </span>
                        </button>

                        <!-- Divider -->
                        <div
                          class="w-px h-8 bg-gray-100 dark:bg-gray-800 shrink-0"
                        ></div>

                        <!-- Detail button -->
                        <button
                          class="px-3 h-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-green hover:bg-gray-50 dark:hover:bg-gray-800 shrink-0 transition-colors"
                          title="查看详情"
                          onclick={() => openDetail(item)}
                        >
                          <span class="i-carbon-list text-4"></span>
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<!-- ── Confirm dialog ─────────────────────────────────────── -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={dialogEl}
  class="rounded-2xl p-6 w-72 border-0 shadow-xl bg-white dark:bg-gray-900 text-sm"
  onclose={closeConfirm}
  onkeydown={(e) => e.key === "Escape" && closeConfirm()}
>
  <div class="font-medium mb-2">确认清空所有标记？</div>
  <div class="text-xs text-gray-500 mb-5">
    共 {annotations.length} 段落、{totalSegments} 处标记将被永久删除。
  </div>
  <div class="flex gap-3 justify-end">
    <button
      class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
      onclick={closeConfirm}
    >
      取消
    </button>
    <button
      class="px-4 py-2 rounded-lg bg-red text-white disabled:opacity-50"
      onclick={confirmClear}
      disabled={busy}
    >
      {#if busy}
        <span class="i-line-md-loading-twotone-loop text-3 animate-spin"></span>
      {:else}
        清空
      {/if}
    </button>
  </div>
</dialog>

<!-- ── Book detail dialog ──────────────────────────────────── -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={bookDetailEl}
  class="rounded-2xl p-6 w-80 border-0 shadow-xl bg-white dark:bg-gray-900 text-sm"
  onclose={closeBookDetail}
  onkeydown={(e) => e.key === "Escape" && closeBookDetail()}
>
  {#if bookDetailItem}
    {@const chList = [...bookDetailItem.chapters.values()]}
    {@const total = chList.reduce((s, c) => s + c.segmentCount, 0)}
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="font-medium">{bookDetailItem.book_name}</div>
        <div class="text-xs text-gray-400 mt-0.5">
          {chList.length} 章 · {total} 处标记
        </div>
      </div>
      <button
        class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        onclick={closeBookDetail}
        aria-label="关闭"
      >
        <span class="i-carbon-close text-4"></span>
      </button>
    </div>

    <!-- Chapter list -->
    <div class="space-y-2 max-h-60 overflow-y-auto mb-4">
      {#each chList as ch}
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs"
        >
          <span class="flex-1 text-gray-500">{ch.chapter_title}</span>
          <span class="text-gray-400 mr-2">{ch.segmentCount} 处</span>
          <button
            class="text-gray-400 hover:text-green shrink-0"
            onclick={() => {
              goToChapter(
                bookDetailItem.cid,
                bookDetailItem.book_id,
                ch.chapter_id,
              );
              closeBookDetail();
            }}
            aria-label="跳转到此章节"
          >
            <span class="i-carbon-arrow-right text-4"></span>
          </button>
        </div>
      {/each}
    </div>

    <!-- Delete all for this book -->
    <div class="flex gap-2">
      <button
        class="flex-1 px-4 py-2 rounded-lg bg-red text-white text-sm disabled:opacity-50"
        onclick={handleDeleteBookFromDetail}
        disabled={bookDetailDeleting}
      >
        {#if bookDetailDeleting}
          <span class="i-line-md-loading-twotone-loop text-3 animate-spin"
          ></span>
        {:else}
          删除此书全部标记
        {/if}
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm"
        onclick={closeBookDetail}
      >
        关闭
      </button>
    </div>
  {/if}
</dialog>

<!-- ── Detail dialog ──────────────────────────────────────────── -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
  bind:this={detailEl}
  class="rounded-2xl p-6 w-80 border-0 shadow-xl bg-white dark:bg-gray-900 text-sm"
  onclose={closeDetail}
  onkeydown={(e) => e.key === "Escape" && closeDetail()}
>
  {#if detailItem}
    <div class="flex items-center justify-between mb-4">
      <div>
        <div class="font-medium">标记详情</div>
        <div class="text-xs text-gray-400 mt-0.5">
          第{detailItem.p_index}段 · {detailItem.segments.length} 处标记
        </div>
      </div>
      <button
        class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        onclick={closeDetail}
        aria-label="关闭"
      >
        <span class="i-carbon-close text-4"></span>
      </button>
    </div>

    <!-- Segment list -->
    <div class="space-y-2 max-h-64 overflow-y-auto mb-4">
      {#each detailItem.segments as seg, i}
        <div
          class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs"
        >
          <!-- style chip -->
          <span
            class="w-4 h-4 rounded shrink-0 border"
            style="background: {seg.style === 'bg'
              ? seg.color
              : 'transparent'}; border-color: {seg.color}; text-decoration: {seg.style ===
            'underline'
              ? `underline ${seg.color}`
              : seg.style === 'underline_wavy'
                ? `underline wavy ${seg.color}`
                : 'none'}; color: {seg.style === 'text'
              ? seg.color
              : 'inherit'};"
          ></span>
          <span class="flex-1 text-gray-500">
            第 {seg.start + 1}–{seg.end} 字
          </span>
          <span class="text-gray-400">
            {seg.style === "bg"
              ? "背景色"
              : seg.style === "underline"
                ? "下划线"
                : seg.style === "underline_wavy"
                  ? "波浪线"
                  : seg.style === "text"
                    ? "文字色"
                    : seg.style}
          </span>
        </div>
      {/each}
    </div>

    <!-- Delete all for this paragraph -->
    <div class="flex gap-2">
      <button
        class="flex-1 px-4 py-2 rounded-lg bg-red text-white text-sm disabled:opacity-50"
        onclick={handleDeleteFromDetail}
        disabled={detailDeleting}
      >
        {#if detailDeleting}
          <span class="i-line-md-loading-twotone-loop text-3 animate-spin"
          ></span>
        {:else}
          删除全部标记
        {/if}
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm"
        onclick={closeDetail}
      >
        关闭
      </button>
    </div>
  {/if}
</dialog>
