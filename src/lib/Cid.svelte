<script>
  import { page } from "$app/state";
  import Dir from "./bible/Dir.svelte";
  import BookDir from "./sda/BookDir.svelte";
</script>

{#key page.params.cid}
  {@render dir(page.params.cid)}
{/key}

{#snippet dir(cid)}
  {#if cid === "bible"}
    <Dir />
  {:else if cid === "sda"}
    <BookDir />
  {:else}
    {cid}
  {/if}
{/snippet}
