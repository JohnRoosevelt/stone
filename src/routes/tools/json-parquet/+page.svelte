<script>
  import { PUBLIC_R2 } from "$env/static/public";
  import initWasm, { readParquet } from "parquet-wasm/esm";
  import { tableFromIPC } from "apache-arrow";
  import { ZSTDDecoder } from "zstddec";

  let wasmReady = $state(false);
  let decoder = null;
  let decoderInitError = $state("");

  let mode = $state("parquet-to-json");
  let cid = $state("book");
  let lang = $state("zh");
  let url = $state("");
  let loading = $state(false);
  let loadingText = $state("");
  let resultData = $state(null);
  let resultInfo = $state("");
  let error = $state("");

  const CID_OPTIONS = [
    { value: "book", label: "Book" },
    { value: "bible", label: "Bible" },
    { value: "sda", label: "SDA" }
  ];

  const LANG_OPTIONS = [
    { value: "zh", label: "中文" },
    { value: "en", label: "English" }
  ];

  async function initDecoder() {
    if (wasmReady) return;
    if (decoderInitError) throw new Error(decoderInitError);

    try {
      await initWasm();
      decoder = new ZSTDDecoder();
      await decoder.init();
      wasmReady = true;
    } catch (e) {
      decoderInitError = e.message;
      throw e;
    }
  }

  function groupRowsToChapters(rows, type) {
    if (type === "bible") {
      const chapters = [];
      let currentChapter = null;
      let verseId = 1;
      for (const row of rows) {
        if (!currentChapter || currentChapter.id !== row.n) {
          if (currentChapter) chapters.push(currentChapter);
          currentChapter = { id: row.n, verses: [] };
          verseId = 1;
        }
        currentChapter.verses.push({ id: verseId++, c: row.o });
      }
      if (currentChapter) chapters.push(currentChapter);
      return chapters;
    }

    if (type === "sda") {
      const chapters = [];
      let currentChapter = null;
      for (const row of rows) {
        if (!currentChapter || currentChapter.n !== row.n) {
          currentChapter = { n: row.n, ps: [] };
          chapters.push(currentChapter);
        }
        currentChapter.ps.push({ t: row.t, p: row.p, c: row.o });
      }
      return chapters;
    }

    const chapters = [];
    let currentChapter = null;
    for (const row of rows) {
      if (!currentChapter || currentChapter.n !== row.n) {
        currentChapter = { n: row.n, ps: [] };
        chapters.push(currentChapter);
      }
      currentChapter.ps.push({ o: row.o });
    }
    return chapters;
  }

  async function decodeParquet(buffer) {
    await initDecoder();
    loadingText = "解压...";
    const decompressed = decoder.decode(new Uint8Array(buffer));
    loadingText = "解析...";
    const wasmTable = readParquet(decompressed);
    const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
    const rows = arrowTable.toArray();
    return groupRowsToChapters(rows, cid);
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    loading = true;
    error = "";
    resultData = null;
    resultInfo = "";
    url = "";

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "json") {
        loadingText = "解析 JSON...";
        const text = await file.text();
        resultData = JSON.parse(text);
        resultInfo = `✅ ${file.name}\n📊 ${countRecords(resultData)} 条记录`;
      } else if (ext === "zst" || ext === "parquet") {
        loadingText = "读取文件...";
        const buffer = await file.arrayBuffer();
        resultData = await decodeParquet(buffer);
        resultInfo = `✅ ${file.name}\n📊 ${resultData.length} 章节`;
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      loadingText = "";
    }
  }

  async function handleUrl() {
    if (!url) return;

    loading = true;
    error = "";
    resultData = null;
    resultInfo = "";

    try {
      loadingText = "获取文件...";
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const ext = url.split(".").pop()?.toLowerCase();
      const filename = url.split("/").pop() || "file";

      if (ext === "json") {
        loadingText = "解析...";
        const text = await resp.text();
        resultData = JSON.parse(text);
        resultInfo = `✅ ${filename}\n📊 ${countRecords(resultData)} 条记录`;
      } else if (ext === "zst" || ext === "parquet") {
        const buffer = await resp.arrayBuffer();
        resultData = await decodeParquet(buffer);
        resultInfo = `✅ ${filename}\n📊 ${resultData.length} 章节`;
      } else {
        throw new Error("不支持的文件格式");
      }
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      loadingText = "";
    }
  }

  function countRecords(data) {
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0]?.ps) {
        return data.reduce((sum, ch) => sum + (ch.ps?.length || 0), 0);
      }
      if (data.length > 0 && data[0]?.verses) {
        return data.reduce((sum, ch) => sum + (ch.verses?.length || 0), 0);
      }
      return data.length;
    }
    if (typeof data === "object") {
      return Object.keys(data).length;
    }
    return 0;
  }

  function downloadJson() {
    if (!resultData) return;
    const blob = new Blob([JSON.stringify(resultData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${cid}_${lang}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function getSample(type) {
    switch (type) {
      case "book":
        return [{ n: "第一章", ps: [{ o: "内容1" }, { o: "内容2" }] }];
      case "bible":
        return [{ id: 1, verses: [{ id: 1, c: "经文1" }] }];
      case "sda":
        return { "0": { n: "第一章", ps: [{ t: 7, p: 0, c: "内容" }] } };
      default:
        return [];
    }
  }

  function downloadSample() {
    const sample = getSample(cid);
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${cid}_sample.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function formatPreview(data) {
    if (!data) return "";
    try {
      return JSON.stringify(data, null, 2).substring(0, 3000);
    } catch {
      return String(data);
    }
  }
</script>

<svelte:head>
  <title>JSON/Parquet 工具</title>
</svelte:head>

<div class="h-full flex flex-col">
  <div class="flex-1 overflow-auto p-4 space-y-4">
    <h1 class="text-xl font-bold sticky top-0 bg-white dark:bg-gray-900 pb-2">JSON/Parquet 工具</h1>

    <div class="flex gap-2 flex-wrap">
      <label class="flex items-center gap-1 px-3 py-1.5 border rounded cursor-pointer hover:bg-gray-50">
        <input type="radio" bind:group={mode} value="parquet-to-json" class="accent-blue-500" />
        <span>Parquet → JSON</span>
      </label>
      <label class="flex items-center gap-1 px-3 py-1.5 border rounded cursor-pointer hover:bg-gray-50">
        <input type="radio" bind:group={mode} value="json-to-parquet" class="accent-blue-500" />
        <span>JSON → Parquet (开发中)</span>
      </label>
    </div>

    <div class="flex gap-2 flex-wrap">
      <select bind:value={cid} class="px-2 py-1.5 border rounded text-sm">
        {#each CID_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
      <select bind:value={lang} class="px-2 py-1.5 border rounded text-sm">
        {#each LANG_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
      <button onclick={downloadSample} class="px-3 py-1.5 bg-gray-100 rounded text-sm hover:bg-gray-200">
        样本
      </button>
    </div>

    <div class="border rounded-lg p-3">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-sm font-medium">上传文件</span>
      </div>
      <input
        type="file"
        accept=".json,.parquet,.zst,.parquet.zst"
        onchange={handleFile}
        class="w-full text-sm file:mr-3 file:py-1 file:px-3 file:border file:rounded file:text-sm file:bg-gray-50 hover:file:bg-gray-100"
      />
    </div>

    <div class="border rounded-lg p-3">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-sm font-medium">从 URL 加载</span>
      </div>
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={url}
          placeholder="https://.../1.json 或 .../1.parquet.zst"
          class="flex-1 px-2 py-1.5 border rounded text-sm"
        />
        <button
          onclick={handleUrl}
          disabled={loading || !url}
          class="px-3 py-1.5 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
        >
          加载
        </button>
      </div>
    </div>

    {#if loading}
      <div class="text-center py-4 text-gray-500 text-sm">
        {loadingText || "处理中..."}
      </div>
    {/if}

    {#if error}
      <div class="bg-red-50 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
        ❌ {error}
      </div>
    {/if}

    {#if resultInfo}
      <div class="bg-green-50 border border-green-300 text-green-800 px-3 py-2 rounded text-sm whitespace-pre-line">
        {resultInfo}
      </div>
    {/if}

    {#if resultData}
      <div class="border rounded-lg overflow-hidden">
        <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
          <span class="text-sm font-medium">预览</span>
          <button onclick={downloadJson} class="px-2 py-1 bg-indigo-500 text-white rounded text-xs">
            下载 JSON
          </button>
        </div>
        <pre class="p-3 text-xs overflow-auto max-h-96 whitespace-pre-wrap">{formatPreview(resultData)}</pre>
      </div>
    {/if}

    <details class="text-sm text-gray-500">
      <summary class="cursor-pointer hover:text-gray-700">数据结构说明</summary>
      <div class="mt-2 space-y-1 text-xs">
        <div><strong>Book:</strong> <code>{'[{"n":"章节","ps":[{"o":"内容"}]}'}</code></div>
        <div><strong>Bible:</strong> <code>{'[{"id":1,"verses":[{"c":"经文"}]}'}</code></div>
        <div><strong>SDA:</strong> <code>{'{"0":{"n":"章节","ps":[{"t":7,"p":0,"c":"内容"}]}'}</code></div>
      </div>
    </details>
  </div>
</div>
