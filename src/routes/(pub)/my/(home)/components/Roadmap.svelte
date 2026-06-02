<script>
  const roadmap = [
    {
      title: "线上搜索",
      desc: "已支持线上全文搜索",
      done: true,
    },
    {
      title: "搜索优化 + KV",
      desc: "引入 Cloudflare KV 缓存，优化关键字查找性能",
      done: true,
    },
    {
      title: "App 发布",
      desc: "打包为 Tauri 桌面/移动应用，支持离线存储",
      done: true,
    },
  ];

  let open = $state(false);
</script>

<div
  class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
>
  <button
    class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
    onclick={() => (open = !open)}
  >
    <span flex-cc gap-2>
      <span i-carbon-development text-green></span>
      开发规划
    </span>
    <span
      class="transition300 text-gray-400 {open ? 'rotate-180' : ''}"
      i-carbon-chevron-down
    ></span>
  </button>

  {#if open}
    <div>
      {#each roadmap as item, i}
        <div
          class="flex items-center gap-3 px-4 py-3.5 {i < roadmap.length - 1
            ? 'border-b border-gray-100 dark:border-gray-800'
            : ''}"
        >
          <span
            class="w-6 h-6 rounded-full flex-cc text-xs font-700 flex-shrink-0 {item.done
              ? 'bg-green text-white'
              : 'bg-green/20 text-green'}"
          >
            {#if item.done}
              <span i-carbon-checkmark></span>
            {:else}
              {i + 1}
            {/if}
          </span>
          <div class="min-w-0">
            <div
              class="text-sm font-500 {item.done
                ? 'text-green line-through opacity-60'
                : ''}"
            >
              {item.title}
            </div>
            <div
              class="text-xs {item.done ? 'text-green/60' : 'text-gray-400'}"
            >
              {item.desc}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
