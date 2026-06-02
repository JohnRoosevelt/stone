<script>
  import { DATAS } from "$lib/data.svelte";
</script>

<section class="space-y-3">
  <h2 class="text-lg font-semibold flex-cc gap-2">
    <span class="i-carbon-settings"></span>
    设置
  </h2>

  <!-- Dark mode -->
  <div
    class="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
  >
    <div class="flex-cc gap-3">
      <span class="i-carbon-sun text-xl"></span>
      <div>
        <div class="font-medium">深色模式</div>
        <div class="text-sm text-gray-500">
          {DATAS.themeMode === "system"
            ? "跟随系统"
            : DATAS.themeMode === "dark"
              ? "深色"
              : "浅色"}
        </div>
      </div>
    </div>
    <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
      <button
        aria-label="切换到浅色模式"
        class="px-3 py-1 rounded-md text-sm transition300"
        class:bg-white={DATAS.themeMode === "light"}
        class:shadow-sm={DATAS.themeMode === "light"}
        class:text-gray-400={DATAS.themeMode !== "light"}
        onclick={() => (DATAS.themeMode = "light")}
      >
        <span class="i-carbon-sun"></span>
      </button>
      <button
        aria-label="切换到深色模式"
        class="px-3 py-1 rounded-md text-sm transition300"
        class:bg-white={DATAS.themeMode === "dark"}
        class:text-black={DATAS.themeMode === "dark"}
        class:shadow-sm={DATAS.themeMode === "dark"}
        class:text-gray-400={DATAS.themeMode !== "dark"}
        onclick={() => (DATAS.themeMode = "dark")}
      >
        <span class="i-carbon-moon"></span>
      </button>
      <button
        aria-label="切换到系统模式"
        class="px-3 py-1 rounded-md text-sm transition300"
        class:bg-white={DATAS.themeMode === "system"}
        class:text-black={DATAS.themeMode === "system"}
        class:shadow-sm={DATAS.themeMode === "system"}
        class:text-gray-400={DATAS.themeMode !== "system"}
        onclick={() => (DATAS.themeMode = "system")}
      >
        <span class="i-carbon-automatic"></span>
      </button>
    </div>
  </div>

  <!-- Font size -->
  <div
    class="p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700"
  >
    <div class="flex-cc gap-3 mb-3">
      <div class="flex-cc gap-1">
        <div class="font-medium">字体大小</div>
        <div class="text-sm text-gray-500">{DATAS.fontSize}px</div>
      </div>
    </div>
    <div class="flex-cc gap-3">
      <button
        class={[
          DATAS.fontSize <= 12 ? "opacity-30" : "",
          "w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex-cc flex-shrink-0",
        ]}
        disabled={DATAS.fontSize <= 12}
        onclick={() => (DATAS.fontSize = Math.max(12, DATAS.fontSize - 2))}
        aria-label="减小字号"
      >
        <span class="i-carbon-subtract text-lg"></span>
      </button>
      <input
        type="range"
        min="12"
        max="28"
        step="1"
        bind:value={DATAS.fontSize}
        class="flex-1 accent-green"
        aria-label="字体大小"
      />
      <button
        class={[
          DATAS.fontSize >= 28 ? "opacity-30" : "",
          "w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex-cc flex-shrink-0",
        ]}
        disabled={DATAS.fontSize >= 28}
        onclick={() => (DATAS.fontSize = Math.min(28, DATAS.fontSize + 2))}
        aria-label="增大字号"
      >
        <span class="i-carbon-add text-lg"></span>
      </button>
    </div>
  </div>
</section>
