// Music channelId page - prerender with known entries
import media from "$lib/media/media.json";

export const entries = () =>
  media.flatMap((user, uid) =>
    user.channel.map((_, cid) => ({
      uid: uid.toString(),
      channelId: cid.toString(),
    })),
  );
