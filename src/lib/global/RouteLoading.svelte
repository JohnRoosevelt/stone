<script>
  import { navigating } from "$app/state";
  import { Diamonds } from "svelte-loading-spinners";

  let p = $state(0);

  $effect(() => {
    if (!navigating.to) {
      p = 1;
      return;
    }
    p = 0;
    function next() {
      p += 0.1;
      const remaining = 1 - p;
      if (remaining > 0.15) setTimeout(next, 500 / remaining);
    }
    setTimeout(next, 250);
  });
</script>

{#if navigating.to}
  <section class="fade" flex-col flex-bc>
    <div justify="self-start" w-full h-1>
      <div h-full bg="#5cb85c" style="width: {p * 100}%"></div>
    </div>
    <div flex-1 flex-cc>
      <div bg="white dark:black" size="20" border="1 green/20" inset-shadow="sm green/40" rounded="full" flex-cc>
          <Diamonds size="32" color="green" unit="px" duration="1s" />
      </div>
    </div>
  </section>
{/if}

<style>
  .fade {
    position: fixed;
    width: 100%;
    height: 100%;
    background-color: rgba(255, 255, 255, 0.3);
    /* pointer-events: none; */
    z-index: 999;
    animation: fade 0.4s;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
