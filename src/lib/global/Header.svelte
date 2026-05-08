<script>
  import { page } from "$app/state";
</script>

<!-- only show on desktop -->
<header
  class="w-full h-12 px-3 max-sm:hidden flex-bc bg-white dark:bg-gray-900 sm:flex"
>
  <a href="/" data-sveltekit-replacestate class="flex-cc flex-row gap-2 text-6">
    <span class="i-icons-logo text-6"></span>
    <span>脚前的灯</span>
  </a>

  {#if !page.url.pathname.startsWith("/search")}
    <a
      href="/search"
      aria-label="打开搜索"
      class="b-px rounded-1 px-2 py-1 flex-cc"
    >
      <span class="i-carbon-search text-gray-400"></span>

      <div
        class="text-sm text-gray-400 b-0 w-full ring-0 px-1 outline-0 bg-transparent cursor-pointer"
      >
        搜索圣经、预言之灵、书籍…
      </div>
    </a>
  {/if}

  <!-- user avatar -->
  <span alt="icon" class="i-carbon-user text-9"></span>
</header>
