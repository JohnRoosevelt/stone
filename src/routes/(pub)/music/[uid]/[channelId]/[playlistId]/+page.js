

export async function load({ parent, params }) {
  const { user, channel } = await parent()

  const media = channel.playlist[params.playlistId]
  console.log({ media });

  return {
    media
  }
}