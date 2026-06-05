// SvelteKit `$env/static/public` 在 dev 模式无 .env 时会 throw SyntaxError
// (整个 virtual module 无 export 列表) — 用 import.meta.env + fallback
const PUBLIC_R2 = import.meta.env.PUBLIC_R2 || "https://r2.lelexue.cn";
import { dev } from "$app/environment";
import { tableFromArrays, tableToIPC } from "apache-arrow";
import initZstd, { decompress, compress } from "@dweb-browser/zstd-wasm";
import initWasm, {
  readParquet,
  Table,
  WriterPropertiesBuilder,
  writeParquet,
} from "parquet-wasm/esm";

import { readRows, groupRows } from "$lib/parquet-common";

let wasmInitialized = false;
let zstdInitialized = false;

async function ensureWasm() {
  const TIMEOUT = 10000; // 10s

  if (!wasmInitialized) {
    await Promise.race([
      initWasm({}),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("parquet-wasm init timeout")),
          TIMEOUT,
        ),
      ),
    ]);
    wasmInitialized = true;
  }
  if (!zstdInitialized) {
    await Promise.race([
      initZstd({}),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("zstd-wasm init timeout")), TIMEOUT),
      ),
    ]);
    zstdInitialized = true;
  }
}

export async function loadR2Parquet(path, noCache = false) {
  console.log("[Parquet] Loading from R2:", path);
  await ensureWasm();

  try {
    const base = `${PUBLIC_R2}/${path}${path.endsWith(".parquet.zst") ? "" : ".parquet.zst"}`;
    const url = new URL(base);
    if (dev || noCache) url.searchParams.set("t", String(Date.now()));
    const resp = await fetch(url);

    const buffer = await resp.arrayBuffer();
    return await loadParquetContent(buffer);
  } catch (e) {
    console.error("[Parquet] Failed to load:", e);
    return [];
  }
}

export async function loadParquetContent(buffer) {
  await ensureWasm();
  const rows = readRows(buffer, decompress, readParquet);
  return groupRows(rows);
}

// =========================================================================
// Write — build .parquet.zst bytes from rows
// =========================================================================
export async function writeBookParquet(rows) {
  await ensureWasm();
  const arrays = {
    n: rows.map((r) => r.n),
    c: rows.map((r) => r.c),
  };

  const hasT = rows.some((r) => r.t != null);
  const hasP = rows.some((r) => r.p != null);
  if (hasT) arrays.t = new Int32Array(rows.map((r) => r.t ?? 0));
  if (hasP) arrays.p = new Int32Array(rows.map((r) => r.p ?? 0));

  const at = tableFromArrays(arrays);
  const wt = Table.fromIPCStream(tableToIPC(at, "stream"));
  return compress(writeParquet(wt, new WriterPropertiesBuilder().build()), 19);
}
