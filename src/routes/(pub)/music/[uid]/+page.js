// Music uid page - prerender with known entries
import media from "$lib/media/media.json";

export const entries = () => media.map((_, i) => ({ uid: i.toString() }));
