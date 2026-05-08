<script>
  import { onMount } from "svelte";
  import { CID_MAP, CID_LIST } from "$lib/config";
  import ChapterDrilldown from "./ChapterDrilldown.svelte";
  import R2Preview from "./R2Preview.svelte";

  let cid = $state(0);
  let lang = $state("zh");
  let books = $state([]);
  let loading = $state(false);
  let error = $state("");

  let expandedBook = $state(null);
  let previewBook = $state(null);

  const LANGS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" },
  ];

  // CID options (in original order)
  const CID_OPTIONS = CID_LIST.map(({ id, name }) => ({
    value: Number(id),
    label: name,
  }));

  async function loadBooks() {
    loading = true;
    error = "";
    try {
      const res = await fetch(`/api/admin/import?cid=${cid}&lang=${lang}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      books = data.books || [];
    } catch (e) {
      error = e.message;
      books = [];
    } finally {
      loading = false;
    }
  }

  async function syncToDb(bookId) {
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, bookId, lang }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await loadBooks();
    } catch (e) {
      error = e.message;
    }
  }

  function toggleBook(bookId) {
    expandedBook = expandedBook === bookId ? null : bookId;
  }

  onMount(() => loadBooks());

  let totalBooks = $derived(books.length);
  let totalChapters = $derived(books.reduce((s, b) => s + b.chapters, 0));
  let totalParagraphs = $derived(books.reduce((s, b) => s + b.paragraphs, 0));
</script>

<svelte:head>
  <title>书籍数据 - 脚前的灯</title>
</svelte:head>

<div class="w-full px-3 py-4 sm:px-6 sm:py-6 space-y-4 h-full overflow-y-auto">
  <!-- Title + CID switch + Language -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <h1 class="text-lg sm:text-xl font-bold">书籍数据</h1>

      <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {#each LANGS as l}
          <button
            class="px-2 py-0.5 rounded-md text-xs font-medium transition200 {lang ===
            l.value
              ? 'bg-white dark:bg-gray-700 text-green shadow-sm'
              : 'text-gray-400 hover:text-gray-600'}"
            onclick={() => {
              lang = l.value;
              expandedBook = null;
              loadBooks();
            }}
          >
            {l.label}
          </button>
        {/each}
      </div>
    </div>

    <div
      class="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto self-start"
    >
      {#each CID_OPTIONS as opt}
        <button
          class="px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition200
            {cid === opt.value
            ? 'bg-white dark:bg-gray-700 text-green shadow-sm'
            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}"
          onclick={() => {
            cid = opt.value;
            expandedBook = null;
            loadBooks();
          }}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- Summary bar + batch operations -->
  <div class="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 flex-wrap">
    <span class="bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg">
      书 <strong class="text-gray-700 dark:text-gray-200 ml-1"
        >{totalBooks}</strong
      >
    </span>
    <span class="bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg">
      章节 <strong class="text-gray-700 dark:text-gray-200 ml-1"
        >{totalChapters}</strong
      >
    </span>
    <span class="bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg">
      段落 <strong class="text-gray-700 dark:text-gray-200 ml-1"
        >{totalParagraphs}</strong
      >
    </span>

    <div class="flex-1"></div>

    <button
      onclick={async () => {
        for (const book of books) {
          await syncToDb(book.book_id);
        }
      }}
      class="px-3 py-1.5 rounded-md text-sm font-medium bg-green text-white hover:bg-green/80 transition150"
    >
      批量同步
    </button>
  </div>

  {#if error}
    <div
      class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-lg"
    >
      {error}
    </div>
  {/if}

  <!-- Table -->
  <div
    class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
  >
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr
            class="bg-gray-50 dark:bg-gray-800/50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            <th class="px-3 sm:px-4 py-3 w-10">#</th>
            <th class="px-3 sm:px-4 py-3">书名</th>
            <th class="px-3 sm:px-4 py-3 text-right">章节/段落</th>
            <th class="px-3 sm:px-4 py-3 text-center w-44">操作</th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            <tr>
              <td
                colspan="4"
                class="px-4 py-12 text-center text-gray-400 text-sm"
              >
                加载中...
              </td>
            </tr>
          {:else if books.length === 0}
            <tr>
              <td
                colspan="4"
                class="px-4 py-12 text-center text-gray-400 text-sm"
              >
                暂无数据
              </td>
            </tr>
          {:else}
            {#each books as book, i}
              {#key book.book_id}
                <!-- Book row -->
                <tr
                  class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition150 cursor-pointer"
                  onclick={() => toggleBook(book.book_id)}
                >
                  <td
                    class="px-3 sm:px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap"
                  >
                    <span
                      class="inline-block transition200 {expandedBook ===
                      book.book_id
                        ? 'rotate-90'
                        : ''}">▶</span
                    >
                    {i + 1}
                  </td>
                  <td class="px-3 sm:px-4 py-2.5 font-medium text-sm"
                    >{book.name || book.book_id}</td
                  >
                  <td
                    class="px-3 sm:px-4 py-2.5 text-right font-mono text-sm tabular-nums text-gray-500"
                  >
                    <span class="text-gray-700 dark:text-gray-300"
                      >{book.chapters}</span
                    >
                    <span class="text-gray-400">/{book.paragraphs}</span>
                  </td>
                  <td class="px-3 sm:px-4 py-2.5 text-center text-xs">
                    <div
                      class="flex flex-row items-center justify-center gap-1 flex-nowrap"
                    >
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          syncToDb(book.book_id);
                        }}
                        class="px-2.5 py-1 rounded text-xs font-medium bg-green text-white hover:bg-green/80 transition150 whitespace-nowrap"
                      >
                        同步到DB
                      </button>
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          previewBook =
                            previewBook === book.book_id ? null : book.book_id;
                        }}
                        class="px-2 py-0.5 rounded text-xs font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition150 whitespace-nowrap"
                      >
                        {previewBook === book.book_id ? "收起" : "预览R2"}
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- R2 Preview Panel -->
                {#if previewBook === book.book_id}
                  <tr>
                    <td colspan="4" class="p-0">
                      <R2Preview
                        {cid}
                        {lang}
                        bookId={book.book_id}
                        bookName={book.name}
                        onclose={() => (previewBook = null)}
                      />
                    </td>
                  </tr>
                {/if}

                <!-- Chapter/Paragraph drilldown (standalone component) -->
                {#if expandedBook === book.book_id}
                  <tr>
                    <td colspan="4" class="p-0 bg-gray-50/50">
                      <div class="border-t border-gray-200">
                        <ChapterDrilldown {cid} {lang} bookId={book.book_id} />
                      </div>
                    </td>
                  </tr>
                {/if}
              {/key}
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
