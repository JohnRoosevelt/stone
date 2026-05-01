<script>
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import { CID } from "$lib/config";
  import { DATAS } from "$lib/data.svelte.js";
  import { searchState } from "$lib/bible/searchStore.svelte.js";

  onMount(() => {
    const hash = page.url.hash || window.location.hash;
    if (!hash.startsWith("#zh-")) return;
    const id = hash.slice(1);

    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (!el) return;

      // 滚动到屏幕中间
      el.scrollIntoView({ block: "center", behavior: "smooth" });

      // 整段高亮动画（绿底 + 红虚线框，3 秒后消失）
      el.classList.add("search-highlight");
      setTimeout(() => el.classList.remove("search-highlight"), 3000);

      // 关键字加红色虚线边框（不消失）
      const keyword = searchState.query?.trim();
      if (!keyword) return;

      const regex = new RegExp(
        `(${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodesToReplace = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (regex.test(node.textContent)) {
          nodesToReplace.push(node);
        }
      }
      for (const node of nodesToReplace) {
        const span = document.createElement("span");
        span.innerHTML = node.textContent.replace(
          regex,
          '<mark class="keyword-mark">$1</mark>',
        );
        node.parentNode.replaceChild(span, node);
      }
    });
  });
</script>

<article
  w-full
  space-y-2
  leading="170%"
  style:font-size="{DATAS.fontSize}px"
  style:background={!DATAS.isDarkMode ? DATAS.bg : ""}
>
  {#each page.data.sections as sec, i}
    {@const id = i + 1}
    <!-- { t, p, c } -->
    {@const t = sec.t || 7}
    {@const p = sec.p || id}
    {@const c = sec.c || ""}

    <p
      style:text-indent="calc(var(--spacing) * {(t == 7 && i > 0) ||
      (page.params.cid === CID.BIBLE && i === 0)
        ? parseInt(DATAS.fontSize / 2)
        : 0})"
      style:--before-left={t == 7
        ? `calc(var(--spacing) * -${parseInt(DATAS.fontSize / 2)})`
        : ""}
      id="zh-{id}"
      px-5
      data-lang="zh"
      data-pp={p}
      data-p={(page.params.cid !== CID.BOOKS ? p : p - 1) + "˼"}
      data-i={i}
      class:flex-cc={t == 2 || (i === 0 && page.params.cid !== CID.BIBLE)}
      class:font-700={t == 2 || (i === 0 && page.params.cid !== CID.BIBLE)}
      class:font-500={t == 4}
      class:sticky={t == 4}
      class:top-0={t == 4}
      bg={t == 4 ? "white dark:black" : ""}
      class:relative={t == 7}
      class:z-2={t == 4}
      before={(t == 7 && i > 0) || (page.params.cid === CID.BIBLE && i === 0)
        ? `content-[attr(data-p)] absolute text-green`
        : ""}
    >
      {@html c}
    </p>
  {/each}
</article>

<style>
  p {
    &::before {
      text-indent: var(--before-left);
    }
  }

  /* 整段高亮（绿底 + 红虚线框，3 秒脉动后消失） */
  :global(p.search-highlight) {
    animation: highlight-pulse 3s ease-out forwards;
    border-radius: 4px;
  }

  @keyframes highlight-pulse {
    0% {
      background-color: rgba(74, 222, 128, 0.25);
      border: 2.5px dashed rgba(239, 68, 68, 0.7);
      border-radius: 4px;
    }
    30% {
      background-color: rgba(74, 222, 128, 0.15);
      border: 2.5px dashed rgba(239, 68, 68, 0.4);
      border-radius: 4px;
    }
    70% {
      background-color: rgba(74, 222, 128, 0.05);
      border: 2.5px dashed rgba(239, 68, 68, 0.15);
      border-radius: 4px;
    }
    100% {
      background-color: transparent;
      border: 2.5px dashed transparent;
      border-radius: 4px;
    }
  }

  /* 关键字红色虚线边框（不消失） */
  :global(mark.keyword-mark) {
    border: 1.5px dashed rgba(239, 68, 68, 0.7);
    border-radius: 3px;
    padding: 0 1px;
    background: transparent;
  }
</style>
