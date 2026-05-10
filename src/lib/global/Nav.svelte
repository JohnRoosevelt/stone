<script>
  import { page } from "$app/state";
  import { DATAS } from "$lib/data.svelte";
  import { NAV_ITEMS } from "$lib/config";

  /** Search nav item (only in APP mode, inserted in the middle on mobile) */
  const SEARCH_ITEM = {
    href: "/search",
    icon: "i-carbon-search",
    label: "搜索",
    matchPrefix: "/search",
  };

  /** Mobile nav: insert SEARCH_ITEM between item 1 (怀著) and item 2 (圣经) */
  const MOBILE_NAV_ITEMS = $derived([
    ...NAV_ITEMS.slice(0, 2),
    ...(DATAS.isTauri ? [SEARCH_ITEM] : []),
    ...NAV_ITEMS.slice(2),
  ]);

  /**
   * Determine whether a nav item should be highlighted
   */
  function isActive(item) {
    if (item.matchPrefix) {
      return page.url.pathname.startsWith(item.matchPrefix);
    }
    if (item.matchExact) {
      return page.url.pathname === item.matchExact;
    }
    if (item.matchCid) {
      return (
        page.route.id?.startsWith("/(pub)/[cid]") &&
        page.params.cid === item.matchCid
      );
    }
    return false;
  }
</script>

{#snippet nav(items)}
  {#each items as item}
    <a
      href={item.href}
      data-sveltekit-replacestate
      class="flex-cc flex-col"
      class:text-green={isActive(item)}
      aria-current={isActive(item) ? "page" : undefined}
    >
      <span class="{item.icon} text-9"></span>
      <span class="hidden text-xs uppercase sm:block"> {item.label} </span>
    </a>
  {/each}
{/snippet}

<!-- only show on mobile home page (5 items, search in the middle) -->
<footer
  data-device="mobile"
  class={[
    "w-full text-3 px-6 flex-bc bg-white dark:(bg-black border-gray-700) sm:hidden transition300 overflow-hidden",
    page.route.id?.includes("(home)") ? "h-12" : "h-0",
  ]}
>
  {@render nav(MOBILE_NAV_ITEMS)}
</footer>

<!-- only show on desktop (original 4 items) -->
<aside class="hidden w-12 bg-white flex-col sm:flex-ac dark:(bg-gray-900)">
  {@render nav(NAV_ITEMS)}
</aside>
