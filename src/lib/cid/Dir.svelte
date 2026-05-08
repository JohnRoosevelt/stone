<script>
  import { page } from "$app/state";
  import { CID } from "$lib/config";
  import { books } from "$lib/booksStore.svelte.js";
  import BibleDir from "../bible/Dir.svelte";
  import SdaDir from "../sda/BookDir.svelte";

  // Prefer shared store (Tauri mode), otherwise use page.data (Cloudflare mode)
  const bookList = $derived(books.length > 0 ? books : page.data.books || []);
</script>

{#key page.params.cid}
  {@render dir(page.params.cid)}
{/key}

{#snippet dir(cid)}
  {#if cid === CID.BIBLE}
    <BibleDir {bookList} />
  {:else if cid === CID.SDA || cid === CID.BOOKS}
    <SdaDir {bookList} />
  {:else}
    {cid}
  {/if}
{/snippet}
