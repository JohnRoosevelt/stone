<script>
  import { page } from "$app/state";
</script>

<svelte:head>
  <title>错误 {page.status} - 脚前的灯</title>
</svelte:head>

<h1>{page.status}: {page.error.message}</h1>
