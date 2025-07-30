<script>
  import { DATAS } from "$lib/data.svelte";
  console.log(DATAS.uaInfo);
  
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
      <span>{DATAS.uaInfo.device.type}</span>
      <span>{DATAS.uaInfo.device.vendor}</span>
      <span>{DATAS.uaInfo.device.model}</span>
    </div>

    <div>
      <span>os:</span>
      <span>{DATAS.uaInfo.os.name}</span>
      <span>{DATAS.uaInfo.os.version}</span>
    </div>

    <div>
      <span>cpu:</span>
      <span>{DATAS.uaInfo.cpu.architecture}</span>
    </div>

    <div>
      <span>browser:</span>
      <span>{DATAS.uaInfo.browser.name}</span>
      <span>{DATAS.uaInfo.browser.version}</span>
      <span>{DATAS.uaInfo.browser.major}</span>
      <span>{DATAS.uaInfo.browser.type}</span>
    </div>

    <div>
      <span>engine:</span>
      <span>{DATAS.uaInfo.engine.name}</span>
      <span>{DATAS.uaInfo.engine.version}</span>
    </div>
  </section>
</article>