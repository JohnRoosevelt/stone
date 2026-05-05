<script>
  import { onMount } from "svelte";
  import { CID_MAP, CID_LIST } from "$lib/config";

  let cid = $state(0);
  let lang = $state("zh");
  let books = $state([]);
  let loading = $state(false);
  let loadingR2 = $state({}); // book_id → true
  let r2Data = $state({}); // book_id → { chapters, paragraphs, error? }
  let error = $state("");

  const LANGS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" },
  ];

  // CID 选项（按原顺序）
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

  /** 存解析后的原始数据，供同步用 */
  let parsedChapters = $state({});

  async function loadR2(bookId) {
    loadingR2 = { ...loadingR2, [bookId]: true };
    try {
      const { loadR2Parquet } = await import("$lib/parquet");
      const chapters = await loadR2Parquet(`${cid}/${lang}/${bookId}`);
      const paraCount = chapters.reduce((s, ch) => s + (ch.ps?.length || 0), 0);
      parsedChapters = { ...parsedChapters, [bookId]: chapters };
      r2Data = {
        ...r2Data,
        [bookId]: { chapters: chapters.length, paragraphs: paraCount },
      };
    } catch (e) {
      r2Data = { ...r2Data, [bookId]: { error: e.message } };
    } finally {
      loadingR2 = { ...loadingR2, [bookId]: false };
    }
  }

  async function syncToDb(bookId) {
    loadingR2 = { ...loadingR2, [bookId]: true };
    try {
      const raw = parsedChapters[bookId];
      if (!raw) throw new Error("请先读取R2");
      const chapters = raw.map((ch) => ({
        chapterId: Number(ch.n) || 0,
        title: `第 ${ch.n} 章`,
        paragraphs: (ch.ps || []).map((p, i) => ({
          id: i,
          num: p.p != null ? Number(p.p) : i + 1,
          textContent: p.c || "",
          format: p.t != null ? Number(p.t) : null,
        })),
      }));
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cid, bookId, lang, chapters }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      r2Data = {
        ...r2Data,
        [bookId]: {
          chapters: data.chapterCount,
          paragraphs: data.paragraphCount,
          synced: true,
        },
      };
      await loadBooks();
    } catch (e) {
      r2Data = { ...r2Data, [bookId]: { error: e.message } };
    } finally {
      loadingR2 = { ...loadingR2, [bookId]: false };
    }
  }

  onMount(() => loadBooks());

  // 汇总
  let totalBooks = $derived(books.length);
  let totalChapters = $derived(books.reduce((s, b) => s + b.chapters, 0));
  let totalParagraphs = $derived(books.reduce((s, b) => s + b.paragraphs, 0));
  let r2LoadedCount = $derived(
    Object.values(r2Data).filter((v) => !v.error).length,
  );
</script>

<svelte:head>
  <title>书籍数据 - 脚前的灯</title>
</svelte:head>

<div class="w-full px-3 py-4 sm:px-6 sm:py-6 space-y-4 h-full overflow-y-auto">
  <!-- 标题 + CID 切换 + 语言 -->
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
              parsedChapters = {};
              r2Data = {};
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
            parsedChapters = {};
            r2Data = {};
            loadBooks();
          }}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  </div>

  <!-- 汇总条 + 批量操作 -->
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
    <span class="bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg">
      R2 已读 <strong class="text-green ml-1">{r2LoadedCount}</strong>
      <span class="text-gray-400">/{totalBooks}</span>
    </span>

    <div class="flex-1"></div>

    <button
      onclick={async () => {
        const CONCURRENCY = 10;
        const queue = [...books];
        async function work() {
          while (queue.length > 0) {
            const book = queue.shift();
            await loadR2(book.book_id);
          }
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, () => work()));
      }}
      class="px-3 py-1.5 rounded-md text-sm font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition150"
    >
      批量读取R2
    </button>
    <button
      onclick={async () => {
        for (const book of books) {
          const r2 = r2Data[book.book_id];
          if (
            r2 &&
            !r2.synced &&
            (r2.chapters !== book.chapters || r2.paragraphs !== book.paragraphs)
          ) {
            await syncToDb(book.book_id);
          }
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

  <!-- 表格 -->
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
            <th class="px-3 sm:px-4 py-3 text-center w-28">R2</th>
          </tr>
        </thead>
        <tbody>
          {#if loading}
            <tr>
              <td
                colspan="6"
                class="px-4 py-12 text-center text-gray-400 text-sm"
              >
                加载中...
              </td>
            </tr>
          {:else if books.length === 0}
            <tr>
              <td
                colspan="6"
                class="px-4 py-12 text-center text-gray-400 text-sm"
              >
                暂无数据
              </td>
            </tr>
          {:else}
            {#each books as book, i}
              <tr
                class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition150"
              >
                <td class="px-3 sm:px-4 py-2.5 text-gray-400 text-xs"
                  >{i + 1}</td
                >
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
                <td class="px-3 sm:px-4 py-2.5 text-center text-xs space-y-1">
                  {#if r2Data[book.book_id]}
                    {#if r2Data[book.book_id].error}
                      <span
                        class="text-red text-xs block"
                        title={r2Data[book.book_id].error}>失败</span
                      >
                    {:else}
                      <div class="font-medium">
                        <span class="text-green"
                          >{r2Data[book.book_id].chapters}章</span
                        >
                        <span class="text-gray-400">
                          /{r2Data[book.book_id].paragraphs}段</span
                        >
                      </div>
                      {#if r2Data[book.book_id].chapters !== book.chapters || r2Data[book.book_id].paragraphs !== book.paragraphs}
                        {#if r2Data[book.book_id].synced}
                          <span class="text-green text-xs">✓ 已同步</span>
                        {:else}
                          <button
                            onclick={() => syncToDb(book.book_id)}
                            class="px-2 py-0.5 rounded text-xs font-medium bg-green text-white hover:bg-green/80 transition150"
                          >
                            同步
                          </button>
                        {/if}
                      {:else}
                        <span class="text-green text-xs">✓</span>
                      {/if}
                    {/if}
                  {:else if loadingR2[book.book_id]}
                    <span class="text-gray-400 text-xs block">处理中...</span>
                  {:else}
                    <button
                      onclick={() => loadR2(book.book_id)}
                      class="px-2 py-0.5 rounded text-xs font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition150"
                    >
                      读取R2
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>
