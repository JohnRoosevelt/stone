<script>
  import { page } from "$app/state";

  const hidden = $derived(!page.route.id.includes("(home)"));
</script>

{#snippet nav()}
  <a
    href="/"
    data-sveltekit-replacestate
    flex-cc
    flex-col
    class:text-green={page.url.pathname === "/"}
  >
    <span i-carbon-home text-9> </span>
    <span text-xs uppercase class="hidden" sm="block"> 首页 </span>
  </a>

  <a
    href="/sda"
    data-sveltekit-replacestate
    flex-cc
    flex-col
    class:text-green={page.route.id.startsWith("/(pub)/[cid]") &&
      page.params.cid === "sda"}
  >
    <span i-icons-sda text-9> </span>
    <span text-xs uppercase class="hidden" sm="block"> 怀著 </span>
  </a>

  <a
    href="/bible"
    data-sveltekit-replacestate
    flex-cc
    flex-col
    class:text-green={page.route.id.startsWith("/(pub)/[cid]") &&
      page.params.cid === "bible"}
  >
    <span i-icons-bible text-9> </span>
    <span text-xs uppercase class="hidden" sm="block"> 圣经 </span>
  </a>

  <a
    href="/music"
    data-sveltekit-replacestate
    flex-cc
    flex-col
    class:text-green={page.url.pathname === "/music"}
  >
    <span i-carbon-music text-9> </span>
    <span text-xs uppercase class="hidden" sm="block"> 音乐 </span>
  </a>

  <a
    href="/my"
    data-sveltekit-replacestate
    flex-cc
    flex-col
    class:text-green={page.url.pathname === "/my"}
  >
    <span alt="icon" i-carbon-user-settings text-9></span>
    <span text-xs uppercase class="hidden" sm="block"> 我的 </span>
  </a>
{/snippet}

<!-- only show on mobile -->
<!-- only show on tab home -->
<footer
  data-device="mobile"
  class="w-full h-12 text-3 px-8 flex-bc"
  bg="white dark:black"
  sm="hidden"
  class:hidden
>
  {@render nav()}
</footer>

<!-- only show on desktop -->
<aside
  w-12
  bg-white
  flex-col
  flex-ac
  class="hidden"
  dark="bg-gray-900"
  sm="flex"
>
  {@render nav()}
</aside>
