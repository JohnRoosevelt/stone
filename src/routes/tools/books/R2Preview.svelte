<script>
  let { cid, lang, bookId, bookName, onclose } = $props();

  let loading = $state(true);
  let rawJson = $state("");
  let error = $state("");
  let uploading = $state(false);
  let uploadMsg = $state("");

  async function loadData() {
    loading = true;
    error = "";
    rawJson = "";
    try {
      const { loadR2Parquet } = await import("$lib/parquet");
      const chapters = await loadR2Parquet(`${cid}/${lang}/${bookId}`);
      rawJson = JSON.stringify(chapters, null, 2);
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function uploadToR2() {
    uploading = true;
    uploadMsg = "";
    error = "";
    try {
      let data;
      try {
        data = JSON.parse(rawJson);
      } catch {
        throw new Error("Invalid JSON");
      }
      const { writeBookParquet } = await import("$lib/parquet");
      const compressed = await writeBookParquet(data);
      const { uploadToR2 } = await import("$lib/r2-upload");
      const fileName = `${cid}/${lang}/${bookId}.parquet.zst`;
      await uploadToR2(new File([compressed], fileName, { type: "application/octet-stream" }), fileName);
      uploadMsg = "Uploaded successfully ✓";
    } catch (e) {
      error = e.message;
    } finally {
      uploading = false;
    }
  }

  $effect(() => { loadData(); });
</script>

<div class="border-t border-gray-200 bg-white">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-2 bg-gray-50/50 border-b border-gray-100">
    <span class="text-xs font-medium text-gray-500">
      R2 Preview — {bookName || bookId}
    </span>
    <div class="flex items-center gap-2">
      {#if !loading && rawJson}
        <button
          onclick={uploadToR2}
          disabled={uploading}
          class="px-2.5 py-1 rounded text-xs font-medium bg-green text-white hover:bg-green/80 disabled:opacity-50 transition150"
        >
          {uploading ? "Uploading..." : "Upload to R2"}
        </button>
      {/if}
      <button
        onclick={onclose}
        class="px-2 py-1 rounded text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition150"
      >✕</button>
    </div>
  </div>

  {#if uploadMsg}
    <div class="px-4 py-1.5 text-xs text-green bg-green/5 border-b">{uploadMsg}</div>
  {/if}

  {#if error}
    <div class="px-4 py-2 text-xs text-red bg-red/5">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-8 text-xs text-gray-400">Loading R2 data...</div>
  {:else}
    <textarea
      class="w-full p-3 text-xs font-mono border-0 resize-none focus:outline-none"
      style="min-height: 200px; max-height: 400px;"
      bind:value={rawJson}
    ></textarea>
  {/if}
</div>
