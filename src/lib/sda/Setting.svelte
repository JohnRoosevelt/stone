<script>
  import { DATAS } from "$lib/data.svelte";

  const backgroundColors = [
    {
      mark: false,
      name: "柔和米色",
      value: "#F5F5DC",
      desc: "温暖、接近纸张颜色",
    },
    {
      mark: false,
      name: "浅灰色",
      value: "#F8F9FA",
      desc: "中性、现代，适合高对比度文本",
    },
    {
      mark: false,
      name: "淡绿色",
      value: "#E8F5E9",
      desc: "清新、护眼，模拟自然光",
    },
    {
      mark: false,
      name: "浅杏色",
      value: "#FFF3E0",
      desc: "温暖柔和，适合夜间阅读",
    },
    {
      mark: false,
      name: "淡蓝色",
      value: "#E6F0FA",
      desc: "冷静、舒适，减少蓝光刺激",
    },
  ];
</script>

<section w-full flex-cc flex-col gap-7 py-7>
  <div w-full flex-bc gap-4>
    <p style:font-size="{DATAS.fontSize}px">
      字体大小: {DATAS.fontSize}
    </p>

    <input
      flex-1
      type="range"
      min="12"
      max="24"
      step="1"
      bind:value={DATAS.fontSize}
    />
  </div>

  <div w-full flex-bc gap-4>
    <p>行间距:</p>

    <div>...</div>
  </div>

  <div w-full flex-bc gap-4>
    <p>段间距:</p>

    <div>...</div>
  </div>

  <div w-full flex justify-between gap-px>
    <p
      p-2
      style:background-color={DATAS.bg}
      style="writing-mode: vertical-rl; line-height: 3.5;"
    >
      背景颜色
    </p>

    <div flex-1 flex-cc flex-col gap-4>
      {#each backgroundColors as color}
        <button
          w-full
          flex-bc
          border-1
          rounded-1
          style:border-color={color.value === DATAS.bg
            ? color.value
            : "transparent"}
          onclick={() => {
            DATAS.bg = color.value;
          }}
        >
          <div flex-cc gap-1>
            <span
              inline-block
              size-6
              rounded-r-1
              style:background-color={color.value}
            ></span>
            <span text-14px>{color.name}</span>
          </div>
          <span opacity-85 text-3 pr-1>{color.desc}</span>
        </button>
      {/each}
    </div>
  </div>
</section>
