<script>
  import initWasm, {
    readParquet,
    Table,
    WriterPropertiesBuilder,
    writeParquet,
  } from "parquet-wasm/esm";
  import * as arrow from "apache-arrow";
  import initZstd, { compress, decompress } from "@dweb-browser/zstd-wasm";
  import { uploadToR2 } from "$lib/r2-upload";

  const tableFromIPC = arrow.tableFromIPC;
  const tableFromArrays = arrow.tableFromArrays;
  const tableToIPC = arrow.tableToIPC;

  let wasmReady = $state(false);
  let zstdReady = $state(false);

  let url = $state("https://r2.lelexue.cn/book/zh/1.parquet.zst");
  let loading = $state(false);
  let loadingText = $state("");
  let resultData = $state(null);
  let editingData = $state("");
  let error = $state("");
  let currentType = $state("");
  let generating = $state(false);
  let fileInput;

  function detectTypeFromFile(file) {
    const name = file.name.toLowerCase();
    if (
      name.includes("/book/") ||
      name.includes("book/") ||
      name.startsWith("book.")
    )
      return "book";
    if (
      name.includes("/bible/") ||
      name.includes("bible/") ||
      name.startsWith("bible.")
    )
      return "bible";
    if (
      name.includes("/sda/") ||
      name.includes("sda/") ||
      name.startsWith("sda.")
    )
      return "sda";
    return null;
  }

  async function initDecoder() {
    if (!wasmReady) {
      await initWasm({});
      wasmReady = true;
    }
    if (!zstdReady) {
      await initZstd({});
      zstdReady = true;
    }
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    loading = true;
    error = "";
    resultData = null;
    editingData = "";

    const type = detectTypeFromFile(file);
    if (!type) {
      error = "不支持的文件类型，请确保文件名包含 book、bible 或 sda 路径";
      loading = false;
      return;
    }
    currentType = type;

    try {
      loadingText = "读取文件...";
      await initDecoder();
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      console.log(
        "[LOAD] File:",
        file.name,
        "Size:",
        uint8.length,
        "Magic:",
        Array.from(uint8.slice(0, 4)),
      );

      let parquetBuffer = uint8;
      const isZstd =
        uint8[0] === 0x28 &&
        uint8[1] === 0xb5 &&
        uint8[2] === 0x2f &&
        uint8[3] === 0xfd;

      if (isZstd) {
        loadingText = "解压...";
        parquetBuffer = decompress(uint8);
        console.log(
          "[LOAD] Decompressed size:",
          parquetBuffer.length,
          "Magic:",
          Array.from(parquetBuffer.slice(0, 4)),
        );
      }

      loadingText = "解析...";
      const wasmTable = readParquet(parquetBuffer);
      const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
      const rows = arrowTable.toArray();

      loadingText = "解压内容...";
      const decompressedRows = rows.map((row) => {
        const o = row?.o;
        if (o && typeof o === "string" && o.startsWith("0")) {
          try {
            const compressed = Uint8Array.from(atob(o), (c) => c.charCodeAt(0));
            const decResult = decompress(compressed);
            return { ...row, o: new TextDecoder().decode(decResult) };
          } catch {
            return row;
          }
        }
        return row;
      });

      loadingText = "转换...";
      resultData = groupRows(decompressedRows, type);
      editingData = JSON.stringify(resultData, null, 2);
    } catch (e) {
      error = `解析失败: ${e.message}`;
    } finally {
      loading = false;
      loadingText = "";
      e.target.value = "";
    }
  }

  function detectType(urlStr) {
    const lower = urlStr.toLowerCase();
    if (
      lower.includes("/book/") ||
      lower.includes("book/") ||
      lower.includes("book.")
    )
      return "book";
    if (
      lower.includes("/bible/") ||
      lower.includes("bible/") ||
      lower.includes("bible.")
    )
      return "bible";
    if (
      lower.includes("/sda/") ||
      lower.includes("sda/") ||
      lower.includes("sda.")
    )
      return "sda";
    return null;
  }

  function groupRows(rows, type) {
    if (type === "bible") {
      const chapters = [];
      let cur = null,
        verseId = 1;
      for (const row of rows) {
        if (!cur || cur.id !== row.n) {
          if (cur) chapters.push(cur);
          cur = { id: row.n, verses: [] };
          verseId = 1;
        }
        cur.verses.push({ id: verseId++, c: row.o });
      }
      if (cur) chapters.push(cur);
      return chapters;
    }
    if (type === "sda") {
      const chapters = [];
      let cur = null;
      for (const row of rows) {
        if (!cur || cur.n !== row.n) {
          cur = { n: row.n, ps: [] };
          chapters.push(cur);
        }
        cur.ps.push({ t: row.t, p: row.p, c: row.o });
      }
      return chapters;
    }
    const chapters = [];
    let cur = null;
    for (const row of rows) {
      if (!cur || cur.n !== row.n) {
        cur = { n: row.n, ps: [] };
        chapters.push(cur);
      }
      cur.ps.push({ o: row.o });
    }
    return chapters;
  }

  async function handleUrl() {
    if (!url) return;
    loading = true;
    error = "";
    resultData = null;
    editingData = "";

    const type = detectType(url);
    if (!type) {
      error = "不支持的文件类型，请使用 book、bible 或 sda 路径";
      loading = false;
      return;
    }
    currentType = type;

    try {
      loadingText = "获取...";
      await initDecoder();
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      loadingText = "解压...";
      const buffer = await resp.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const parquetBuffer = decompress(uint8);

      loadingText = "解析...";
      const wasmTable = readParquet(parquetBuffer);
      const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
      const rows = arrowTable.toArray();

      loadingText = "解压内容...";
      const decompressedRows = rows.map((row) => {
        const o = row?.o;
        if (o && typeof o === "string" && o.startsWith("0")) {
          try {
            const compressed = Uint8Array.from(atob(o), (c) => c.charCodeAt(0));
            const decResult = decompress(compressed);
            return { ...row, o: new TextDecoder().decode(decResult) };
          } catch {
            return row;
          }
        }
        return row;
      });

      loadingText = "转换...";
      resultData = groupRows(decompressedRows, type);
      editingData = JSON.stringify(resultData, null, 2);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
      loadingText = "";
    }
  }

  function downloadJson() {
    if (!resultData) return;
    const blob = new Blob([JSON.stringify(resultData, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentType}.json`;
    link.click();
  }

  async function uploadParquet() {
    if (!editingData) return;
    let parsed;
    try {
      parsed = JSON.parse(editingData);
    } catch {
      error = "JSON 格式错误";
      return;
    }

    generating = true;
    error = "";

    try {
      await initDecoder();

      const type = currentType;
      const rows = flattenData(parsed, type);

      const arrays = {
        n: rows.map((r) => r.n),
        o: rows.map((r) => r.o),
      };
      if (type === "sda") {
        arrays.t = rows.map((r) => r.t);
        arrays.p = rows.map((r) => r.p);
      }

      const arrowTable = tableFromArrays(arrays);
      const ipcBytes = tableToIPC(arrowTable, "stream");
      const wasmTable = Table.fromIPCStream(ipcBytes);

      const writerProps = new WriterPropertiesBuilder().build();
      const parquetBytes = writeParquet(wasmTable, writerProps);

      const compressed = compress(parquetBytes, 19);

      const fileName = extractFileName(url) || `${type}.parquet.zst`;
      const blob = new Blob([compressed], { type: "application/octet-stream" });
      const file = new File([blob], fileName, {
        type: "application/octet-stream",
      });

      loadingText = "上传中...";
      const { Key } = await uploadToR2(file, fileName);
      // const { Key } = await uploadToR2(file, "upload/1.parquet.zst");
      console.log({ Key });
      url = `https://r2.lelexue.cn/${Key}`;
      error = "";
    } catch (e) {
      error = `上传失败: ${e.message}`;
    } finally {
      generating = false;
      loadingText = "";
    }
  }

  function flattenData(data, type) {
    const rows = [];
    if (type === "bible") {
      for (const chapter of data) {
        for (const verse of chapter.verses) {
          rows.push({ n: String(chapter.id), o: verse.c });
        }
      }
    } else {
      for (const chapter of data) {
        if (type === "sda") {
          for (const p of chapter.ps) {
            rows.push({ n: chapter.n, o: p.c, t: p.t, p: p.p });
          }
        } else {
          for (const p of chapter.ps) {
            rows.push({ n: chapter.n, o: p.o });
          }
        }
      }
    }
    return rows;
  }

  function formatJson() {
    try {
      const parsed = JSON.parse(editingData);
      editingData = JSON.stringify(parsed, null, 2);
      error = "";
    } catch {
      error = "JSON 格式错误";
    }
  }

  function extractFileName(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.pathname.slice(1);
    } catch {
      return null;
    }
  }
</script>

<svelte:head>
  <title>Parquet 查看器</title>
</svelte:head>

<div class="w-svw h-svh flex flex-col p-4 space-y-3">
  <h1 class="text-lg font-bold">Parquet 查看器</h1>

  <div class="flex gap-2">
    <input
      type="text"
      bind:value={url}
      placeholder="https://.../book/zh/1.parquet.zst"
      class="flex-1 px-2 py-1 border rounded text-sm"
    />
    <button
      onclick={handleUrl}
      disabled={loading || !url}
      class="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
    >
      {loading ? "..." : "加载"}
    </button>
    <input
      bind:this={fileInput}
      type="file"
      onchange={handleFile}
      class="hidden"
    />
    <button
      onclick={() => fileInput?.click()}
      disabled={loading}
      class="px-3 py-1 bg-purple-500 text-white rounded text-sm disabled:opacity-50"
    >
      本地文件
    </button>
  </div>

  {#if loading}
    <div class="text-sm text-gray-500">{loadingText}</div>
  {/if}

  {#if error}
    <div class="text-sm text-red-600">{error}</div>
  {/if}

  {#if resultData}
    <div class="flex-1 flex flex-col overflow-hidden border rounded">
      <div
        class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b"
      >
        <span class="text-sm">{resultData.length} 章节</span>
        <div class="flex gap-2">
          <button
            onclick={formatJson}
            class="px-2 py-1 bg-gray-500 text-white rounded text-xs"
            >格式化</button
          >
          <button
            onclick={downloadJson}
            class="px-2 py-1 bg-indigo-500 text-white rounded text-xs"
            >下载 JSON</button
          >
          <button
            onclick={uploadParquet}
            disabled={generating}
            class="px-2 py-1 bg-green-500 text-white rounded text-xs disabled:opacity-50"
          >
            {generating ? "上传中..." : "上传 R2"}
          </button>
        </div>
      </div>
      <textarea
        bind:value={editingData}
        class="flex-1 p-3 text-xs font-mono resize-none outline-none"
        spellcheck="false"
      ></textarea>
    </div>
  {/if}
</div>
