<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "./Dialog.svelte";

  let open = {
    get value() {
      return DATAS.test;
    },

    set value(v) {
      DATAS.test = v;
    },
  };
</script>

<Dialog
  bind:open={open.value}
  animate={{
    opacity: [0, 1],
    transform: ["translateX(100%)", "translateX(0%)"],
  }}
>
  <section size-30 flex-cc bg-white rounded-2>test</section>
</Dialog>
