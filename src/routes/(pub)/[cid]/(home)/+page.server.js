import { CID_LIST } from "$lib/config";

/**
 * Pre-render entries for Tauri static build.
 * Tells SvelteKit which [cid] values to generate __data.json for,
 * so SvelteKit client router doesn't get HTML fallback on navigation.
 */
export const entries = () => CID_LIST.map(({ id }) => ({ cid: id }));
