<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import {
    writeChapterParquet,
    writeBookParquet,
    loadR2Parquet,
    loadParquetContent,
  } from "$lib/parquet";
  import { uploadToR2 } from "$lib/r2-upload";

  const CID_OPTIONS = [
    { value: 0, slug: "bible", label: "0 · 圣经" },
    { value: 1, slug: "sda", label: "1 · 预言之灵" },
    { value: 2, slug: "book", label: "2 · 书籍" },
  ];

  let cid = $state(0);
  let lang = $state("zh"); //en
  let bookId = $state(1);
  let dryRun = $state(true);
  let splitting = $state(false);
  let progress = $state([]);
  let validated = $state({});
  let viewerKey = $state("");
  let viewerLoading = $state(false);
  let viewerData = $state(null);
  const cidSlug = $derived(
    CID_OPTIONS.find((o) => o.value === cid)?.slug ?? String(cid),
  );

  $effect(() => {
    const p = page.url.searchParams;
    const urlCid = p.get("cid");
    const urlBook = p.get("bookId");
    if (urlCid) cid = Number(urlCid);
    if (urlBook) bookId = Number(urlBook);
    if (p.get("lang")) lang = p.get("lang");
  });

  let _lastAutoKey = $state("");
  $effect(() => {
    const key = cid + "|" + lang + "|" + bookId;
    if (key !== _lastAutoKey) {
      _lastAutoKey = key;
      clientData = null;
      clientError = "";
      const p = new URLSearchParams({ cid, lang, bookId });
      window.history.replaceState(null, "", "/tools/split-parquet?" + p);
      clientLoad();
    }
  });

  let data = $derived(clientData || page.data);
  let chapters = $derived(data?.chapters ?? []);
  let error = $derived(clientError || (data?.error ?? ""));
  let totalRows = $derived(data?.totalRows ?? 0);
  let loaded = $derived(!!clientData || data?.loaded);

  let clientLoading = $state(false);
  let clientData = $state(null);
  let clientError = $state("");

  async function clientLoad() {
    clientLoading = true;
    clientError = "";
    clientData = null;

    try {
      const path = `${cidSlug}/${lang}/${bookId}`;
      const data = await loadR2Parquet(path);
      clientData = { cid, bookId, lang, data };
    } catch (e) {
      clientError = e.message;
    }
    clientLoading = false;
  }

  async function uploadFile(key, bytes) {
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const file = new File([blob], key, { type: "application/octet-stream" });
    return uploadToR2(file, key);
  }

  async function splitCurrentBook() {
    splitting = true;
    progress = [];
    const numCid = clientData.cid;
    const allChapters = $state.snapshot(clientData.data);

    await new Promise((resolve) => setTimeout(resolve, 0));
    const allRows = allChapters.flatMap((ch) =>
      (ch.ps ?? []).map((r) => ({ n: ch.n, c: r.c, t: r.t, p: r.p })),
    );
    console.log({ allRows });

    if (allRows.length > 0) {
      const bookKey =
        numCid +
        "/" +
        clientData.lang +
        "/" +
        clientData.bookId +
        ".parquet.zst";
      try {
        const bookCompressed = await writeBookParquet(allRows, numCid);
        if (!dryRun) await uploadFile(bookKey, bookCompressed);
        progress.push({
          key: bookKey,
          type: "book",
          chapterId: null,
          buffer: bookCompressed,
          size: bookCompressed.length,
          success: true,
        });
      } catch (e) {
        console.error(e);
      }

      // let chapterId = 0;

      // for (const ch of allChapters) {
      //   // 强制跳出当前 JavaScript 执行堆栈，让浏览器有时间重绘 UI
      //   await new Promise((resolve) => setTimeout(resolve, 0));
      //   chapterId++;
      //   const chRows = ch.ps;
      //   if (!chRows || chRows.length === 0) continue;
      //   const key =
      //     numCid +
      //     "/" +
      //     clientData.lang +
      //     "/" +
      //     clientData.bookId +
      //     "/" +
      //     chapterId +
      //     ".parquet.zst";
      //   try {
      //     const compressed = await writeChapterParquet(chRows, numCid);
      //     if (!dryRun) await uploadFile(key, compressed);
      //     progress.push({
      //       key,
      //       type: "chapter",
      //       chapterId,
      //       buffer: compressed,
      //       size: compressed.length,
      //       success: true,
      //     });
      //   } catch (e) {
      //     console.error(e);
      //   }
      // }
    }

    splitting = false;
    validated = { ...validated, [numCid]: true };
  }

  async function viewFile(key) {
    viewerKey = key;
    viewerLoading = true;
    viewerData = null;

    try {
      // if dry run, show parquet buffer
      if (dryRun) {
        const buffer = progress.find((p) => p.key === key)?.buffer;
        if (buffer) {
          const [keyCid, , , chapterString = "."] = key.split("/");
          const [chapterId] = chapterString.split(".");
          viewerData = await loadParquetContent(buffer, keyCid, !!chapterId);
        }
        if (!viewerData) throw new Error("not found");
      } else {
        // load from r2
        viewerData = await loadR2Parquet(key);
      }
      if (!viewerData) throw new Error("not found");
    } catch (e) {
      viewerData = { error: e.message };
    }
    viewerLoading = false;
  }

  function formatSize(bytes) {
    if (!bytes) return "0 KB";
    if (bytes < 1024) return bytes + " B";
    return (bytes / 1024).toFixed(1) + " KB";
  }

  async function batchSplitAll() {
    cid = 2;
    lang = "zh";
    for (let id = 1; id <= 4; id++) {
      console.log({ id });
      bookId = id;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!clientData?.data) continue;
      // if (!clientData.data) {
      //   await new Promise((resolve) => setTimeout(resolve, 4000));
      // }
      await splitCurrentBook();
    }
  }
</script>

<svelte:head>
  <title>Parquet 拆分工具</title>
</svelte:head>

{#snippet leftPanel()}
  {#snippet header()}
    <h1 class="text-lg font-bold shrink-0">Parquet 拆分 · 书级 → 章级</h1>

    <!-- ---- Input form ---- -->
    <div class="flex gap-2 items-end shrink-0 flex-wrap">
      <label class="flex flex-col gap-0.5 text-xs text-gray-500">
        CID
        <select bind:value={cid} class="px-2 py-1 border rounded text-sm">
          {#each CID_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </label>
      <label class="flex flex-col gap-0.5 text-xs text-gray-500">
        语言
        <select bind:value={lang} class="px-2 py-1 border rounded text-sm">
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </label>
      <label class="flex flex-col gap-0.5 text-xs text-gray-500">
        Book ID
        <input
          type="number"
          bind:value={bookId}
          min="1"
          class="px-2 py-1 border rounded text-sm w-20"
        />
      </label>
      <button
        onclick={batchSplitAll}
        disabled={clientLoading}
        class="px-3 py-1 bg-red-500 text-white rounded text-sm disabled:opacity-50"
      >
        全部执行
      </button>
    </div>

    <!-- ---- Server/client error ---- -->
    {#if clientLoading}
      <div class="text-sm text-blue-500 shrink-0">客户端加载中...</div>
    {/if}
    {#if error}
      <div class="text-sm text-red-600 shrink-0">error: {error}</div>
    {/if}
  {/snippet}

  <div class="flex-[3] flex flex-col space-y-3 overflow-hidden min-w-0">
    {@render header()}

    <!-- ---- Loaded summary ---- -->
    {#if clientData && clientData.data.length > 0}
      {@const chapters = clientData.data}
      <div class="text-sm text-gray-600 shrink-0 space-x-4">
        <span>📚 <b>{cidSlug}</b> {data.bookId}</span>
        <span>{chapters.length} 章</span>
        <button
          onclick={() => {
            viewerKey = _lastAutoKey;
            viewerData = chapters;
          }}
          class="text-xs px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 rounded"
          >整书JSON</button
        >
      </div>

      <!-- Actions -->
      <div class="flex gap-2 items-center shrink-0">
        <button
          onclick={splitCurrentBook}
          disabled={splitting}
          class="px-3 py-1.5 rounded text-sm font-500 text-white"
          class:bg-green-600={!splitting}
          class:bg-gray-400={splitting}
        >
          {splitting
            ? "处理中..."
            : dryRun
              ? "拆分本书 (试运行)"
              : `拆分本书 → ${cidSlug}/${lang}/${bookId}/`}
          {splitting}
        </button>
        <label class="flex items-center gap-1 text-sm cursor-pointer">
          <input type="checkbox" bind:checked={dryRun} />
          <span class="text-gray-500">dry-run</span>
        </label>
      </div>

      <!-- Split progress -->
      {#if progress.length > 0}
        <div class="flex-1 overflow-auto border rounded min-h-0">
          <div
            class="sticky top-0 bg-gray-50 px-3 py-1.5 text-xs text-gray-500 border-b flex gap-4"
          >
            <span>文件列表</span>
            <span class="text-gray-400"
              >{progress.filter((f) => f.success).length}/{chapters.length} 成功</span
            >
          </div>
          <div class="divide-y text-xs">
            {#each progress as file}
              <div class="px-3 py-1.5 flex items-center gap-2">
                <span class="font-mono truncate flex-1 text-[11px]"
                  >{file.key}</span
                >
                <span class="text-gray-500 shrink-0"
                  >{formatSize(file.size)}</span
                >
                <button
                  onclick={() => viewFile(file.key)}
                  class="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-[10px] shrink-0"
                  >JSON</button
                >
              </div>
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
{/snippet}

{#snippet rightPanel()}
  <div class="flex-[2] flex flex-col border rounded overflow-hidden min-w-0">
    <div
      class="px-3 py-2 bg-gray-50 border-b text-sm font-medium shrink-0 flex items-center gap-2"
    >
      JSON 预览
      {#if viewerKey}
        <span class="text-gray-400 text-xs truncate">{viewerKey}</span>
      {/if}
    </div>
    <div class="flex-1 overflow-auto min-h-0">
      {#if viewerLoading}
        <div class="p-4 text-sm text-gray-500">加载中...</div>
      {:else if viewerData}
        <pre
          class="p-3 text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(
            viewerData,
            null,
            2,
          )}</pre>
      {:else}
        <div class="p-4 text-sm text-gray-400">
          点击左侧文件列表中的 JSON 按钮查看内容
        </div>
      {/if}
    </div>
  </div>
{/snippet}

<div class="w-svw h-svh flex gap-2 overflow-hidden">
  {@render leftPanel()}
  {@render rightPanel()}
</div>
