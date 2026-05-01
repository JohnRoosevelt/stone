import { PUBLIC_R2 } from "$env/static/public";
import { dev } from "$app/environment";
import { tableFromIPC, tableFromArrays, tableToIPC } from "apache-arrow";
import initZstd, { decompress, compress } from "@dweb-browser/zstd-wasm";
import initWasm, {
  readParquet,
  Table,
  WriterPropertiesBuilder,
  writeParquet,
} from "parquet-wasm/esm";

let wasmInitialized = false;
let zstdInitialized = false;

async function ensureWasm() {
  if (!wasmInitialized) {
    await initWasm({});
    wasmInitialized = true;
  }
  if (!zstdInitialized) {
    await initZstd({});
    zstdInitialized = true;
  }
}

function groupRows(rows, numCid, isChapter = false) {
  const fn = (r) => {
    const rz = { c: r.c || r.o };
    if (["sda", "1"].includes(String(numCid))) {
      rz.t = r.t;
      rz.p = r.p;
    }
    return rz;
  };

  if (isChapter) {
    return rows.map(fn);
  }
  const chapters = [];
  let cur = null;
  for (const row of rows) {
    // console.log({ row });
    if (!cur || cur.n !== row.n) {
      cur = { n: row.n, ps: [] };
      chapters.push(cur);
    }
    cur.ps.push(fn(row));
  }

  return chapters;
}

export async function loadR2Parquet(path) {
  console.log("[Parquet] Loading from R2:", path);
  await ensureWasm();

  try {
    const base = `${PUBLIC_R2}/${path}${path.endsWith(".parquet.zst") ? "" : ".parquet.zst"}`;
    const url = new URL(base);
    if (dev) url.searchParams.set("data", String(Date.now()));
    const resp = await fetch(url);

    const buffer = await resp.arrayBuffer();
    const [numCid, lang, bookId, chapterIdStr = "."] = path.split("/");
    const [chapterId] = chapterIdStr.split(".");
    const resultData = await loadParquetContent(buffer, numCid, !!chapterId);

    return resultData;
  } catch (e) {
    console.error("[Parquet] Failed to load:", e);
    return [];
  }
}

export async function loadParquetContent(buffer, numCid, isChapter = false) {
  const uint8 = new Uint8Array(buffer);
  const parquetBuffer = decompress(uint8);

  const wasmTable = readParquet(parquetBuffer);
  const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
  const rows = arrowTable.toArray();

  const decompressedRows = rows.map((row) => {
    const o = row?.o;
    if (o && typeof o === "string" && o.startsWith("0")) {
      try {
        const compressed = Uint8Array.from(atob(o), (c) => c.charCodeAt(0));
        const decResult = decompress(compressed);
        return { ...row, o: new TextDecoder().decode(decResult) };
      } catch {
        return row;
      }
    }
    return row;
  });

  const resultData = groupRows(decompressedRows, numCid, isChapter);

  console.log({ resultData });

  return resultData;
}

// =========================================================================
// Write — build .parquet.zst bytes from rows
// =========================================================================
export async function writeChapterParquet(rows, type = "sda") {
  await ensureWasm();
  // console.log({ rows, type });
  const arrays = {
    c: rows.map((r) => r.c),
  };
  // t: rows[0]?.t ? new Int32Array(rows.map((r) => r.t)) : undefined,
  // p: rows[0]?.p ? new Int32Array(rows.map((r) => r.p)) : undefined,

  if (["sda", "1"].includes(String(type))) {
    arrays.t = new Int32Array(rows.map((r) => r.t));
    arrays.p = new Int32Array(rows.map((r) => r.p));
  }

  const at = tableFromArrays(arrays);
  const wt = Table.fromIPCStream(tableToIPC(at, "stream"));
  return compress(writeParquet(wt, new WriterPropertiesBuilder().build()), 19);
}

export async function writeBookParquet(rows, type = "sda") {
  await ensureWasm();
  const arrays = {
    n: rows.map((r) => r.n),
    c: rows.map((r) => r.c),
  };

  if (["sda", "1"].includes(String(type))) {
    arrays.t = new Int32Array(rows.map((r) => r.t));
    arrays.p = new Int32Array(rows.map((r) => r.p));
  }

  const at = tableFromArrays(arrays);
  const wt = Table.fromIPCStream(tableToIPC(at, "stream"));
  return compress(writeParquet(wt, new WriterPropertiesBuilder().build()), 19);
}

// =========================================================================
