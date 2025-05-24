<script>
  import { page } from "$app/state";
  import AudioPlayer from "$lib/media/AudioPlayer.svelte";

const src = $derived(
  `https://pub-42fa17a0d06841f295980294e061513c.r2.dev/media/${page.params.uid - 0 +1}_${page.params.channelId-0 + 1}_${page.params.playlistId-0 + 1}.mp3`,
)

const lyricsDataSrc = $derived(
  `https://pub-42fa17a0d06841f295980294e061513c.r2.dev/media/${page.params.uid - 0 +1}_${page.params.channelId-0 + 1}_${page.params.playlistId-0 + 1}.json`,
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