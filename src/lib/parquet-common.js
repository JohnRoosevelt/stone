import { tableFromIPC } from "apache-arrow";

/** Decompress base64+zstd encoded string */
function decStr(str, decompress) {
  try {
    const compressed = Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(decompress(compressed));
  } catch {
    return null;
  }
}

/** zstd decompress → parquet → rows (decompress content, pass n/t/p) */
export function readRows(buffer, decompress, readParquet) {
  const uint8 = new Uint8Array(buffer);
  const wasmTable = readParquet(decompress(uint8));
  const rows = tableFromIPC(wasmTable.intoIPCStream()).toArray();

  return rows.map((row) => {
    const raw = row?.c;
    let text = raw;
    if (raw && typeof raw === "string" && raw.startsWith("0")) {
      const dec = decStr(raw, decompress);
      if (dec !== null) text = dec;
    }
    const rv = { n: row.n, c: text };
    if (row.t != null) rv.t = row.t;
    if (row.p != null) rv.p = row.p;
    return rv;
  });
}

/** Group rows by n into chapters [{ n, ps: [{ c, t?, p? }] }] */
export function groupRows(rows) {
  const chapters = [];
  let cur;
  for (const row of rows) {
    if (!cur || cur.n !== row.n) {
      cur = { n: row.n, ps: [] };
      chapters.push(cur);
    }
    const p = { c: row.c || "" };
    if (row.t != null) p.t = row.t;
    if (row.p != null) p.p = row.p;
    cur.ps.push(p);
  }
  return chapters;
}
