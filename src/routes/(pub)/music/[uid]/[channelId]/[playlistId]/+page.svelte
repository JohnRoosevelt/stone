<script>
  import { PUBLIC_R2 } from "$env/static/public";
  import { page } from "$app/state";
  import AudioPlayer from "$lib/media/AudioPlayer.svelte";

const src = $derived(
  `${PUBLIC_R2}/media/${page.params.uid - 0 +1}_${page.params.channelId-0 + 1}_${page.params.playlistId-0 + 1}.mp3`,
)

const lyricsDataSrc = $derived(
  `${PUBLIC_R2}/media/${page.params.uid - 0 +1}_${page.params.channelId-0 + 1}_${page.params.playlistId-0 + 1}.json`,
)
</script>

<article w-full h-full relative>
  <AudioPlayer
    {src}
    {lyricsDataSrc}
    title={page.data.media.name}
    onended={() => {}}
  />
</article>