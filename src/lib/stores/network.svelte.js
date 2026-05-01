import { DATAS } from "$lib/data.svelte";

/** 网络状态（与 DATAS 共享同一 reactive 对象） */
export const networkStore = DATAS;
