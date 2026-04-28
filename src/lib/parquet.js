import { PUBLIC_R2 } from "$env/static/public";
import initWasm, { readParquet } from "parquet-wasm/esm";
import { tableFromIPC } from "apache-arrow";
import initZstd, { decompress } from "@dweb-browser/zstd-wasm";

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

function groupRows(rows, type) {
  if (type === "bible") {
    const chapters = [];
    let cur = null,
      verseId = 1;
    for (const row of rows) {
      if (!cur || cur.id !== row.n) {
        if (cur) chapters.push(cur);
        cur = { id: row.n, verses: [] };
        verseId = 1;
      }
      cur.verses.push({ id: verseId++, c: row.o });
    }
    if (cur) chapters.push(cur);
    return chapters;
  }

  const chapters = [];
  let cur = null;
  for (const row of rows) {
    if (!cur || cur.n !== row.n) {
      cur = { n: row.n, ps: [] };
      chapters.push(cur);
    }
    cur.ps.push({ t: row.t ?? 7, p: row.p, c: row.o });
  }
  return chapters;
}

export async function loadParquetContent({ cid, bookId, lang = "zh" }) {
  console.log("[Parquet] Loading from R2:", cid, bookId, lang);
  await ensureWasm();

  const url = `${PUBLIC_R2}/${cid}/${lang}/${bookId}.parquet.zst`;
  const resp = await fetch(url);

  const buffer = await resp.arrayBuffer();
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

  const resultData = groupRows(decompressedRows, cid);

  console.log({ resultData });

  return resultData;
}
