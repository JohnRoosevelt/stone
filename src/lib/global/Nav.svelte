<script>
  import { page } from "$app/state";
  import { DATAS } from "$lib/data.svelte";
  import { NAV_ITEMS } from "$lib/config";

  /** Filter out appOnly items when not in Tauri mode */
  const VISIBLE_ITEMS = $derived(
    NAV_ITEMS.filter((item) => !item.appOnly || DATAS.isTauri),
  );

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

<!-- only show on mobile home page -->
<footer
  data-device="mobile"
  class={[
    "w-full text-3 px-6 flex-bc bg-white dark:(bg-black border-gray-700) sm:hidden transition300 overflow-hidden",
    page.route.id?.includes("(home)") ? "h-12" : "h-0",
  ]}
>
  {@render nav(VISIBLE_ITEMS)}
</footer>

<!-- only show on desktop -->
<aside class="hidden w-12 bg-white flex-col sm:flex-ac dark:(bg-gray-900)">
  {@render nav(VISIBLE_ITEMS)}
</aside>
