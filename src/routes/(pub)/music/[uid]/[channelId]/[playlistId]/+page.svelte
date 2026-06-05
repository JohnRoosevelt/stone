<script>
  // 见 src/lib/tauri.js:1 注释 — $env/static/public 在 dev 无 .env 时 throw
  const PUBLIC_R2 = import.meta.env.PUBLIC_R2 || "https://r2.lelexue.cn";
  import { page } from "$app/state";
  import AudioPlayer from "$lib/media/AudioPlayer.svelte";

  const src = $derived(
    `${PUBLIC_R2}/media/${page.params.uid - 0 + 1}_${page.params.channelId - 0 + 1}_${page.params.playlistId - 0 + 1}.mp3`,
  );

  const lyricsDataSrc = $derived(
    `${PUBLIC_R2}/media/${page.params.uid - 0 + 1}_${page.params.channelId - 0 + 1}_${page.params.playlistId - 0 + 1}.json`,
  );
</script>

<article w-full h-full relative>
  <AudioPlayer
    {src}
    {lyricsDataSrc}
    title={page.data.media?.name}
    onended={() => {}}
  />
</article>
