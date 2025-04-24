<script>
  import { DIALOG } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";

  const animate = $derived({
    opacity: [0, 1],
    transform: DIALOG.SX.l
      ? [`translateX(-100%)`, "translateX(0)"]
      : [`translateX(100%)`, "translateX(0)"],
    ...DIALOG.animate,
  });

  const C = $derived(DIALOG.C);
</script>

<Dialog bind:open={DIALOG.SX.show} {animate}>
  <article
    fixed
    inset-0
    bg="white"
    w="80vw"
    h-screen
    class:rounded-r-4={DIALOG.SX.l}
    class:rounded-l-4={!DIALOG.SX.l}
    class:ml-20vw={!DIALOG.SX.l}
    overflow-hidden
  >
    <C />
  </article>
</Dialog>
