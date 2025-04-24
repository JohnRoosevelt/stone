<script>
  import { DIALOG } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";

  const animate = $derived({
    opacity: [0, 1],
    // transform: ["translateY(100%)", "translateY(0)"],
    ...DIALOG.animate,
  });

  const C = $derived(DIALOG.C);
</script>

<Dialog bind:open={DIALOG.SC.show} {animate}>
  <C />
</Dialog>
