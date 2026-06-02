<script>
  import { openDevtools } from "$lib/tauri";
</script>

<!-- Desktop Tauri only — Android wry backend is a no-op -->
<div
  class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
>
  <button
    class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
    onclick={openDevtools}
  >
    <span class="flex-cc gap-2">
      <span class="i-carbon-debug text-green"></span>
      打开开发者工具
    </span>
    <span class="i-carbon-chevron-right text-gray-400"></span>
  </button>
</div>
