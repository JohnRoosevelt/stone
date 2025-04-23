<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";
</script>

<Dialog
  bind:open={DATAS.isOpenSdaSeting}
  animate={{
    opacity: [0, 1],
    transform: ["translateY(100%)", "translateY(0)"],
  }}
>
  <article
    bg="white dark:black"
    fixed
    bottom-0
    left-0
    w-screen
    min-h-30
    max-h="[calc(100vh-120px)]"
    scroll-y
    rounded-t-4
    p-4
    flex-cc
  >
    
    setting
  </article>
</Dialog>
