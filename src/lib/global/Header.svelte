<script>
  import { page } from "$app/state";
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

  {#if !page.url.pathname.startsWith("/search")}
    <form
      action="/search"
      method="get"
      class="b-px rounded-1 px-2 py-1 flex-cc flex-1 mx-3"
      role="search"
    >
      <span i-carbon-search text-gray-400></span>
      <input
        type="search"
        name="q"
        placeholder="搜索圣经、预言之灵、书籍…"
        class="text-sm text-gray-400 b-0 w-full ring-0 px-1 outline-0 bg-transparent"
      />
    </form>
  {/if}

  <a
    href="/my"
    aria-label="我的"
    data-sveltekit-replacestate
    class="i-carbon-user text-9"
  ></a>
</header>
