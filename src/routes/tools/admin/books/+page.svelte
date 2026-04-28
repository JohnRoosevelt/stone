<script>
  import {
    listBooks,
    createBook,
    updateBook,
    deleteBook,
  } from "$lib/admin/api.js";

  let books = $state([]);
  let booksLoaded = $state(false);

  // ─── State ─────────────────────────────────────────────────
  let loading = $state(false);
  let error = $state("");
  let success = $state("");

  let selectedCid = $state(0);
  let searchLang = $state("zh");
  let searchText = $state("");

  let showEdit = $state(false);
  let editMode = $state("add");
  let editData = $state({
    cid: 0,
    book_id: 0,
    section: "",
    featured: 0,
    lang_code: "zh",
    name: "",
    title: "",
    abbreviation: "",
  });

  let showDelete = $state(false);
  let deleteTarget = $state(null);

  let showImport = $state(false);
  let importCid = $state(1);
  let importText = $state("");

  const CID_MAP = { 0: "圣经", 1: "怀著", 2: "书籍" };
  const CID_ARRAY = [
    { value: 0, label: "圣经" },
    { value: 1, label: "怀著" },
    { value: 2, label: "书籍" },
  ];

  async function loadBooks(cid) {
    if (cid === null || cid === undefined) return;
    loading = true;
    error = "";
    try {
      const data = await listBooks({ cid, lang: searchLang, q: searchText });
      books = data.books || data || [];
      booksLoaded = true;
    } catch (e) {
      error = `加载失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  function openAdd() {
    editMode = "add";
    editData = {
      cid: selectedCid ?? 0,
      book_id: 0,
      section: "",
      featured: 0,
      lang_code: "zh",
      name: "",
      title: "",
      abbreviation: "",
    };
    showEdit = true;
  }

  function openEdit(book) {
    editMode = "edit";
    editData = {
      cid: book.cid,
      book_id: book.book_id,
      section: book.section || "",
      featured: book.featured || 0,
      lang_code: searchLang,
      name: book.name || "",
      title: book.title || "",
      abbreviation: book.abbreviation || "",
    };
    showEdit = true;
  }

  function confirmDelete(book) {
    deleteTarget = book;
    showDelete = true;
  }

  async function saveBook() {
    error = "";
    success = "";
    if (!editData.book_id || !editData.name) {
      error = "book_id 和 name 为必填项";
      return;
    }
    loading = true;
    try {
      if (editMode === "add") {
        await createBook(editData);
        success = "添加成功";
      } else {
        await updateBook(editData);
        success = "更新成功";
      }
      showEdit = false;
      await loadBooks(selectedCid);
    } catch (e) {
      error = `保存失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  async function deleteTargetBook() {
    if (!deleteTarget) return;
    error = "";
    success = "";
    loading = true;
    try {
      await deleteBook({
        cid: deleteTarget.cid,
        book_id: deleteTarget.book_id,
      });
      success = "删除成功";
      showDelete = false;
      deleteTarget = null;
      await loadBooks(selectedCid);
    } catch (e) {
      error = `删除失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  function openImport() {
    importCid = selectedCid ?? 1;
    importText = "";
    showImport = true;
  }

  async function importBooks() {
    error = "";
    success = "";
    loading = true;
    try {
      const lines = importText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      let imported = 0;
      for (const line of lines) {
        const parts = line.split(/\s+/);
        const book_id = parseInt(parts[0]);
        if (isNaN(book_id)) continue;
        const name = parts.slice(1).join(" ");
        if (!name) continue;
        await createBook({
          cid: importCid,
          book_id,
          lang_code: "zh",
          name,
          title: "",
        });
        imported++;
      }
      success = `批量导入完成: ${imported}/${lines.length} 条`;
      showImport = false;
      await loadBooks(selectedCid);
    } catch (e) {
      error = `导入失败: ${e.message}`;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    const cid = selectedCid;
    const lang = searchLang;
    const q = searchText;

    if (cid === null || cid === undefined) return;

    // 条件变化自动查询（300ms 防抖，避免搜索词打字时频繁请求）
    const timer = setTimeout(() => loadBooks(cid), 300);
    return () => clearTimeout(timer);
  });
</script>

{#if error}
  <div class="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>
{/if}
{#if success}
  <div class="text-sm text-green-600 bg-green-50 px-3 py-2 rounded">
    {success}
  </div>
{/if}

<!-- 工具栏 -->
<div class="w-full flex gap-2 items-center flex-wrap">
  <select bind:value={selectedCid} class="px-2 py-1 border rounded text-sm">
    <option value={null}>选择分类</option>
    {#each CID_ARRAY as { value, label }}
      <option {value}>{label} (cid={value})</option>
    {/each}
  </select>

  <select bind:value={searchLang} class="px-2 py-1 border rounded text-sm">
    <option value="zh">中文</option>
    <option value="en">英文</option>
  </select>

  <input
    bind:value={searchText}
    placeholder="搜索书名..."
    class="flex-1 min-w-32 px-2 py-1 border rounded text-sm"
  />

  {#if booksLoaded}
    <button
      onclick={openAdd}
      class="px-3 py-1 bg-green-500 text-white rounded text-sm"
    >
      + 新增
    </button>
    <button
      onclick={openImport}
      class="px-3 py-1 bg-purple-500 text-white rounded text-sm"
    >
      批量导入
    </button>
  {/if}
</div>

<!-- 数据表格 -->
{#if selectedCid !== null}
  <div class="w-full flex-1 overflow-auto border rounded">
    <table class="w-full text-xs border-collapse">
      <thead>
        <tr class="bg-gray-50 sticky top-0">
          <th class="px-2 py-1.5 text-left w-12">#</th>
          <th class="px-2 py-1.5 text-left w-16">book_id</th>
          <th class="px-2 py-1.5 text-left">书名</th>
          <th class="px-2 py-1.5 text-left w-16">分组</th>
          <th class="px-2 py-1.5 text-left w-16">推荐</th>
          <th class="px-2 py-1.5 text-left w-24">简称</th>
          <th class="px-2 py-1.5 text-left w-24">操作</th>
        </tr>
      </thead>
      <tbody>
        {#if loading}
          <tr>
            <td colspan="7" class="px-2 py-8 text-center text-gray-400">
              加载中...
            </td>
          </tr>
        {:else if books.length === 0}
          <tr>
            <td colspan="7" class="px-2 py-8 text-center text-gray-400">
              暂无数据
            </td>
          </tr>
        {:else}
          {#each books as book, i}
            <tr class="border-t hover:bg-gray-50">
              <td class="px-2 py-1.5">{i + 1}</td>
              <td class="px-2 py-1.5 font-mono">{book.book_id}</td>
              <td class="px-2 py-1.5">{book.name || "-"}</td>
              <td class="px-2 py-1.5">{book.title || "-"}</td>
              <td class="px-2 py-1.5">
                {#if book.featured}
                  <span class="text-yellow-500">★</span>
                {:else}
                  <span class="text-gray-300">☆</span>
                {/if}
              </td>
              <td class="px-2 py-1.5 font-mono">
                {book.abbreviation || "-"}
              </td>
              <td class="px-2 py-1.5">
                <div class="flex gap-1">
                  <button
                    onclick={() => openEdit(book)}
                    class="px-1.5 py-0.5 bg-indigo-500 text-white rounded text-xs"
                  >
                    编辑
                  </button>
                  <button
                    onclick={() => confirmDelete(book)}
                    class="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs"
                  >
                    删除
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <div class="text-xs text-gray-500">
    {books.length} 本书
    {#if selectedCid === 1}
      · 推荐: {books.filter((b) => b.featured).length} 本
    {/if}
  </div>
{:else}
  <div class="flex-1 flex items-center justify-center text-gray-400 text-sm">
    请先选择分类
  </div>
{/if}

<!-- ════════════════════════════════════════════════════════════ -->
<!-- 弹窗: 书籍编辑/新增 -->
<!-- ════════════════════════════════════════════════════════════ -->
{#if showEdit}
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={(e) => {
      if (e.target === e.currentTarget) showEdit = false;
    }}
  >
    <div
      class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 space-y-4"
    >
      <div class="flex items-center justify-between">
        <h2 class="font-bold">
          {editMode === "add" ? "新增书籍" : "编辑书籍"}
        </h2>
        <button
          onclick={() => (showEdit = false)}
          class="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ✕
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <label class="text-xs text-gray-500 space-y-1">
          CID
          <select
            bind:value={editData.cid}
            class="w-full px-2 py-1 border rounded text-sm"
            disabled={editMode === "edit"}
          >
            {#each CID_ARRAY as { value, label }}
              <option {value}>{label}</option>
            {/each}
          </select>
        </label>

        <label class="text-xs text-gray-500 space-y-1">
          book_id *
          <input
            type="number"
            bind:value={editData.book_id}
            class="w-full px-2 py-1 border rounded text-sm"
            disabled={editMode === "edit"}
          />
        </label>

        <label class="text-xs text-gray-500 space-y-1">
          语言
          <select
            bind:value={editData.lang_code}
            class="w-full px-2 py-1 border rounded text-sm"
          >
            <option value="zh">中文</option>
            <option value="en">英文</option>
          </select>
        </label>

        <label class="text-xs text-gray-500 space-y-1">
          书名 *
          <input
            type="text"
            bind:value={editData.name}
            class="w-full px-2 py-1 border rounded text-sm"
          />
        </label>

        <label class="text-xs text-gray-500 space-y-1">
          分组标题
          <input
            type="text"
            bind:value={editData.title}
            class="w-full px-2 py-1 border rounded text-sm"
          />
        </label>

        <label class="text-xs text-gray-500 space-y-1">
          分组
          <input
            type="text"
            bind:value={editData.section}
            class="w-full px-2 py-1 border rounded text-sm"
          />
        </label>

        <label class="text-xs text-gray-500 space-y-1">
          简称
          <input
            type="text"
            bind:value={editData.abbreviation}
            class="w-full px-2 py-1 border rounded text-sm"
          />
        </label>

        <label class="text-xs text-gray-500 space-y-1">
          推荐
          <select
            bind:value={editData.featured}
            class="w-full px-2 py-1 border rounded text-sm"
          >
            <option value={0}>否</option>
            <option value={1}>是</option>
          </select>
        </label>
      </div>

      <div class="flex justify-end gap-2">
        <button
          onclick={() => (showEdit = false)}
          class="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          onclick={saveBook}
          disabled={loading}
          class="px-3 py-1 bg-blue-500 text-white rounded text-sm disabled:opacity-50"
        >
          {loading ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ════════════════════════════════════════════════════════════ -->
<!-- 弹窗: 删除确认 -->
<!-- ════════════════════════════════════════════════════════════ -->
{#if showDelete && deleteTarget}
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        showDelete = false;
        deleteTarget = null;
      }
    }}
  >
    <div
      class="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4 space-y-4"
    >
      <div class="flex items-center justify-between">
        <h2 class="font-bold">确认删除</h2>
        <button
          onclick={() => {
            showDelete = false;
            deleteTarget = null;
          }}
          class="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ✕
        </button>
      </div>
      <p class="text-sm text-gray-600">
        确定要删除 <strong>{deleteTarget.name}</strong>
        (book_id={deleteTarget.book_id}) 吗？此操作不可撤销。
      </p>
      <div class="flex justify-end gap-2">
        <button
          onclick={() => {
            showDelete = false;
            deleteTarget = null;
          }}
          class="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          onclick={deleteTargetBook}
          disabled={loading}
          class="px-3 py-1 bg-red-500 text-white rounded text-sm disabled:opacity-50"
        >
          {loading ? "删除中..." : "确认删除"}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ════════════════════════════════════════════════════════════ -->
<!-- 弹窗: 批量导入 -->
<!-- ════════════════════════════════════════════════════════════ -->
{#if showImport}
  <div
    class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
    onclick={(e) => {
      if (e.target === e.currentTarget) showImport = false;
    }}
  >
    <div
      class="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4 space-y-4"
    >
      <div class="flex items-center justify-between">
        <h2 class="font-bold">批量导入书籍</h2>
        <button
          onclick={() => (showImport = false)}
          class="text-gray-400 hover:text-gray-600 text-xl leading-none"
        >
          ✕
        </button>
      </div>

      <label class="text-xs text-gray-500 space-y-1">
        目标分类
        <select
          bind:value={importCid}
          class="w-full px-2 py-1 border rounded text-sm"
        >
          {#each CID_ARRAY as { value, label }}
            <option {value}>{label}</option>
          {/each}
        </select>
      </label>

      <label class="text-xs text-gray-500 space-y-1">
        导入内容（每行一个：book_id + 书名）
        <textarea
          bind:value={importText}
          rows="10"
          class="w-full px-2 py-1 border rounded text-sm font-mono"
          placeholder="1 创世记&#10;2 出埃及记&#10;3 利未记"
        ></textarea>
      </label>

      <div class="flex justify-end gap-2">
        <button
          onclick={() => (showImport = false)}
          class="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50"
        >
          取消
        </button>
        <button
          onclick={importBooks}
          disabled={loading || !importText.trim()}
          class="px-3 py-1 bg-purple-500 text-white rounded text-sm disabled:opacity-50"
        >
          {loading ? "导入中..." : "开始导入"}
        </button>
      </div>
    </div>
  </div>
{/if}
