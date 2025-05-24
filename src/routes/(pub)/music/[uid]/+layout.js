import media from "$lib/media/media.json";

export async function load({parent, params}) {
  return {
    user: media[params.uid]
  }
}