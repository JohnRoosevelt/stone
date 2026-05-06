<script>
  let { cid, lang, bookId } = $props();

  let chapters = $state([]);
  let paragraphs = $state([]);
  let expandedChapter = $state(null);
  let loadingChapters = $state(false);
  let loadingParagraphs = $state(false);

  async function loadChapters() {
    loadingChapters = true;
    chapters = [];
    paragraphs = [];
    expandedChapter = null;
    try {
      const res = await fetch(
        `/api/admin/import?cid=${cid}&lang=${lang}&bookId=${bookId}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      chapters = data.chapters || [];
    } catch (e) {
      chapters = [];
    } finally {
      loadingChapters = false;
    }
  }

  async function toggleChapter(chapterId) {
    if (expandedChapter === chapterId) {
      expandedChapter = null;
      paragraphs = [];
      return;
    }
    expandedChapter = chapterId;
    loadingParagraphs = true;
    paragraphs = [];
    try {
      const res = await fetch(
        `/api/admin/import?cid=${cid}&lang=${lang}&bookId=${bookId}&chapterId=${chapterId}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      paragraphs = data.paragraphs || [];
    } catch (e) {
      paragraphs = [];
    } finally {
      loadingParagraphs = false;
    }
  }

  $effect(() => {
    loadChapters();
  });
</script>

{#if loadingChapters}
  <div class="px-6 py-3 text-xs text-gray-400">加载章节中...</div>
{:else if chapters.length === 0}
  <div class="px-6 py-3 text-xs text-gray-400">数据库中暂无章节数据</div>
{:else}
  <table class="w-full text-xs">
    <tbody>
      {#each chapters as ch}
        <tr
          class="border-t border-gray-100 hover:bg-gray-100/50 transition150 cursor-pointer"
          onclick={() => toggleChapter(ch.chapterId)}
        >
          <td class="pl-10 pr-2 py-2 w-6">
            <span
              class="inline-block transition200 {expandedChapter ===
              ch.chapterId
                ? 'rotate-90'
                : ''}">▸</span
            >
          </td>
          <td
            class="px-2 py-2 font-mono text-gray-400 w-12 tabular-nums whitespace-nowrap"
            >#{ch.chapterId}</td
          >
          <td class="px-2 py-2 font-medium">{ch.title}</td>
          <td
            class="px-2 py-2 text-right font-mono text-gray-500 tabular-nums whitespace-nowrap"
            >{ch.paragraphs} 段</td
          >
        </tr>

        {#if expandedChapter === ch.chapterId}
          <tr>
            <td colspan="4" class="p-0">
              <div class="border-t border-gray-100 bg-white">
                {#if loadingParagraphs}
                  <div class="px-12 py-3 text-xs text-gray-400">
                    加载段落中...
                  </div>
                {:else if paragraphs.length === 0}
                  <div class="px-12 py-3 text-xs text-gray-400">
                    暂无段落数据
                  </div>
                {:else}
                  <div class="max-h-80 overflow-y-auto">
                    {#each paragraphs as p}
                      <!-- {JSON.stringify(p)} -->
                      <div
                        class="flex gap-1.5 px-12 py-1.5 border-t border-gray-50 hover:bg-gray-50 items-baseline"
                      >
                        <span
                          class="text-gray-400 font-mono shrink-0 text-right tabular-nums whitespace-nowrap"
                          >id:{p.id} t:{p.format ?? "-"} p: {p.num ?? "-"}</span
                        >

                        <span class="text-gray-700 min-w-0 flex-1"
                          >{@html p.textContent}</span
                        >
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
{/if}
