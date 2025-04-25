<script>
  import { slide } from "svelte/transition";

  let { isShow = $bindable(false) } = $props();
</script>

{#if isShow}
  <div
    fixed
    z-3
    bottom-0
    left-0
    w-full
    h-12
    flex-bc
    px-8
    transition:slide
    bg="gray-100 dark:gray-900"
  >
    <button>选中整段</button>
    <button>选中整段</button>
    <button
      onclick={() => {
        isShow = false;
      }}>退出</button
    >
  </div>
{/if}
