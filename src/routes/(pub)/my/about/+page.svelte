<script>
  import AboutApp from "../AboutApp.svelte";
  import { safeGoBack } from "$lib";

  function goBack() {
    safeGoBack();
  }
</script>

<svelte:head>
  <title>关于 - 脚前的灯</title>
</svelte:head>

<article w-full h-full flex flex-col>
  <!-- Top bar -->
  <section
    class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
  >
    <button text-5 text-gray-500 aria-label="返回" onclick={goBack}>
      <span i-carbon-arrow-left></span>
    </button>
    <span text-sm font-medium>关于</span>
  </section>

  <!-- Content -->
  <section class="flex-1 overflow-y-auto px-4 py-5 leading-relaxed">
    <AboutApp />
  </section>
</article>
