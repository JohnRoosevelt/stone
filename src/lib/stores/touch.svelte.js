import { DATAS, TOUCHP as _TOUCHP } from "$lib/data.svelte";

/** Touch interaction information (shares the same reactive object with DATAS) */
export const touchStore = DATAS.touchInfo;

/** Touch position */
export const touchP = _TOUCHP;
