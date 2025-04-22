<script>
  import { DATAS } from "$lib/data.svelte";
    import Test from "$lib/global/Test.svelte";
</script>

<p class="bg-red-500 hover:(bg-blue-500 font-700 text-8)">tpl</p>
<p text="red-500 hover:(green-500 8)" hover="bg-blue-500 font-700">tpl</p>
<p bg-red-500>tpl</p>
<p flex-cc text-8>tpl</p>

<div grid="~ cols-8" justify="items-center" text-8 text-blue>
  <span hover="text-red" i-carbon-close></span>
  <span hover="text-red" i-icons-sda></span>
  <span hover="text-red" i-icons-bible></span>
  <span hover="text-red" i-icons-logo></span>
  <span hover="text-red" i-carbon-pause></span>
  <button
    aria-label="test"
    onclick={() => {
      DATAS.test = true;
    }}
  >
    <span hover="text-red" i-carbon-play></span>
  </button>
</div>


<Test />