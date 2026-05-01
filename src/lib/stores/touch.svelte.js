import { DATAS, TOUCHP as _TOUCHP } from "$lib/data.svelte";

/** 触摸交互信息（与 DATAS 共享同一 reactive 对象） */
export const touchStore = DATAS.touchInfo;

/** 触摸位置 */
export const touchP = _TOUCHP;
