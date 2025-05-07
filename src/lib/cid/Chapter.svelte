<script>
  import { page } from "$app/state";
  import SdaChapter from "$lib/sda/Chapter.svelte";
  import BibleChapter from "$lib/bible/Chapter.svelte";

  const Chapter = $derived.by(() => {
    let rz;

    switch (page.params.cid) {
      case "bible":
        rz = BibleChapter;
        break;

      case "sda":
        rz = SdaChapter;
        break;

      default:
        break;
    }
    return rz;
  });
</script>

<Chapter />
