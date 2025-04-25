<script>
  import { page } from "$app/state";
  import { DATAS } from "$lib/data.svelte";
  import { info } from "$lib/global/Toast";
  import { slide } from "svelte/transition";

  let { isShow = $bindable(false) } = $props();
</script>

{#if isShow}
  <div
    absolute
    z-9
    bottom-0
    left-0
    w-full
    h-12
    flex-bc
    px-8
    text="7 green"
    transition:slide
    bg="gray-100 dark:gray-900"
  >
    <button
      aria-label="select"
      onclick={(event) => {
        const target = event.currentTarget;
        const range = document.createRange();
        range.selectNodeContents(target); // 选择目标元素的内容

        const selection = window.getSelection();
        selection.removeAllRanges(); // 清除之前的选择
        selection.addRange(range); // 添加新的选择范围
        // isShow = false;
      }}
    >
      <span i-carbon-select-window></span>
    </button>
    <button
      aria-label="copy"
      onclick={async () => {
        try {
          let selectedText;
          const selection = window.getSelection();
          if (selection.toString()) {
            selectedText = selection.toString();
          }

          const content = `${selectedText}   ${DATAS.touchInfo.pIndex}˼ \n\n —— ${page.data.book.name} ${page.data.titleZh} `;
          console.log({ content });
          await navigator.clipboard.writeText(content);
          info("已复制到剪贴板!");
        } catch (err) {
          console.error("复制失败:", err);
        }
        // isShow = false;
      }}
    >
      <span i-carbon-copy></span>
    </button>
    <button
      aria-label="edit"
      onclick={() => {
        isShow = false;
      }}
    >
      <span i-carbon-edit></span>
    </button>
    <button
      aria-label="close"
      onclick={() => {
        isShow = false;
      }}
    >
      <span i-carbon-close></span>
    </button>
  </div>
{/if}
