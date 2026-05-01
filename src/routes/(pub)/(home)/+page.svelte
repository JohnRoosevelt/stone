<script>
  import { HOME_CARDS } from "$lib/config";
</script>

<svelte:head>
  <title>脚前的灯</title>
</svelte:head>

<article w-full h-full flex-cc>
  <section
    w-full
    grid="~ cols-2"
    px-4
    gap-4
    justify-items-center
    sm="grid-cols-4 px-8 gap-8"
  >
    {#each HOME_CARDS as { href, label, icon, color }}
      <a
        {href}
        data-sveltekit-replacestate
        w-full
        h-28
        rounded-2
        flex-cc
        flex-col
        gap-2
        border-px
        border="gray-200 dark:gray-700"
        bg="white dark:gray-900"
        transition300
        class="hover:scale-105 hover:shadow-lg"
        class:hover-border-blue={color === "blue"}
        class:hover-border-green={color === "green"}
        class:hover-border-purple={color === "purple"}
        class:hover-border-orange={color === "orange"}
        class:hover-text-blue={color === "blue"}
        class:hover-text-green={color === "green"}
        class:hover-text-purple={color === "purple"}
        class:hover-text-orange={color === "orange"}
      >
        <span class="{icon} text-7"></span>
        <span text-sm font-500>{label}</span>
      </a>
    {/each}
  </section>
</article>
