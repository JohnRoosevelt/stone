<script>
  import { page } from "$app/state";
  import { CID } from "$lib/config";
  import BibleDir from "../bible/Dir.svelte";
  import SdaDir from "../sda/BookDir.svelte";
</script>

{#key page.params.cid}
  {@render dir(page.params.cid)}
{/key}

{#snippet dir(cid)}
  {#if cid === CID.BIBLE}
    <BibleDir />
  {:else if cid === CID.SDA || cid === CID.BOOKS}
    <SdaDir />
  {:else}
    {cid}
  {/if}
{/snippet}
