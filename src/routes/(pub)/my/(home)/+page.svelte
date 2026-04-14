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
      <span text-xs font-mono>{ua.device?.type}</span>
      <span text-xs font-mono>{ua.device?.vendor}</span>
      <span text-xs font-mono>{ua.device?.model}</span>
    </div>

    <div>
      <span>os:</span>
      <span text-xs font-mono>{ua.os?.name}</span>
      <span text-xs font-mono>{ua.os?.version}</span>
    </div>

    <div>
      <span>cpu:</span>
      <span text-xs font-mono>{ua.cpu?.architecture}</span>
    </div>

    <div>
      <span>browser:</span>
      <span text-xs font-mono>{ua.browser?.name}</span>
      <span text-xs font-mono>{ua.browser?.version}</span>
      <span text-xs font-mono>{ua.browser?.major}</span>
      <span text-xs font-mono>{ua.browser?.type}</span>
    </div>

    <div>
      <span>engine:</span>
      <span text-xs font-mono>{ua.engine?.name}</span>
      <span text-xs font-mono>{ua.engine?.version}</span>
    </div>

    <div>
      <span>sqlite version:</span>
      <span text-xs font-mono>{DATAS.dbInfo.version}</span>
      <span text-xs font-mono>OPFS: {DATAS.dbInfo.hasOPFS}</span>
    </div>
  </section>
</article>
