// Music playlistId page - prerender with known entries
import media from "$lib/media/media.json";

export const entries = () =>
  media.flatMap((user, uid) =>
    user.channel.flatMap((ch, cid) =>
      ch.playlist.map((_, pid) => ({
        uid: uid.toString(),
        channelId: cid.toString(),
        playlistId: pid.toString(),
      })),
    ),
  );
