<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";

  let open = {
    get value() {
      return DATAS.isOpenSdaSeting;
    },
    set value(v) {
      DATAS.isOpenSdaSeting = v;
    },
  };
</script>

<Dialog
  bind:open={open.value}
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
    <button
      absolute
      top-1
      right-1
      aria-label="close"
      onclick={() => {
        DATAS.isOpenSdaSeting = false;
      }}
    >
      <span i-carbon-close font-700 text-6></span>
    </button>
    setting
  </article>
</Dialog>
