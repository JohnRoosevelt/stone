<script>
  import { DIALOG } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";

  const animate = $derived({
    opacity: [0, 1],
    transform: DIALOG.SY.b
      ? ["translateY(100%)", "translateY(0)"]
      : ["translateY(-100%)", "translateY(0)"],
    ...DIALOG.SY.animate,
  });

  const C = $derived(DIALOG.SY.c);
</script>

<Dialog bind:open={DIALOG.SY.show} {animate}>
  <article
    bg="white dark:black"
    fixed
    class:bottom-0={DIALOG.SY.b}
    class:rounded-t-4={DIALOG.SY.b}
    class:top-0={!DIALOG.SY.b}
    class:rounded-b-4={!DIALOG.SY.b}
    left-0
    w-screen
    min-h-30
    max-h="[calc(100vh-120px)]"
    scroll-y
    p-4
    flex-cc
  >
    <C />
  </article>
</Dialog>
