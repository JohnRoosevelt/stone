<script>
  const { data } = $props();
  let color = $state('blue')
</script>

<svelte:head>
  <title>首页</title>
</svelte:head>

<article w-full h-full flex-cc>
  <section w-full grid="~ cols-2" px-4 gap-4 justify-items-center sm="grid-cols-4 px-8 gap-8">
    <a data-sveltekit-replacestate href="/bible" w-full h-24 rounded-2 flex-cc border-px hover="border-green text-green">
      圣经
    </a>
    <a data-sveltekit-replacestate href="/sda" w-full h-24 rounded-2 flex-cc border-px hover="border-green text-green">
      预言之灵
    </a>
    <a data-sveltekit-replacestate href="/music" w-full h-24 rounded-2 flex-cc border-px hover="border-green text-green">
      音乐
    </a>
    <a data-sveltekit-replacestate href="/my" w-full h-24 rounded-2 flex-cc border-px hover="border-green text-green">
      用户中心
    </a>
  </section>
  
  
</article>