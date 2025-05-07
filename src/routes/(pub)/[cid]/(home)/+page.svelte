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

      default:
        break;
    }
    return title;
  });
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<section bg-gray>
  area only show in pc {page.params.cid}
</section>
