<script>
  import { navigating } from "$app/state";
  import Dialog from "./Dialog.svelte";

  let open = $state(true);
</script>

<Dialog bind:open={navigating.to} autoClose={false}>
  <section flex-cc p-4 bg="white dark:black" text-10 rounded-2>
    <span i-carbon-download></span>
  </section>
</Dialog>

<style>
  span {
    opacity: 0;
    animation: slideDown 2s infinite ease-in-out forwards;
  }

  @keyframes slideDown {
    0% {
      opacity: 0;
      transform: translateY(-30px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
