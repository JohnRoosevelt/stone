<script>
  let count = $state(0);
</script>

<h1 w-full text-2xl font-700 text-center pt-4 pb-2>
  Attributify → Class 测试页
</h1>

<section flex-cc flex-col gap-4 p-4>
  <!-- class 合并测试 -->
  <div
    w-40 h-10 rounded-2
    bg-green text-white
    flex-cc
    class="text-sm font-500"
    onclick={() => count++}
  >
    点击计数: {count}
  </div>

  <!-- 纯 attributify 写法（无 class 属性） -->
  <div w-60 h-12 rounded-3 bg-blue text-white flex-cc gap-2>
    <span i-carbon-star text-lg></span>
    <span>纯 attributify 按钮</span>
  </div>

  <!-- variant 变体测试 -->
  <div
    w-60 h-12 rounded-3
    bg-purple text-white flex-cc
    hover:bg-purple-700 hover:scale-105
    transition300
  >
    Hover 变体测试
  </div>

  <!-- flex shortcuts 测试 -->
  <div w-80 h-20 rounded-4 bg-gray-200 dark="bg-gray-800" flex-cc>
    <span text-gray-600 dark="text-gray-300">
      flex-cc / dark 变体测试
    </span>
  </div>

  <!-- 响应式测试 -->
  <div
    w-full sm="w-80" h-16
    rounded-2 bg-orange text-white flex-cc
    sm:text-lg text-sm
  >
    响应式: 手机 vs 桌面
  </div>

  <!-- 密集工具类测试 -->
  <article
    w-full max-w-120
    p-4 space-y-3
    rounded-xl
    bg="white dark:gray-800"
    shadow="sm"
  >
    <h2 text-lg font-700 text-center>各种工具类综合测试</h2>

    <div grid="~ cols-3" gap-2>
      <div p-3 rounded-lg bg-red text-white flex-cc text-sm>
        red
      </div>
      <div p-3 rounded-lg bg-green text-white flex-cc text-sm>
        green
      </div>
      <div p-3 rounded-lg bg-blue text-white flex-cc text-sm>
        blue
      </div>
    </div>

    <div divide-y="1 gray-300" rounded-lg>
      <div p-3 hover:bg-gray-100>第一行</div>
      <div p-3 hover:bg-gray-100>第二行</div>
      <div p-3 hover:bg-gray-100>第三行</div>
    </div>
  </article>
</section>
