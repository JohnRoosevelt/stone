<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";
  import Chapter from "./Chapter.svelte";

  const { data } = $props();

  let open = {
    get value() {
      return DATAS.isOpenChapterDir;
    },
    set value(v) {
      DATAS.isOpenChapterDir = v;
    },
  };

  function chapterWrap(node) {
    function handleClick() {
      // console.log(event.target, event.target.tagName);
      if (event.target.tagName === "A") {
        DATAS.isOpenChapterDir = false;
      }
    }

    $effect(() => {
      node.addEventListener("click", handleClick);

      return () => {
        node.removeEventListener("click", handleClick);
      };
    });
  }
</script>

<Dialog
  bind:open={open.value}
  animate={{
    opacity: [0, 1],
    transform: ["translateX(-100%)", "translateX(0)"],
  }}
>
  <article
    fixed
    inset-0
    bg="white"
    w="80vw"
    h-screen
    rounded-r-4
    overflow-hidden
    use:chapterWrap
  >
    <Chapter {data} />
  </article>
</Dialog>
