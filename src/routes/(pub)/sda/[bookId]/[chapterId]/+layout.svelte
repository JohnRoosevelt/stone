<script>
  import SdaChapter from "$lib/global/layout/SdaChapter.svelte";

  const { children, data } = $props();

  let innerWidth = $state(0);
</script>

<svelte:window bind:innerWidth />

{#if innerWidth < 640}
  <SdaChapter {data}>
    {@render children()}
  </SdaChapter>
{:else}
  {@render children()}
{/if}
