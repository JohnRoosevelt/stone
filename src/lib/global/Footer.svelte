<script>
  import { page } from "$app/state";
  import Nav from "./Nav.svelte";
  const hidden = $derived(!page.route.id.includes('(home)'))
</script>

<footer data-device="mobile" class="w-full h-12 text-3 px-8 flex-bc" bg="white dark:black" sm="hidden" class:hidden>
  <Nav />
</footer>
