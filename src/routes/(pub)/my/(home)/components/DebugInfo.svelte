<script>
  import { DATAS } from "$lib/data.svelte";
  import { getDbSize } from "$lib/tauri";
  import { formatBuildTime } from "$lib/format.js";

  /** @type {{ appVersion: string }} */
  let { appVersion } = $props();

  let open = $state(false);
  let loadingUa = $state(false);
  let dbSize = $state("");

  $effect(async () => {
    if (DATAS.isTauri) {
      try {
        dbSize = await getDbSize();
      } catch (_) {}
    }
  });

  async function toggle() {
    open = !open;
    if (open && !DATAS.uaInfo?.ua) {
      loadingUa = true;
      try {
        const { UAParser } = await import("ua-parser-js");
        const parser = new UAParser();
        DATAS.uaInfo = parser.getResult();
      } catch (e) {
        console.warn("[UA] parse failed:", e);
      } finally {
        loadingUa = false;
      }
    }
  }
</script>

<div
  class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
>
  <button
    class="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition300"
    onclick={toggle}
  >
    <span class="flex-cc gap-2">
      {#if loadingUa}
        <span class="i-line-md-loading-twotone-loop text-4 animate-spin"
        ></span>
      {:else}
        <span class={["i-carbon-debug", "text-green"]}></span>
      {/if}
      调试信息
    </span>
    <span
      class={[
        "transition300 text-gray-400 i-carbon-chevron-down",
        open && "rotate-180",
      ]}
    ></span>
  </button>

  {#if open}
    <div
      class="px-4 py-3 space-y-1.5 border-t border-gray-100 dark:border-gray-800 text-xs font-mono text-gray-500"
    >
      <div class="flex items-center gap-1">
        <span text-gray-400>network: </span>
        {#if DATAS.online}
          {#if DATAS.connectionType === "wifi"}
            <span i-carbon-wifi class="text-green"></span>
            <span class="text-green">WiFi</span>
          {:else if DATAS.connectionType === "cellular"}
            <span i-carbon-radio></span>
            <span>{DATAS.networkType}</span>
          {:else}
            <span i-carbon-network-3 class="text-green"></span>
            <span>{DATAS.networkType || "在线"}</span>
          {/if}
        {:else}
          <span i-carbon-wifi-off class="text-gray-400"></span>
          <span>离线</span>
        {/if}
      </div>
      <div>
        <span text-gray-400>device: </span>
        {DATAS.uaInfo?.device?.vendor || "-"}
        {DATAS.uaInfo?.device?.model || "-"} ({DATAS.uaInfo?.device?.type ||
          "-"})
      </div>
      <div>
        <span text-gray-400>os: </span>
        {DATAS.uaInfo?.os?.name || "-"}
        {DATAS.uaInfo?.os?.version || ""}
      </div>
      <div>
        <span text-gray-400>browser: </span>
        {DATAS.uaInfo?.browser?.name || "-"}
        {DATAS.uaInfo?.browser?.version || ""}
      </div>
      <div>
        <span text-gray-400>engine: </span>
        {DATAS.uaInfo?.engine?.name || "-"}
        {DATAS.uaInfo?.engine?.version || ""}
      </div>

      <div>
        <span text-gray-400>mode: </span>
        <span
          class:text-green={DATAS.isTauri}
          class:text-blue={!DATAS.isTauri}
        >
          {DATAS.isTauri ? "🧊 Tauri" : "🌐 Web"}
        </span>
      </div>

      <div>
        <span text-gray-400>DB: </span>{dbSize || "..."}
      </div>

      {#if appVersion}
        <div>
          <span text-gray-400>app: </span>
          <span class="text-green font-600">v{appVersion}</span>
        </div>
      {/if}
      <div>
        <span text-gray-400>build: </span>
        {__GIT_COMMIT__}
        <span text-gray-400>
          ({formatBuildTime(__BUILD_TIME__)})
        </span>
      </div>

      <div>
        <span text-gray-400>origin: </span>
        <span class="text-green"
          >{typeof window !== "undefined"
            ? window.location.origin
            : "-"}</span
        >
      </div>
    </div>
  {/if}
</div>
