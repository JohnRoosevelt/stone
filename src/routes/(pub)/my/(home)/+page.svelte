<script>
  import { DATAS } from "$lib/data.svelte";
  console.log(DATAS.uaInfo);

  const ua = $derived(DATAS.uaInfo || {});
</script>

<svelte:head>
  <title>个人中心</title>
</svelte:head>

<article>
  <section w-full px-5 space-y-2>
    <div>
      <span i-carbon-circle-filled class:text-green={DATAS.online}></span>
      <span>{DATAS.online ? DATAS.networkType : "offline"}</span>
    </div>

    <div>
      <span>device:</span>
      <span>{ua.device?.type}</span>
      <span>{ua.device?.vendor}</span>
      <span>{ua.device?.model}</span>
    </div>

    <div>
      <span>os:</span>
      <span>{ua.os?.name}</span>
      <span>{ua.os?.version}</span>
    </div>

    <div>
      <span>cpu:</span>
      <span>{ua.cpu?.architecture}</span>
    </div>

    <div>
      <span>browser:</span>
      <span>{ua.browser?.name}</span>
      <span>{ua.browser?.version}</span>
      <span>{ua.browser?.major}</span>
      <span>{ua.browser?.type}</span>
    </div>

    <div>
      <span>engine:</span>
      <span>{ua.engine?.name}</span>
      <span>{ua.engine?.version}</span>
    </div>
  </section>
</article>
