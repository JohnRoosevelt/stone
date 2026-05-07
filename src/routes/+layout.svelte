<script>
  import { DATAS } from "$lib/data.svelte";
  import Dialog from "$lib/global/Dialog.svelte";
  import RouteLoading from "$lib/global/RouteLoading.svelte";
  import { setTheme } from "$lib/setTheme.svelte";
  import { handleVisibilityChange, wakeLock } from "$lib/wakeLock";
  import { SvelteToast } from "@zerodevx/svelte-toast";
  import { onMount } from "svelte";

  // $inspect(DATAS).with(console.trace);
  const { children } = $props();
  let innerWidth = $state(0);

  // ── 网络信息管理 ────────────────────────────────────────────
  /** NetworkInformation 对象（可能为 null） */
  let connection = $state(null);

  /** 更新网络状态到全局 store */
  function updateNetworkInfo(netInfo) {
    if (!netInfo) return;
    DATAS.networkType = netInfo.effectiveType || netInfo.type || "unknown";
    DATAS.connectionType = netInfo.type || "unknown";
  }

  // Client-side initialization (runs only in browser, not during SSR)
  onMount(async () => {
    // Theme from localStorage
    DATAS.isDarkMode = localStorage.getItem("theme") == "dark";

    // ── Wake Lock ──
    // 初始加载时没有用户手势，wakeLock() 会静默失败
    // 用户点开文章阅读时才会真正生效（在读者页面会主动调用）
    wakeLock();

    // ── Network Information ──
    connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null;

    if (connection) {
      updateNetworkInfo(connection);
      // 监听网络变化
      connection.addEventListener("change", () => {
        updateNetworkInfo(connection);
      });
    } else {
      DATAS.networkType = "unknown";
      DATAS.connectionType = "unknown";
    }
  });

  $effect(() => {
    DATAS.isDarkMode;
    setTheme(DATAS.isDarkMode ? "dark" : "light");
  });

  $effect(() => {
    DATAS.isMobile = innerWidth < 640;
  });
</script>

<SvelteToast options={{}} />
<RouteLoading />
<Dialog />

<svelte:window bind:online={DATAS.online} bind:innerWidth />
<svelte:document onvisibilitychange={handleVisibilityChange} />

<main
  class="w-screen h-svh overflow-hidden flex-col flex-bc z-0 bg-[#EDF1F0] text-black/85 dark:(bg-[#111615] text-white)"
>
  {@render children()}
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    display: flex;
    overflow: hidden;
  }
</style>
