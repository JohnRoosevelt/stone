/**
 * Parquet content loader - fetches and decodes .parquet files from R2
 * Data is zstd compressed in parquet, decompressed on read
 *
 * Usage:
 *   import { loadParquetContent } from "$lib/parquet";
 *   const chapters = await loadParquetContent("bible", 1);
 *
 * Returns chapter array:
 *   Book: [{ o: "<decompressed html>" }, ...]
 */

import { PUBLIC_R2 } from "$env/static/public";
import initWasm, { readParquet } from "parquet-wasm/esm";
import { tableFromIPC } from "apache-arrow";
import { ZSTDDecoder } from "zstddec";

let wasmInitialized = false;
let decoder = null;

async function ensureWasm() {
  if (!wasmInitialized) {
    await initWasm();
    decoder = new ZSTDDecoder();
    await decoder.init();
    wasmInitialized = true;
  }
}

function decompressRow(row) {
  const o = row?.o;
  if (o && typeof o === "string" && o.startsWith("0")) {
    try {
      const compressed = Uint8Array.from(atob(o), (c) => c.charCodeAt(0));
      const decompressed = decoder.decode(compressed);
      return { n: row.n, o: new TextDecoder().decode(decompressed) };
    } catch (e) {
      console.warn("[Parquet] Decompress failed:", e);
    }
  }
  return { n: row.n, o };
}

function groupIntoChapters(rows) {
  const chapters = [];
  let currentChapter = null;

  for (const row of rows) {
    if (!currentChapter || currentChapter.n !== row.n) {
      currentChapter = { n: row.n, ps: [] };
      chapters.push(currentChapter);
    }
    currentChapter.ps.push({ o: row.o });
  }

  return chapters;
}

export async function loadParquetContent(cid, bookId) {
  console.log("[Parquet] Loading from R2:", cid, bookId);
  await ensureWasm();

  const url = `${PUBLIC_R2}/${cid}/zh/${bookId}.parquet.zst?t=${Date.now()}`;
  const resp = await fetch(url);
  const compressedBuffer = new Uint8Array(await resp.arrayBuffer());
  const parquetBuffer = decoder.decode(compressedBuffer);

  return decodeParquet(parquetBuffer);
}

function decodeParquet(parquetBuffer) {
  const wasmTable = readParquet(parquetBuffer);
  const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
  const rows = arrowTable.toArray();
  // console.log("[Parquet] Rows count:", rows.length);

  const decompressed = rows.map(decompressRow);
  const result = groupIntoChapters(decompressed);
  console.log("[Parquet] Chapters:", result.length, "Sample:", result);

  return result;
}
