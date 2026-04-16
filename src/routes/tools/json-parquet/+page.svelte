<script>
  import { PUBLIC_R2 } from "$env/static/public";

  let mode = $state("extract");
  let cid = $state("book");
  let lang = $state("zh");
  let fileInput = $state(null);
  let fileName = $state("");
  let fileContent = $state("");
  let url = $state("");
  let loading = $state(false);
  let result = $state("");
  let resultData = $state(null);
  let resultFile = $state(null);
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

  async function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    loading = true;
    error = "";
    result = "";
    resultData = null;
    resultFile = null;

    try {
      const text = await file.text();
      fileName = file.name;
      fileContent = text;
      url = "";

      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text);
        resultData = parsed;
        result = `✅ JSON 解析成功\n📄 文件: ${file.name}\n📊 记录数: ${countRecords(parsed)}`;
      } else if (file.name.endsWith(".zst")) {
        result = `📦 ZSTD 压缩文件\n📄 需要服务器端解压\n🔗 可以从 R2 下载并自动转换`;
      } else {
        result = `📄 文件大小: ${(text.length / 1024).toFixed(1)} KB`;
      }
    } catch (e) {
      error = `解析失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  function getUrlExtension(urlStr) {
    try {
      const pathname = new URL(urlStr).pathname;
      const filename = pathname.split("/").pop() || "";
      if (filename.endsWith(".json")) return "json";
      if (filename.endsWith(".parquet.zst") || filename.endsWith(".zst")) return "zst";
      if (filename.endsWith(".parquet")) return "parquet";
      return "unknown";
    } catch {
      return "unknown";
    }
  }

  async function handleUrlLoad() {
    if (!url) return;

    loading = true;
    error = "";
    result = "";
    resultData = null;
    resultFile = null;
    fileName = "";

    try {
      const ext = getUrlExtension(url);
      fileName = url.split("/").pop() || "file";

      if (ext === "json") {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        fileContent = text;

        const parsed = JSON.parse(text);
        resultData = parsed;
        result = `✅ JSON 加载成功\n🔗 ${url}\n📊 记录数: ${countRecords(parsed)}`;
      } else if (ext === "zst" || ext === "parquet") {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();

        resultFile = new Blob([new Uint8Array(arrayBuffer)], { type: "application/octet-stream" });
        result = `✅ Parquet 文件下载成功\n🔗 ${url}\n📦 大小: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB\n\n💡 这是压缩后的 Parquet 文件，转换需要 Node.js`;
      } else {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        fileContent = text;

        try {
          const parsed = JSON.parse(text);
          resultData = parsed;
          result = `✅ 内容加载成功\n🔗 ${url}\n📊 记录数: ${countRecords(parsed)}`;
        } catch {
          result = `✅ 文件加载成功\n📄 大小: ${(text.length / 1024).toFixed(1)} KB\n\n⚠️ 无法识别的文件格式`;
        }
      }
    } catch (e) {
      error = `加载失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  function countRecords(data) {
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0].ps) {
        return data.reduce((sum, ch) => sum + (ch.ps?.length || 0), 0);
      }
      if (data.length > 0 && data[0].verses) {
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

    const jsonStr = JSON.stringify(resultData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${cid}_${lang}_extracted.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function downloadSampleJson() {
    const sample = getSampleJson(cid);
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${cid}_${lang}_sample.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function getSampleJson(type) {
    switch (type) {
      case "book":
        return [
          { n: "第一章", ps: [{ o: "内容1" }, { o: "内容2" }] },
          { n: "第二章", ps: [{ o: "内容3" }] }
        ];
      case "bible":
        return [
          { id: 1, verses: [{ id: 1, c: "经文1" }, { id: 2, c: "经文2" }] },
          { id: 2, verses: [{ id: 1, c: "经文3" }] }
        ];
      case "sda":
        return {
          "0": { n: "第一章", ps: [{ t: 7, p: 0, c: "内容" }] },
          "1": { n: "第二章", ps: [{ t: 7, p: 0, c: "内容" }] }
        };
      default:
        return [];
    }
  }

  async function handleR2Download() {
    if (!cid || !lang) return;

    loading = true;
    error = "";
    result = "";
    resultData = null;
    resultFile = null;

    try {
      const parquetUrl = `${PUBLIC_R2}/${cid}/${lang}/1.parquet.zst`;
      console.log(`[Tools] Downloading: ${parquetUrl}`);

      const resp = await fetch(parquetUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} - 文件可能不存在`);

      const arrayBuffer = await resp.arrayBuffer();
      console.log(`[Tools] Downloaded ${arrayBuffer.byteLength} bytes`);

      result = `✅ R2 下载成功!\n📦 ${parquetUrl}\n📊 大小: ${(arrayBuffer.byteLength / 1024).toFixed(1)} KB\n\n💡 实际转换需要在 Node.js 中使用 parquetjs 库\n📥 可以下载压缩文件备用`;

      resultFile = new Blob([new Uint8Array(arrayBuffer)], { type: "application/octet-stream" });
      fileName = `1.parquet.zst`;
    } catch (e) {
      error = `R2 下载失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  function downloadParquet() {
    if (!resultFile) return;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(resultFile);
    link.download = `${cid}_${lang}.parquet.zst`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function formatData(data) {
    if (!data) return "";

    try {
      return JSON.stringify(data, null, 2).substring(0, 2000);
    } catch {
      return String(data);
    }
  }
</script>

<svelte:head>
  <title>JSON/Parquet 工具</title>
</svelte:head>

<div class="max-w-4xl mx-auto p-6">
  <h1 class="text-2xl font-bold mb-6">JSON/Parquet 工具</h1>

  <div class="grid md:grid-cols-2 gap-6 mb-6">
    <div class="border rounded-lg p-4">
      <h2 class="font-semibold mb-4">选择本地文件</h2>
      <input
        type="file"
        accept=".json,.parquet,.zst,.parquet.zst"
        bind:this={fileInput}
        onchange={handleFileSelect}
        class="w-full"
      />
      <p class="text-sm text-gray-500 mt-2">支持 .json, .parquet, .zst 文件</p>
    </div>

    <div class="border rounded-lg p-4">
      <h2 class="font-semibold mb-4">从 URL 加载</h2>
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={url}
          placeholder="https://.../book/zh/1.json 或 .../1.parquet.zst"
          class="flex-1 px-3 py-2 border rounded"
        />
        <button
          onclick={handleUrlLoad}
          disabled={loading}
          class="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          加载
        </button>
      </div>
    </div>
  </div>

  <div class="flex flex-wrap gap-4 mb-6">
    <select bind:value={cid} class="px-3 py-2 border rounded">
      {#each CID_OPTIONS as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>

    <select bind:value={lang} class="px-3 py-2 border rounded">
      {#each LANG_OPTIONS as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>

    <button
      onclick={handleR2Download}
      disabled={loading}
      class="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
    >
      从 R2 下载 Parquet
    </button>

    <button
      onclick={downloadSampleJson}
      class="px-4 py-2 bg-gray-200 rounded"
    >
      下载样本 JSON
    </button>
  </div>

  {#if loading}
    <div class="text-center py-8">
      <span class="text-gray-500">加载中...</span>
    </div>
  {/if}

  {#if error}
    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
      {error}
    </div>
  {/if}

  {#if result}
    <div class="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded mb-4 whitespace-pre-wrap">
      {result}
    </div>
  {/if}

  {#if resultData}
    <div class="bg-gray-100 border rounded-lg p-4 mb-4">
      <h3 class="font-semibold mb-2">数据预览</h3>
      <pre class="text-sm overflow-auto max-h-64">{formatData(resultData)}</pre>
    </div>

    <button
      onclick={downloadJson}
      class="px-6 py-3 bg-indigo-600 text-white rounded-lg"
    >
      📥 导出为 JSON
    </button>
  {/if}

  {#if resultFile && !resultData}
    <div class="mt-4">
      <button
        onclick={downloadParquet}
        class="px-6 py-3 bg-purple-600 text-white rounded-lg"
      >
        📥 下载 Parquet 文件
      </button>
    </div>
  {/if}

  <div class="mt-8 p-4 bg-blue-50 rounded-lg">
    <h3 class="font-semibold mb-2">💡 说明</h3>
    <ul class="text-sm space-y-1 text-gray-700">
      <li>• <strong>JSON 格式转换</strong> 需要使用 <code>seeds/json-parquet.js</code> 脚本</li>
      <li>• 此工具可以查看 JSON 结构、下载 R2 文件</li>
      <li>• Parquet 实际转换必须在 Node.js 中完成（需要 parquetjs 库）</li>
      <li>• 使用方式: <code>node seeds/json-parquet.js convert book 1 zh</code></li>
    </ul>
  </div>

  <div class="mt-6 border-t pt-4">
    <h3 class="font-semibold mb-2">数据结构说明</h3>
    <div class="grid md:grid-cols-3 gap-4 text-sm">
      <div class="border rounded p-3">
        <strong>Book</strong>
        <pre class="text-xs mt-1 text-gray-600">{`[{ n: "章节", ps: [{o:"内容"}] }]`}</pre>
      </div>
      <div class="border rounded p-3">
        <strong>Bible</strong>
        <pre class="text-xs mt-1 text-gray-600">{`[{ id: 1, verses: [{c:"经文"}] }]`}</pre>
      </div>
      <div class="border rounded p-3">
        <strong>SDA</strong>
        <pre class="text-xs mt-1 text-gray-600">{`{ "0": { n:"章", ps:[{t,p,c}] } }`}</pre>
      </div>
    </div>
  </div>
</div>
