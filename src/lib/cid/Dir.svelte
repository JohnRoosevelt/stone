<script>
  import { page } from "$app/state";
  import Dir from "../bible/Dir.svelte";
  import SdaDir from "../sda/BookDir.svelte";
  import BookDir from "../book/BookDir.svelte";
</script>

{#key page.params.cid}
  {@render dir(page.params.cid)}
{/key}

{#snippet dir(cid)}
  {#if cid === "bible"}
    <Dir />
  {:else if cid === "sda"}
    <SdaDir />
  {:else if cid === "book"}
    <BookDir />
  {:else}
    {cid}
  {/if}
{/snippet}
