<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";

  let value = $state("");

  function doSearch() {
    const q = value.trim();
    if (!q) return;
    goto(`/search?q=${encodeURIComponent(q)}`);
  }
</script>

<!-- only show on desktop -->
<header
  class="w-full h-12 px-3 hidden flex-bc hidden bg-white"
  dark="bg-gray-900"
  sm="flex"
>
  <a href="/" data-sveltekit-replacestate flex-cc flex-row gap-2 text-6>
    <span i-icons-logo text-6></span>
    <span>脚前的灯</span>
  </a>

  <div b-px rounded-1 px-2 flex-cc>
    <span i-carbon-search text-gray-400></span>
    <input
      type="text"
      maxlength="100"
      bind:value
      placeholder="输入关键词搜索…"
      class="b-0 ring-0 px-1 outline-0 bg-transparent"
      onkeydown={(e) => {
        if (e.key === "Enter") doSearch();
      }}
    />
  </div>

  <div></div>
</header>
