<script>
  import { page } from "$app/state";
  import { NAV_ITEMS } from "$lib/config";

  /**
   * 判断导航项是否应高亮
   */
  function isActive(item) {
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

{#snippet nav()}
  {#each NAV_ITEMS as item}
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

<!-- only show on mobile -->
<footer
  data-device="mobile"
  class="w-full h-12 text-3 px-8 flex-bc bg-white dark:(bg-black border-gray-700) sm:hidden"
  class:hidden={!page.route.id?.includes("(home)")}
>
  {@render nav()}
</footer>

<!-- only show on desktop -->
<aside class="hidden w-12 bg-white flex-col flex-ac sm:flex dark:(bg-gray-900)">
  {@render nav()}
</aside>
