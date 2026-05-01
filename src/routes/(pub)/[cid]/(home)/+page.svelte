<script>
  import { page } from "$app/state";
  import { getCidInfo } from "$lib/config";

  const cidInfo = $derived(getCidInfo(page.params.cid));
  const title = $derived(cidInfo?.name ?? page.params.cid);
  const icon = $derived(cidInfo?.icon ?? "i-icons-logo");
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

<section text-24 text-green>
  <span {icon}></span>
</section>
