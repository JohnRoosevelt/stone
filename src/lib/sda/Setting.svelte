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

<Dialog bind:open={open.value}>
    <article
      bg="white dark:black"
      fixed
      bottom-0
      left-0
      w-screen
    >
      abc
    </article>
</Dialog>
