<script>
  import { page } from "$app/state";

  const title = $derived.by(() => {
    let title;
    switch (page.params.cid) {
      case "bible":
        title = "圣经";
        break;

      case "sda":
        title = "怀著";
        break;

      case "book":
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
  {#if page.params.cid === "bible"}
    <span i-icons-bible></span>
  {:else if page.params.cid === "sda"}
    <span i-icons-sda></span>
  {:else}
    <span i-icons-logo></span>
  {/if}
</section>
