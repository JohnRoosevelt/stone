<script>
  import { onMount } from "svelte";
  import {
    isTauri,
    needsInitialImport,
    getAllBooksForImport,
    getImportedBooks,
    markImportComplete,
  } from "$lib/tauri";
  import * as Engine from "$lib/importStore.svelte.js";

  // Synchronous guard — web mode never shows the overlay
  const _isTauri = isTauri();

  /** @type {'checking'|'ready'|'importing'|'done'|'idle'} */
  let phase = $state(_isTauri ? "checking" : "idle");
  let currentBatch = $state(0);
  let totalBatches = $state(0);
  let totalBooksAll = $state(0);
  let importedCount = $state(0);
  let failedCount = $state(0);

  const LANGS = ["zh", "en"];

  /** @type {{time: string, text: string, type: string}[]} */
  let logs = $state([]);

  function addLog(type, text) {
    const d = new Date();
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
    logs = [{ time, text, type }, ...logs].slice(0, 100);
  }

  async function doImport() {
    if (phase !== "ready") return;
    phase = "importing";
    logs = [];

    const langLabels = { zh: "Chinese", en: "English" };
    const cidLabels = { 0: "Bible", 1: "SDA", 2: "Books" };

    // Fetch already-imported book IDs so we can skip them
    const importedMap = new Map(); // key: "{cid}-{bookId}"
    for (const lang of LANGS) {
      const ids = await getImportedBooks(lang).catch(() => []);
      for (const [cid, bookId] of ids) {
        importedMap.set(`${cid}-${bookId}`, true);
      }
    }
    addLog(
      "info",
      `${importedMap.size} books already in local DB, will skip them`,
    );

    // Build per-CID-per-lang batches (the engine processes one CID at a time)
    const batches = [];
    let skippedCount = 0;
    for (const lang of LANGS) {
      const allBooks = await getAllBooksForImport(lang).catch((e) => {
        addLog("error", `Failed to fetch ${lang} book list: ${e}`);
        return [];
      });
      if (allBooks.length === 0) continue;

      // Group by cid so each engine batch has a single CID
      const byCid = new Map();
      for (const b of allBooks) {
        const list = byCid.get(b.cid) || [];
        list.push(b);
        byCid.set(b.cid, list);
      }

      for (const [cid, books] of byCid) {
        books.sort((a, b) => a.book_id - b.book_id);
        // Mark already-imported books as local so the engine skips them
        const entries = books.map((b) => ({
          book_id: b.book_id,
          name: b.name,
          local: importedMap.has(`${cid}-${b.book_id}`),
        }));
        const localCount = entries.filter((e) => e.local).length;
        if (localCount > 0) skippedCount += localCount;
        batches.push({ cid, lang, books: entries });
      }
    }

    totalBatches = batches.length;
    totalBooksAll = batches.reduce((s, b) => s + b.books.length, 0);
    addLog(
      "info",
      `Importing ${totalBooksAll} books across ${totalBatches} (cid, lang) groups`,
    );

    for (let bi = 0; bi < batches.length; bi++) {
      const { cid, lang, books } = batches[bi];
      currentBatch = bi + 1;

      const nonLocalCount = books.filter((b) => !b.local).length;
      const cidLabel = cidLabels[cid] || `CID ${cid}`;
      addLog(
        "info",
        `Batch ${currentBatch}/${totalBatches}: ${langLabels[lang]} / ${cidLabel}  (${nonLocalCount} to download, ${books.length - nonLocalCount} already in DB)`,
      );

      if (nonLocalCount === 0) {
        addLog("info", `All books in this group already imported, skipping`);
        continue;
      }

      // Reset engine counters for this batch
      Engine.reset();

      // Fire the batch — engine handles concurrent downloads + serial writes
      const batchPromise = Engine.startImport(cid, lang, books);

      // Poll engine state to sync logs into our local display array
      const pollId = setInterval(() => {
        const engLogs = Engine.getLogs();
        logs = engLogs.slice(0, 100);
      }, 500);

      await batchPromise;
      clearInterval(pollId);

      // Accumulate final counters from engine
      importedCount += Engine.getWritten();
      failedCount += Engine.getTotal() - Engine.getWritten();

      addLog(
        "info",
        `Batch ${currentBatch}/${totalBatches} done: ${Engine.getWritten()} / ${Engine.getTotal()} written`,
      );
    }

    // Mark the initial-import flag in DB
    try {
      await markImportComplete();
      addLog("info", "All books imported successfully!");
    } catch (e) {
      console.error("[InitialImport] markImportComplete error:", e);
    }

    phase = "done";
  }

  onMount(async () => {
    if (!_isTauri) return;

    try {
      const needed = await needsInitialImport();
      phase = needed ? "ready" : "idle";
    } catch (e) {
      console.error("[InitialImport] check error:", e);
      phase = "idle";
    }
  });

  // Auto-start once the UI shows the "ready" state
  $effect(() => {
    if (phase === "ready") {
      setTimeout(() => doImport(), 500);
    }
  });
</script>

{#if phase !== "idle"}
  <!-- Full-screen overlay -->
  <div class="fixed inset-0 z-50 bg-[#EDF1F0] dark:bg-[#111615] flex flex-col">
    <div
      class="flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-5 max-w-2xl mx-auto w-full"
    >
      <!-- Header -->
      <div class="text-center space-y-2 pt-8">
        {#if phase === "checking"}
          <div
            class="i-line-md-loading-twotone-loop text-5 mx-auto text-green animate-spin"
          ></div>
          <h1 class="text-xl font-bold">Stone Bible</h1>
          <p class="text-sm text-gray-500">Preparing...</p>
        {:else if phase === "ready"}
          <div class="i-carbon-download text-5 mx-auto text-green"></div>
          <h1 class="text-xl font-bold">First-time Setup</h1>
          <p class="text-sm text-gray-500">
            Downloading all books to your device. This may take a while...
          </p>
        {:else if phase === "importing"}
          <div
            class="i-line-md-loading-twotone-loop text-5 mx-auto text-green animate-spin"
          ></div>
          <h1 class="text-xl font-bold">Downloading Data</h1>
          <p class="text-sm text-gray-500">
            Batch {currentBatch}/{totalBatches}
            &middot; {Engine.getDownloaded()}/{Engine.getTotal()} downloaded &middot;
            {Engine.getWritten()} written
          </p>
        {:else if phase === "done"}
          <div
            class="i-carbon-checkmark-filled text-5 mx-auto text-green"
          ></div>
          <h1 class="text-xl font-bold">Ready!</h1>
          <p class="text-sm text-gray-500">
            {importedCount} books imported
            {failedCount > 0 ? `, ${failedCount} failed` : ""}
          </p>
          <button
            onclick={() => (phase = "idle")}
            class="mt-4 px-6 py-3 rounded-xl bg-green text-white font-medium text-base hover:bg-green/80 transition300"
          >
            Get Started
          </button>
        {/if}
      </div>

      <!-- Progress bar (engine-level: current batch) -->
      {#if phase === "importing"}
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-sm text-gray-500">
            <span>Batch progress:</span>
            <div
              class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
            >
              <div
                class="h-full bg-green transition-all duration-300"
                style:width="{Engine.getTotal() > 0
                  ? (Engine.getWritten() / Engine.getTotal()) * 100
                  : 0}%"
              ></div>
            </div>
            <span class="text-xs w-16 text-right flex-shrink-0"
              >{Engine.getWritten()}/{Engine.getTotal()}</span
            >
          </div>
        </div>
      {/if}

      <!-- Aggregate stats -->
      {#if phase === "done" && (importedCount > 0 || failedCount > 0)}
        <div class="flex items-center justify-center gap-4 text-sm">
          <span class="text-green">{importedCount} ok</span>
          {#if failedCount > 0}
            <span class="text-red">{failedCount} failed</span>
          {/if}
        </div>
      {/if}

      <!-- Logs (from engine) -->
      {#if logs.length > 0}
        <div
          class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 max-h-80 overflow-y-auto font-mono text-xs space-y-1"
        >
          {#each logs as log (log.time + log.text)}
            <div class="flex gap-2 items-start">
              <span class="text-gray-400 w-16 flex-shrink-0 select-none"
                >{log.time}</span
              >
              <span
                class:opacity-70={log.type === "info"}
                class="whitespace-pre-wrap break-all"
              >
                {log.text}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
