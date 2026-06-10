<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { getAllAnnotations, deleteAnnotation, clearAnnotations } from "$lib/tauri";
  import { info } from "$lib/global/Toast";
  import TopBar from "./components/TopBar.svelte";
  import RBook from "./components/RBook.svelte";
  import DetailDialog from "./components/DetailDialog.svelte";
  import BookDetailDialog from "./components/BookDetailDialog.svelte";

  // ── State ────────────────────────────────────────────────────
  let annotations = $state([]);
  let loading = $state(true);
  let loadError = $state("");
  let busy = $state(false);
  let deletingIds = $state(new Set());

  // Dialog data
  let detailItem = $state(null);
  let bookDetailBook = $state(null);

  // ── Load ─────────────────────────────────────────────────────
  async function load() {
    loading = true;
    loadError = "";
    try {
      annotations = await getAllAnnotations();
    } catch (e) {
      console.error("[annotations] load failed:", e);
      loadError = "加载失败";
    } finally {
      loading = false;
    }
  }
  onMount(load);

  // ── Collapse/expand ──────────────────────────────────────────
  let expandedBooks = $state(new Set());
  let expandedChapters = $state(new Set());

  function toggleBook(key) {
    const next = new Set(expandedBooks);
    next.has(key) ? next.delete(key) : next.add(key);
    expandedBooks = next;
  }

  function toggleChapter(key) {
    const next = new Set(expandedChapters);
    next.has(key) ? next.delete(key) : next.add(key);
    expandedChapters = next;
  }

  // ── Navigation ───────────────────────────────────────────────
  function goToChapter(cid, book_id, chapter_id) {
    goto(`/${cid}/${book_id}/${chapter_id}`);
  }

  function goToParagraph(cid, book_id, chapter_id, p_index) {
    goto(`/${cid}/${book_id}/${chapter_id}#zh-${p_index}`);
  }

  // ── Delete ───────────────────────────────────────────────────
  async function handleDelete(id) {
    if (deletingIds.has(id)) return;
    deletingIds = new Set([...deletingIds, id]);
    try {
      await deleteAnnotation(id);
      annotations = annotations.filter((a) => a.id !== id);
      info("已删除");
      detailItem = null;  // 子组件 onclose 会处理 close()
    } catch (e) {
      console.error("[annotations] delete failed:", e);
      info("删除失败");
    } finally {
      deletingIds.delete(id);
      deletingIds = new Set(deletingIds);
    }
  }

  async function handleDeleteBook() {
    if (!bookDetailBook) return;
    const bk = `${bookDetailBook.cid}-${bookDetailBook.book_id}`;
    const ids = annotations
      .filter((a) => `${a.cid}-${a.book_id}` === bk)
      .map((a) => a.id);
    await Promise.all(ids.map((id) => deleteAnnotation(id)));
    annotations = annotations.filter((a) => `${a.cid}-${a.book_id}` !== bk);
    info(`已删除 ${ids.length} 条标记`);
    bookDetailBook = null;  // 子组件 onclose 会处理 close()
  }

  // ── Clear all ────────────────────────────────────────────────
  function openConfirm() {
    if (annotations.length === 0) return;
    document.getElementById("confirm-dialog")?.showModal();
  }

  async function confirmClear() {
    if (busy) return;
    document.getElementById("confirm-dialog")?.close();
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

  // ── Open detail dialogs ───────────────────────────────────────
  function openDetail(item) {
    detailItem = item;
    // $effect above will trigger showModal
  }

  function openBookDetail(book) {
    bookDetailBook = book;
  }

  // ── Group: book > chapter > items ────────────────────────────
  let books = $derived.by(() => {
    const map = new Map();
    for (const a of annotations) {
      const bk = `${a.cid}-${a.book_id}`;
      if (!map.has(bk)) {
        map.set(bk, {
          cid: a.cid, book_id: a.book_id,
          book_name: a.book_name || "未知书籍",
          chapters: new Map(), _all: [],
        });
      }
      const bg = map.get(bk);
      bg._all.push(a);

      const ck = `${a.cid}-${a.book_id}-${a.chapter_id}`;
      if (!bg.chapters.has(ck)) {
        bg.chapters.set(ck, {
          chapter_id: a.chapter_id,
          chapter_title: a.chapter_title || `第${a.chapter_id}章`,
          items: [], segmentCount: 0,
        });
      }
      const cg = bg.chapters.get(ck);
      cg.items.push(a);
      cg.segmentCount += a.segments.length;
    }

    return [...map.values()].map((b) => {
      const chapterList = [...b.chapters.values()].map((c) => ({
        ...c,
        chKey: `${b.cid}-${b.book_id}-${c.chapter_id}`,
        onGoToChapter: () => goToChapter(b.cid, b.book_id, c.chapter_id),
        onOpenDetail: (item) => openDetail(item),
        onJump: (item) => goToParagraph(b.cid, b.book_id, c.chapter_id, item.p_index),
        toggle: toggleChapter,
      }));

      const mostRecent = b._all.reduce(
        (a, b) => new Date(a.updated_at) > new Date(b.updated_at) ? a : b,
      );
      const segmentCount = chapterList.reduce((s, c) => s + c.segmentCount, 0);
      const bookData = {
        cid: b.cid, book_id: b.book_id,
        book_name: b.book_name, chapterList,
      };

      return {
        cid: b.cid, book_id: b.book_id,
        book_name: b.book_name,
        key: `${b.cid}-${b.book_id}`,
        chapterList, segmentCount,
        onJumpMostRecent: () =>
          goToParagraph(mostRecent.cid, mostRecent.book_id, mostRecent.chapter_id, mostRecent.p_index),
        onOpenBookDetail: () => openBookDetail(bookData),
      };
    });
  });

  let totalSegments = $derived(books.reduce((s, b) => s + b.segmentCount, 0));
</script>

<svelte:head>
  <title>我的标记 - 脚前的灯</title>
</svelte:head>

<TopBar {busy} {annotations} {totalSegments} onConfirm={openConfirm} />

<!-- ── Content ─────────────────────────────────────────────────── -->
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
    <div class="text-xs text-gray-400 mb-4">共 {annotations.length} 段落，{totalSegments} 处标记</div>
    {#each books as book (book.key)}
      <RBook
        {book}
        expanded={expandedBooks.has(book.key)}
        {expandedChapters}
        onToggleBook={toggleBook}
        onOpenBookDetail={openBookDetail}
      />
    {/each}
  {/if}
</div>

<!-- ── Confirm dialog ─────────────────────────────────────────── -->
<dialog id="confirm-dialog">
  <div class="rounded-2xl p-6 w-72 border-0 shadow-xl bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100">
    <div class="font-medium mb-2">确认清空所有标记？</div>
    <div class="text-xs text-gray-500 dark:text-gray-400 mb-5">
      共 {annotations.length} 段落、{totalSegments} 处标记将被永久删除。
    </div>
    <div class="flex gap-3 justify-end">
      <button
        class="px-4 py-2 rounded-lg bg-red text-white text-sm disabled:opacity-50"
        onclick={confirmClear}
        disabled={busy}
      >
        {#if busy}<span class="i-line-md-loading-twotone-loop text-3 animate-spin"></span>{:else}清空{/if}
      </button>
      <button
        class="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-sm"
        onclick={() => document.getElementById("confirm-dialog")?.close()}
      >
        取消
      </button>
    </div>
  </div>
</dialog>

<style>
  dialog#confirm-dialog {
    margin: auto;
    position: fixed;
    inset: 0;
    border: none;
    background: transparent;
  }
  dialog#confirm-dialog::backdrop {
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(2px);
  }
</style>

<!-- ── Detail dialog ──────────────────────────────────────────── -->
<DetailDialog
  detailItem={detailItem}
  onDelete={handleDelete}
  onClose={() => { detailItem = null; }}
/>

<!-- ── Book detail dialog ─────────────────────────────────────── -->
<BookDetailDialog
  book={bookDetailBook}
  onDeleteBook={handleDeleteBook}
  onClose={() => { bookDetailBook = null; }}
/>
