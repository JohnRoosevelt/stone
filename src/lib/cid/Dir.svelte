<script>
  import { page } from "$app/state";
  import Dir from "../bible/Dir.svelte";
  import SdaDir from "../sda/BookDir.svelte";
</script>

{#key page.params.cid}
  {@render dir(page.params.cid)}
{/key}

{#snippet dir(cid)}
  {#if cid === "bible"}
    <Dir />
  {:else if cid === "sda" || cid === "book"}
    <SdaDir />
  {:else}
    {cid}
  {/if}
{/snippet}
