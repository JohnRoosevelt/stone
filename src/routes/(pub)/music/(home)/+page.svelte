<script>
  import AudioPlayer from "$lib/media/AudioPlayer.svelte";
  let curPlayIndex = $state(0);

  const data = {
    cItem: {
      id: 1,
      name: "儿童短讲",
      articles: [
        { id: "01", name: "天地之间有一个你" },
        { id: "02", name: "白天黑夜两个光体" },
        { id: "03", name: "古往今来地貌巨变" },
        { id: "04", name: "挪亚方舟告诉我们" },
        { id: "05", name: "地上鲜花天上彩虹" },
        { id: "06", name: "各国各语中国中文" },
        { id: "07", name: "五谷杂粮蔬菜水果" },
        { id: "08", name: "亚伯拉罕以撒雅各" },
        { id: "09", name: "预言期满的那一天" },
        { id: "10", name: "没鼻子狮身人面像" },
        { id: "11", name: "人类历史年代估算" },
        { id: "12", name: "失落的约柜何时归" },
        { id: "13", name: "过年习俗从何而来" },
        { id: "14", name: "耶和华是医治你的" },
        { id: "15", name: "全人健康八大要素" },
        { id: "16", name: "磐石穴中向主祷告" },
        { id: "17", name: "水雾雨露冰霜雪雹" },
        { id: "18", name: "可以存活永远存活" },
        { id: "19", name: "过约旦河攻耶利哥" },
        { id: "20", name: "要走世人必走的路" },
        { id: "21", name: "你呼唤我我在这里" },
        { id: "22", name: "以利和他两个儿子" },
        { id: "23", name: "今日为证愿他为证" },
        { id: "24", name: "谁想飘摇众树之上" },
      ],
    },
  };

  const src = $derived(
    `https://pub-42fa17a0d06841f295980294e061513c.r2.dev/home/${data.cItem.name}/${data.cItem.articles[curPlayIndex].name}.mp3`,
  );
  const artist = $derived(data.cItem.articles[curPlayIndex].name);
</script>

<svelte:head>
  <title>音乐</title>
</svelte:head>

<div w-full flex-1 flex-col flex-cc>
  <div flex-1 flex-cc>暂无字幕</div>
  <div w-full>
    <AudioPlayer
      {src}
      title={data.cItem?.name}
      {artist}
      onended={() =>
        curPlayIndex == data.cItem.articles.length - 1
          ? (curPlayIndex = 0)
          : curPlayIndex++}
    />
  </div>
</div>
