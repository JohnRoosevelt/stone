<script>
  let value = $state("");
</script>

<header
  class="w-full h-12 px-3 hidden flex-bc hidden bg-white"
  dark="bg-gray-900"
  sm="flex"
>
  <div>
    <span i-icons-logo text-6></span>
  </div>

  <div b-px rounded-1 px-2 focus="bg-red">
    <span i-carbon-search></span>
    <input
      type="text"
      maxlength="100"
      bind:value
      placeholder="输入搜索"
      class="b-0 ring-0 px-1 outline-0"
      focus=""
    />
  </div>

  <div>user</div>
</header>
