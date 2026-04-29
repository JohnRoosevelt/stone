<script>
  import { page } from "$app/state";

  const title = $derived.by(() => {
    let title;
    switch (page.params.cid) {
      case "0":
        title = "圣经";
        break;

      case "1":
        title = "怀著";
        break;

      case "2":
        title = "书籍";
        break;

      default:
        break;
    }
    return title;
  });
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<section text-24 text-green>
  {#if page.params.cid === "0"}
    <span i-icons-bible></span>
  {:else if page.params.cid === "1"}
    <span i-icons-sda></span>
  {:else}
    <span i-icons-logo></span>
  {/if}
</section>
