<script>
  import { DATAS } from "$lib/data.svelte";
  import { goto } from "$app/navigation";
</script>

<svelte:head>
  <title>个人中心</title>
</svelte:head>

<article>
  <section w-full px-5 space-y-4>
    <h2 text-lg font-semibold>工具</h2>
    <div class="grid grid-cols-2 gap-3">
      <a
        href="/tools/json-parquet"
        class="flex items-center gap-3 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
      >
        <span i-carbon-data-structured text-2xl></span>
        <div>
          <div font-medium>JSON/Parquet</div>
          <div text-sm text-gray-500>数据格式转换工具</div>
        </div>
      </a>
    </div>
  </section>

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
      <span>database:</span>
      <span text-xs font-mono text-gray-400>（待迁移至 Tauri 原生 SQL）</span>
    </div>
  </section>
</article>
