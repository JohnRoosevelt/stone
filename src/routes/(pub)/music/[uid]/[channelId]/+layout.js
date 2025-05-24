

export async function load({ parent, params }) {
  const { user } = await parent()

  const channel = user.channel[params.channelId]
  console.log({ user, channel });

  return {
    channel
  }
}