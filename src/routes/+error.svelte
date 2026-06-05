<script>
  import { page } from "$app/state";
  import { safeGoBack } from "$lib";
</script>

<svelte:head>
  <title>错误 {page.status} - 脚前的灯</title>
</svelte:head>

<div class="w-full h-full flex-col flex-cc gap-6 px-6 text-center">
  <div class="text-9 font-700 text-green">{page.status}</div>
  <div class="text-6 text-gray-700 dark:text-gray-300">
    {page.error?.message || "出了点问题"}
  </div>
  <p class="text-3 text-gray-500 max-w-md">
    {#if page.status === 404}
      没有找到这个页面。可能链接已过期。
    {:else if page.status === 403}
      你没有访问这个页面的权限。
    {:else}
      请稍后重试，或者返回上一页继续浏览。
    {/if}
  </p>
  <div class="flex gap-3">
    <button
      type="button"
      class="px-4 py-2 rounded-1 b-1 border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition300"
      onclick={() => safeGoBack("/")}
    >
      返回
    </button>
    <a
      href="/"
      data-sveltekit-replacestate
      class="px-4 py-2 rounded-1 bg-green text-white hover:opacity-90 transition300"
    >
      回到首页
    </a>
  </div>
</div>
