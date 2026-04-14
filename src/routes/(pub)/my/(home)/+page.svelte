<script>
  import { DATAS } from "$lib/data.svelte";
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
      <span text-xs font-mono>{DATAS.uaInfo?.device?.type}</span>
      <span text-xs font-mono>{DATAS.uaInfo?.device?.vendor}</span>
      <span text-xs font-mono>{DATAS.uaInfo?.device?.model}</span>
    </div>

    <div>
      <span>os:</span>
      <span text-xs font-mono>{DATAS.uaInfo?.os?.name}</span>
      <span text-xs font-mono>{DATAS.uaInfo?.os?.version}</span>
    </div>

    <div>
      <span>cpu:</span>
      <span text-xs font-mono>{DATAS.uaInfo?.cpu?.architecture}</span>
    </div>

    <div>
      <span>browser:</span>
      <span text-xs font-mono>{DATAS.uaInfo?.browser?.name}</span>
      <span text-xs font-mono>{DATAS.uaInfo?.browser?.version}</span>
      <span text-xs font-mono>{DATAS.uaInfo?.browser?.major}</span>
      <span text-xs font-mono>{DATAS.uaInfo?.browser?.type}</span>
    </div>

    <div>
      <span>engine:</span>
      <span text-xs font-mono>{DATAS.uaInfo?.engine?.name}</span>
      <span text-xs font-mono>{DATAS.uaInfo?.engine?.version}</span>
    </div>

    <div>
      <span>sqlite version:</span>
      <span text-xs font-mono>{DATAS.dbInfo?.version}</span>
      <span text-xs font-mono>OPFS: {DATAS.dbInfo?.hasOPFS}</span>
    </div>
  </section>
</article>
