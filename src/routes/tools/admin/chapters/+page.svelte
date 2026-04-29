<script>
  import { PUBLIC_R2 } from "$env/static/public";
  import { listBooks } from "$lib/admin/api.js";
  import { loadParquetContent } from "$lib/parquet";
  import { importAllToD1 } from "./import-all.js";

  const CID_TO_R2_TYPE = { 0: "bible", 1: "sda", 2: "book" };
  const CID_ARRAY = [
    { value: 0, label: "圣经" },
    { value: 1, label: "怀著" },
    { value: 2, label: "书籍" },
  ];

  // ─── State ─────────────────────────────────────────────────
  let loading = $state(false);
  let error = $state("");
  let success = $state("");

  let books = $state([]);
  let booksLoaded = $state(false);

  let chSelectedCid = $state(0);
  let chSelectedBook = $state(null);
  const r2CurrentType = $derived(
    chSelectedBook ? CID_TO_R2_TYPE[chSelectedBook.cid] : "",
  );
  $effect(() => {
    if (chSelectedBook) {
      loadChapters();
    }
  });
  let chLang = $state("zh");
  let chapters = $state([]);
  let chaptersLoaded = $state(false);
  let chLoadingText = $state("");
  // ─── 批量导入全部 ──────────────────────────────────────────
  let importAllRunning = $state(false);
  let importAllLog = $state([]);
  let importAllTotal = $state({ books: 0, chapters: 0, paragraphs: 0 });

  let r2Url = $state("");
  $effect(() => {
    if (r2CurrentType) {
      r2Url = `${PUBLIC_R2}/${r2CurrentType}/${chLang}/${chSelectedBook.book_id}.parquet.zst`;
    }
  });

  $effect(() => {
    if (r2Url) {
      console.log({ r2Url });
      loadR2Url();
    }
  });

  // 对比 R2 解析数据与 D1 章节数据
  let r2ParsedData = $state([]); // 解析后的章节数据（同 json-parquet 格式
  let chapterComparison = $state([]);

  $effect(() => {
    if (r2ParsedData.length > 0 && chapters.length > 0) {
      chapterComparison = r2ParsedData.map((r2ch, index) => {
        const chapterNum = r2ch.id !== undefined ? Number(r2ch.id) : index + 1;
        const items = r2ch.verses || r2ch.ps || [];
        const inD1 = chapters.some((c) => c.chapter_id === chapterNum);
        return { chapterNum, inD1, r2Count: items.length };
      });
    }
  });

  // 选中了一个章节，查看段落
  let selectedChapter = $state(null);
  let paragraphs = $state([]);
  let paragraphsLoaded = $state(false);

  // 编辑段落内容
  let showParagraphEdit = $state(false);
  let editParagraphData = $state({
    cid: null,
    book_id: null,
    chapter_id: null,
    id: null,
    num: null,
    text_content: "",
    lang_code: "",
  });

  async function loadBooks(cid) {
    if (cid === null || cid === undefined) return;
    loading = true;
    error = "";
    try {
      const data = await listBooks({ cid, lang: chLang, q: "" });
      books = data.books || data || [];
      booksLoaded = true;
      chSelectedBook = books[0];
    } catch (e) {
      error = `加载书籍失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  // ─── R2 URL Load / Parse ──────────────────────────────────
  async function loadR2Url() {
    loading = true;
    error = "";
    r2ParsedData = [];
    chLoadingText = "获取...";

    try {
      chLoadingText = "下载...";
      r2ParsedData = await loadParquetContent({
        cid: r2CurrentType,
        lang: chLang,
        bookId: chSelectedBook.book_id,
      });
      success = `解析完成: ${r2ParsedData?.length} 章`;
      chLoadingText = "";
    } catch (e) {
      error = `加载失败: ${e.message}`;
    } finally {
      loading = false;
      chLoadingText = "";
    }
  }

  // 写入 R2 数据到 D1
  async function saveToD1() {
    if (!chSelectedBook || !r2ParsedData) return;
    error = "";
    success = "";
    loading = true;
    chLoadingText = "写入 D1...";

    const { cid, book_id } = chSelectedBook;
    const lang_code = chLang;

    try {
      let saved = 0;
      // 只写入尚未同步到 D1 的章节
      let pendingCh = 0;
      for (let i = 0; i < r2ParsedData.length; i++) {
        if (chapterComparison[i]?.inD1) continue;
        pendingCh++;
        const ch = r2ParsedData[i];
        const chapter_id = i + 1;

        // 获取章节标题：从已有 chapters 中查找，或自动生成
        let title = ch.n || String(chapter_id);
        const body = JSON.stringify({
          cid,
          book_id,
          chapter_id,
          lang_code,
          title,
        });
        console.log(body);

        // 写入 chapters 表
        const chRes = await fetch("/api/admin/chapters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (!chRes.ok) {
          const err = await chRes.json();
          throw new Error(`写入章节 ${chapter_id} 失败: ${err.error}`);
        }
        {
          // 写入段落
          const items = ch.verses || ch.ps || [];
          for (let j = 0; j < items.length; j++) {
            const text_content = items[j].c || items[j].o || "_";
            const format = items[j].t || null;
            const id = j + 1;
            const num = items[j].p != null ? Number(items[j].p) : null;

            const body = JSON.stringify({
              chapter_id,
              id,
              num,
              book_id,
              cid,
              lang_code,
              text_content,
              format,
            });
            // console.log(body);

            const pRes = await fetch("/api/admin/paragraphs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body,
            });
            if (!pRes.ok) {
              const err = await pRes.json();
              throw new Error(`写入段落失败: ${err.error}`);
            }
            saved++;
          }
        }
      }

      const skippedCh = r2ParsedData.length - pendingCh;
      success = `写入完成: ${pendingCh} 章, ${saved} 段落${skippedCh > 0 ? `（${skippedCh} 章已存在，跳过）` : ""}`;
      chLoadingText = "";

      // 刷新章节列表
      await loadChapters();
    } catch (e) {
      error = `保存失败: ${e.message}`;
    } finally {
      loading = false;
      chLoadingText = "";
    }
  }

  // 从 D1 查询章节列表
  async function loadChapters() {
    if (!chSelectedBook) return;
    loading = true;
    error = "";
    try {
      const { cid, book_id } = chSelectedBook;
      const lang_code = chLang;
      const res = await fetch(
        `/api/admin/chapters?cid=${cid}&book_id=${book_id}&lang_code=${lang_code}`,
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      chapters = Array.isArray(data) ? data : [];
      chaptersLoaded = true;
    } catch (e) {
      error = `加载章节失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  // 查看某个章节的段落
  async function viewChapter(chapter) {
    selectedChapter = chapter;
    paragraphsLoaded = false;
    paragraphs = [];
    loading = true;
    error = "";
    try {
      const { cid, book_id, chapter_id, lang_code } = chapter;
      const res = await fetch(
        `/api/admin/paragraphs?cid=${cid}&book_id=${book_id}&chapter_id=${chapter_id}&lang_code=${lang_code}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      paragraphs = Array.isArray(data) ? data : [];
      paragraphsLoaded = true;
    } catch (e) {
      error = `加载段落失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  // 编辑段落
  function openParagraphEdit(p) {
    editParagraphData = {
      cid: p.cid,
      book_id: p.book_id,
      chapter_id: p.chapter_id,
      id: p.id,
      num: p.num,
      text_content: p.text_content,
      lang_code: p.lang_code,
    };
    showParagraphEdit = true;
  }

  async function saveParagraph() {
    error = "";
    success = "";
    if (!editParagraphData.text_content.trim()) {
      error = "内容不能为空";
      return;
    }
    loading = true;
    try {
      const res = await fetch("/api/admin/paragraphs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editParagraphData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      success = "段落已更新";
      showParagraphEdit = false;
      if (selectedChapter) await viewChapter(selectedChapter);
    } catch (e) {
      error = `保存失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  // 删除段落
  async function deleteParagraph(p) {
    if (!confirm(`确定删除第 ${p.id} 段？`)) return;
    loading = true;
    error = "";
    try {
      const res = await fetch("/api/admin/paragraphs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: p.cid,
          book_id: p.book_id,
          chapter_id: p.chapter_id,
          id: p.id,
          lang_code: p.lang_code,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      success = "段落已删除";
      if (selectedChapter) await viewChapter(selectedChapter);
    } catch (e) {
      error = `删除失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  // 删除章节（级联删除段落）
  async function deleteChapter(ch) {
    if (
      !confirm(
        `确定删除第 ${ch.chapter_id} 章「${ch.title}」？删除后该章节的所有段落也将被删除。`,
      )
    )
      return;
    loading = true;
    error = "";
    try {
      const res = await fetch("/api/admin/chapters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cid: ch.cid,
          book_id: ch.book_id,
          chapter_id: ch.chapter_id,
          lang_code: ch.lang_code,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      success = `章节 ${ch.chapter_id} 已删除`;
      // 如果当前查看的章节正是被删除的章节，清空右侧段落面板
      if (
        selectedChapter?.cid === ch.cid &&
        selectedChapter?.book_id === ch.book_id &&
        selectedChapter?.chapter_id === ch.chapter_id &&
        selectedChapter?.lang_code === ch.lang_code
      ) {
        selectedChapter = null;
        paragraphs = [];
        paragraphsLoaded = false;
      }
      await loadChapters();
    } catch (e) {
      error = `删除失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  // ─── Effects ───────────────────────────────────────────────
  // 选择分类后自动查询书籍列表（300ms 防抖）
  $effect(() => {
    const cid = chSelectedCid;
    const lang = chLang;

    if (cid === null || cid === undefined) return;

    const timer = setTimeout(() => loadBooks(cid), 300);
    return () => clearTimeout(timer);
  });
  // ─── 批量导入全部书籍 ──────────────────────────────────────
  async function handleImportAll() {
    if (
      !confirm(
        "将遍历所有分类（圣经、怀著、书籍）下载 R2 数据并写入 D1，确定继续？",
      )
    )
      return;

    importAllRunning = true;
    importAllLog = [];
    importAllTotal = { books: 0, chapters: 0, paragraphs: 0 };
    error = "";
    success = "";

    try {
      const result = await importAllToD1({
        lang: chLang,
        onProgress: (msg) => {
          importAllLog = [...importAllLog, msg];
        },
      });
      importAllTotal = result;
      success = `批量导入完成：${result.books} 本书、${result.chapters} 章、${result.paragraphs} 段`;
    } catch (e) {
      error = `批量导入失败: ${e.message}`;
    } finally {
      importAllRunning = false;
      if (chSelectedBook) await loadChapters();
    }
  }
</script>

{#if error}
  <div
    class="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
  >
    {error}
  </div>
{/if}

{#if success}
  <div
    class="text-xs text-green-600 bg-green-50 border border-green-200 rounded px-3 py-2"
  >
    {success}
  </div>
{/if}

<div class="w-full flex gap-2 items-center flex-wrap">
  <select bind:value={chSelectedCid} class="px-2 py-1 border rounded text-sm">
    <option value={null}>选择分类</option>
    {#each CID_ARRAY as { value, label }}
      <option {value}>{label}</option>
    {/each}
  </select>

  <select bind:value={chLang} class="px-2 py-1 border rounded text-sm">
    <option value="zh">中文</option>
    <option value="en">英文</option>
  </select>

  {#if chSelectedCid !== null}
    <select
      bind:value={chSelectedBook}
      class="px-2 py-1 border rounded text-sm flex-1"
    >
      {#each books as book}
        <option
          value={{ cid: book.cid, book_id: book.book_id, name: book.name }}
        >
          {book.name}
        </option>
      {/each}
    </select>
  {/if}

  <button
    onclick={loadChapters}
    disabled={!chSelectedBook || loading}
    class="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
  >
    {loading ? "..." : "查询章节"}
  </button>
  <button
    onclick={handleImportAll}
    disabled={importAllRunning || loading}
    class="px-3 py-1 bg-amber-600 text-white rounded text-sm disabled:opacity-50 font-medium"
  >
    {importAllRunning ? "导入中..." : "导入全部"}
  </button>
</div>

<!-- R2 初始化区域（自动生成 URL + 自动解析 + 对比 D1） -->
{#if chSelectedBook}
  <div class="w-full my-3 border rounded p-3 space-y-2 bg-gray-50">
    <div class="flex items-center justify-between">
      <div class="text-xs font-medium text-gray-600">R2 数据预览</div>
    </div>

    <!-- 自动生成的 R2 URL（只读） -->
    <div class="flex items-center gap-2">
      <code
        class="flex-1 text-xs px-2 py-1 bg-white border rounded truncate select-all"
      >
        {r2Url || "请选择书籍"}
      </code>
      {#if r2ParsedData}
        <button
          onclick={saveToD1}
          disabled={loading}
          class="px-3 py-1 bg-green-600 text-white rounded text-sm disabled:opacity-50 whitespace-nowrap"
        >
          {loading && chLoadingText ? chLoadingText : "写入 D1"}
        </button>
      {:else if loading}
        <span class="text-xs text-gray-400 whitespace-nowrap"
          >{chLoadingText || "加载中..."}</span
        >
      {/if}
    </div>

    {#if r2ParsedData}
      <!-- 对比摘要 -->
      <div class="text-xs text-gray-500 flex gap-3">
        <span>已解析: {r2ParsedData.length} 章</span>
        {#if chaptersLoaded && chapters.length > 0}
          {@const synced = chapterComparison.filter((c) => c.inD1).length}
          {@const pending = chapterComparison.filter((c) => !c.inD1).length}
          <span class="text-green-600">D1 已有: {synced} 章</span>
          {#if pending > 0}
            <span class="text-orange-500">待写入: {pending} 章</span>
          {:else}
            <span class="text-gray-400">全部已同步</span>
          {/if}
        {:else}
          <span class="text-gray-400">（查询 D1 章节后可对比）</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<!-- 批量导入进度面板 -->
{#if importAllRunning || importAllLog.length > 0}
  <div class="w-full border rounded bg-gray-50 p-3 max-h-60 overflow-auto">
    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold text-gray-700">
        批量导入进度
        {#if importAllRunning}
          <span class="text-amber-600 ml-2">导入中...</span>
        {:else if importAllTotal.books > 0}
          <span class="text-green-600 ml-2">
            {importAllTotal.books} 本书 · {importAllTotal.chapters} 章 · {importAllTotal.paragraphs}
            段
          </span>
        {/if}
      </span>
      {#if !importAllRunning}
        <button
          onclick={() => {
            importAllLog = [];
          }}
          class="text-xs text-gray-400 hover:text-gray-600">清除</button
        >
      {/if}
    </div>
    {#each importAllLog as line}
      <div
        class="text-xs text-gray-600 font-mono leading-relaxed whitespace-pre-wrap"
      >
        {line}
      </div>
    {/each}
  </div>
{/if}

<!-- 章节列表 / 段落查看 -->
<div class="w-full flex-1 flex gap-3 overflow-hidden">
  <!-- 左侧：章节列表 -->
  <div class="flex-1 overflow-auto border rounded">
    {#if !chSelectedBook}
      <div
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        请选择分类和书籍
      </div>
    {:else if !chaptersLoaded}
      <div
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        点击"查询章节"加载数据
      </div>
    {:else if loading}
      <div
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        加载中...
      </div>
    {:else if chapters.length === 0}
      <div
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        暂无章节数据，请从 R2 初始化
      </div>
    {:else}
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="bg-gray-50 sticky top-0">
            <th class="px-2 py-1.5 text-left w-12">chapter_id</th>
            <th class="px-2 py-1.5 text-left">标题</th>
            <th class="px-2 py-1.5 text-left w-16">段落数</th>
            <th class="px-2 py-1.5 text-left w-16">操作</th>
          </tr>
        </thead>
        <tbody>
          {#each chapters as ch}
            {@const synced = chapterComparison.find(
              (c) => c.chapterNum === ch.chapter_id,
            )}
            <tr
              class="border-t hover:bg-gray-50"
              class:bg-blue-50={selectedChapter?.cid === ch.cid &&
                selectedChapter?.book_id === ch.book_id &&
                selectedChapter?.chapter_id === ch.chapter_id &&
                selectedChapter?.lang_code === ch.lang_code}
            >
              <td class="px-2 py-1.5 font-mono">{ch.chapter_id}</td>
              <td class="px-2 py-1.5">{ch.title}</td>
              <td class="px-2 py-1.5">{synced?.r2Count}</td>
              <td class="px-2 py-1.5 flex space-x-1">
                <button
                  onclick={() => viewChapter(ch)}
                  class="px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs"
                >
                  查看
                </button>
                <button
                  onclick={() => deleteChapter(ch)}
                  class="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs"
                >
                  删除
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- 右侧：段落列表 -->
  <div class="flex-1 overflow-auto border rounded">
    {#if !selectedChapter}
      <div
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        点击左侧章节查看段落
      </div>
    {:else if !paragraphsLoaded}
      <div
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        加载中...
      </div>
    {:else if paragraphs.length === 0}
      <div
        class="flex items-center justify-center h-full text-gray-400 text-sm"
      >
        暂无段落
      </div>
    {:else}
      <div
        class="p-2 border-b bg-gray-50 sticky top-0 flex items-center justify-between"
      >
        <span class="text-xs font-medium">
          第 {selectedChapter.chapter_id} 章 · {paragraphs.length} 段
        </span>
      </div>
      <div class="space-y-1 p-2">
        {#each paragraphs as p}
          <div class="text-xs border rounded p-2 hover:bg-gray-50">
            <div class="flex items-start justify-between gap-2">
              <span class="text-gray-400 font-mono w-8 shrink-0">
                #{p.id}
              </span>
              <span class="flex-1 break-words">{p.text_content}</span>
              <div class="flex gap-1 shrink-0">
                <button
                  onclick={() => openParagraphEdit(p)}
                  class="px-1 py-0.5 bg-indigo-500 text-white rounded text-xs"
                >
                  编辑
                </button>
                <button
                  onclick={() => deleteParagraph(p)}
                  class="px-1 py-0.5 bg-red-500 text-white rounded text-xs"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- 段落编辑对话框 -->
{#if showParagraphEdit}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
    <div class="bg-white rounded shadow-lg p-4 w-full max-w-lg">
      <h3 class="text-sm font-semibold mb-2">编辑段落</h3>
      <textarea
        bind:value={editParagraphData.text_content}
        class="w-full border rounded px-2 py-1 text-sm font-mono min-h-[200px]"
      ></textarea>
      <div class="flex justify-end gap-2 mt-2">
        <button
          onclick={() => {
            showParagraphEdit = false;
          }}
          class="px-3 py-1 border rounded text-sm"
        >
          取消
        </button>
        <button
          onclick={saveParagraph}
          disabled={loading}
          class="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
        >
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  </div>
{/if}
