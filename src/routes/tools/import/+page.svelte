<script>
  import { onMount } from "svelte";
  import { isTauri, getBooks, hasBookData } from "$lib/tauri";
  import { CID_LIST } from "$lib/config";
  import * as IS from "$lib/importStore.svelte.js";

  let cid = $state(0);
  let lang = $state("zh");
  let allBooks = $state([]);
  let localBooks = $state(new Set());
  let importing = $state(new Set());
  let loading = $state(false);
  let pageError = $state("");

  const LANGS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" },
  ];

  async function loadBooks() {
    if (IS.isRunning()) return;
    loading = true;
    pageError = "";
    try {
      allBooks = await getBooks(lang, cid);
      localBooks = new Set();
      for (const b of allBooks) {
        try {
          if (await hasBookData(cid, b.book_id, lang))
            localBooks.add(b.book_id);
        } catch (_) {}
      }
    } catch (e) {
      pageError = e.message;
    } finally {
      loading = false;
    }
  }

  async function doImport(bookId) {
    if (IS.isRunning()) return;
    importing.add(bookId);
    importing = new Set(importing);
    pageError = "";
    try {
      const { loadR2Parquet } = await import("$lib/parquet");
      const chapters = await loadR2Parquet(`${cid}/${lang}/${bookId}`, true);
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_book", { cid, bookId, lang, chapters });
      localBooks.add(bookId);
      localBooks = new Set(localBooks);
    } catch (e) {
      pageError = e.message || String(e);
    } finally {
      importing.delete(bookId);
      importing = new Set(importing);
    }
  }

  async function doDelete(bookId) {
    if (IS.isRunning()) return;
    try {
      const { deleteBookData } = await import("$lib/tauri");
      await deleteBookData(cid, bookId, lang);
      localBooks.delete(bookId);
      localBooks = new Set(localBooks);
    } catch (e) {
      pageError = e.message || String(e);
    }
  }
  function importAll() {
    if (IS.isRunning()) return;
    IS.startImport(
      cid,
      lang,
      allBooks.map((b) => ({
        book_id: b.book_id,
        name: b.name,
        local: localBooks.has(b.book_id),
      })),
    );
  }

  onMount(() => loadBooks());
</script>

<svelte:head><title>数据导入 - 脚前的灯</title></svelte:head>

<div class="w-full px-3 py-4 sm:px-6 sm:py-6 space-y-4 h-full overflow-y-auto">
  <div class="flex items-center gap-3 mb-2">
    <a href="/my" class="text-gray-400 hover:text-green"
      ><span class="i-carbon-arrow-left text-xl"></span></a
    >
    <h1 class="text-lg sm:text-xl font-bold">📦 书籍导入</h1>
  </div>

  {#if !isTauri()}
    <div
      class="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 p-4 rounded-lg text-sm"
    >
      ⚠️ 仅 Tauri 客户端可用
    </div>
  {/if}

  <!-- ===== Importing: frozen UI, showing progress ===== -->
  {#if IS.isRunning()}
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <span class="i-carbon-loading animate-spin text-green text-xl"></span>
        <span class="font-medium"
          >正在导入 {IS.getCurrentLang()} / CID={IS.getCurrentCid()} · 请勿切换</span
        >
      </div>

      <!-- Progress bar -->
      <div class="space-y-2">
        <div class="flex items-center gap-2 text-sm text-gray-500">
          下载: {IS.getDownloaded()}/{IS.getTotal()}
          <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div
              class="h-full bg-blue"
              style:width="{(IS.getDownloaded() / IS.getTotal()) * 100}%"
            ></div>
          </div>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          写入: {IS.getWritten()}/{IS.getTotal()}
          <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div
              class="h-full bg-green"
              style:width="{(IS.getWritten() / IS.getTotal()) * 100}%"
            ></div>
          </div>
        </div>
      </div>

      <!-- Recent logs -->
      <div
        class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-xs space-y-1"
      >
        {#each IS.getLogs() as log (log.time + log.text)}
          <div class="flex gap-2">
            <span class="text-gray-400 w-16 flex-shrink-0">{log.time}</span>
            <span
              class={log.type === "download"
                ? "text-blue"
                : log.type === "write"
                  ? "text-green"
                  : log.type === "error"
                    ? "text-red"
                    : "text-gray-500"}
            >
              {log.text}
            </span>
          </div>
        {/each}
      </div>

      <!-- Error -->
      {#if IS.getError()}
        <div
          class="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-4 py-2 rounded-lg"
        >
          {IS.getError()}
        </div>
      {/if}
    </div>
  {:else if IS.getTotal() > 0 && IS.getWritten() === IS.getTotal()}
    <!-- ===== Complete ===== -->
    <div
      class="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-4 text-center space-y-2"
    >
      <p class="text-green-600 font-medium text-lg">✅ 全部导入完成！</p>
      <p class="text-green-500 text-sm">已导入 {IS.getTotal()} 本书</p>
      <button
        onclick={() => window.location.reload()}
        class="px-4 py-2 rounded-lg bg-green text-white text-sm font-medium"
      >
        刷新查看最新状态
      </button>
    </div>
  {:else}
    <!-- ===== Normal mode: control bar + book list ===== -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {#each CID_LIST as opt}
          <button
            class="px-3 py-1.5 rounded-md text-sm font-medium {cid ===
            Number(opt.id)
              ? 'bg-white dark:bg-gray-700 text-green shadow-sm'
              : 'text-gray-500'}"
            onclick={() => ((cid = Number(opt.id)), loadBooks())}
            >{opt.name}</button
          >
        {/each}
      </div>
      <div class="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
        {#each LANGS as l}
          <button
            class="px-3 py-1.5 rounded-md text-sm {lang === l.value
              ? 'bg-white dark:bg-gray-700 text-green shadow-sm'
              : 'text-gray-500'}"
            onclick={() => ((lang = l.value), loadBooks())}>{l.label}</button
          >
        {/each}
      </div>
      <button
        onclick={importAll}
        class="px-3 py-1.5 rounded-md text-sm font-medium bg-green text-white"
      >
        一键导入全部
      </button>
    </div>

    {#if pageError}
      <div
        class="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm px-4 py-2 rounded-lg"
      >
        {pageError}
      </div>
    {/if}

    <div
      class="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
    >
      <table class="w-full text-sm">
        <thead
          ><tr
            class="bg-gray-50 dark:bg-gray-800/50 text-left text-xs font-medium text-gray-500 uppercase"
            ><th class="px-3 py-3">书名</th><th class="px-3 py-3 text-center"
              >状态</th
            ><th class="px-3 py-3 text-center w-32">操作</th></tr
          ></thead
        >
        <tbody>
          {#if loading}<tr
              ><td colspan="3" class="px-4 py-12 text-center text-gray-400"
                >加载中...</td
              ></tr
            >
          {:else if allBooks.length === 0}<tr
              ><td colspan="3" class="px-4 py-12 text-center text-gray-400"
                >暂无数据</td
              ></tr
            >
          {:else}
            {#each allBooks as book (book.book_id)}
              <tr
                class="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
              >
                <td class="px-3 py-2.5">{book.name}</td>
                <td class="px-3 py-2.5 text-center"
                  >{#if localBooks.has(book.book_id)}<span
                      class="text-green text-xs">✅</span
                    >{:else}<span class="text-gray-400 text-xs">—</span
                    >{/if}</td
                >
                <td class="px-3 py-2.5 text-center">
                  <button
                    onclick={() => doImport(book.book_id)}
                    disabled={IS.isRunning() || importing.has(book.book_id)}
                    class="px-3 py-1 rounded text-xs font-medium {localBooks.has(
                      book.book_id,
                    )
                      ? 'border border-gray-300 hover:bg-gray-100'
                      : 'bg-green text-white hover:bg-green/80'} disabled:opacity-50"
                  >
                    {importing.has(book.book_id)
                      ? "..."
                      : localBooks.has(book.book_id)
                        ? "🔄"
                        : "导入"}
                  </button>

                  {#if localBooks.has(book.book_id)}
                    <button
                      onclick={() => doDelete(book.book_id)}
                      disabled={IS.isRunning()}
                      class="px-2 py-1 rounded text-xs border border-red-300 text-red"
                      >🗑</button
                    >
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</div>
