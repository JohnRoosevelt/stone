<script>
  import Chapter from "$lib/sda/Chapter.svelte";

  const { data } = $props();
</script>

<svelte:head>
  <title>{data.book.name} 目录</title>
</svelte:head>

<Chapter {data} />
