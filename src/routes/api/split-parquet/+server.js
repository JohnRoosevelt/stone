import { json } from "@sveltejs/kit";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import initWasm, { readParquet } from "parquet-wasm/esm";
import { tableFromIPC } from "apache-arrow";
import initZstd, { decompress } from "@dweb-browser/zstd-wasm";

let _init = false;
let _client = null;
let _bucket = null;

async function _ensure(platform) {
  if (!_init) {
    await initWasm({});
    await initZstd({});
    const raw = platform?.env?.R2;
    if (raw) {
      const [id, key, secret, bucket] = raw.split(",");
      _client = new S3Client({
        region: "auto",
        endpoint: `https://${id}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: key, secretAccessKey: secret },
        forcePathStyle: true,
      });
      _bucket = bucket;
    }
    _init = true;
  }
}

/** GET /api/split-parquet?cid=0&lang=zh&bookId=1 */
export async function GET({ url, platform }) {
  const cid = parseInt(url.searchParams.get("cid"), 10);
  const bookId = parseInt(url.searchParams.get("bookId"), 10);
  const lang = url.searchParams.get("lang") || "zh";

  if (isNaN(cid) || isNaN(bookId)) {
    return json({ error: "Invalid params" }, { status: 400 });
  }

  try {
    await _ensure(platform);

    const CID_SLUG = { 0: "bible", 1: "sda", 2: "book" };
    const keysToTry = [
      `${cid}/${lang}/${bookId}.parquet.zst`,
      `${CID_SLUG[cid]}/${lang}/${bookId}.parquet.zst`,
    ];

    let buffer = null;
    for (const Key of keysToTry) {
      try {
        if (_client && _bucket) {
          const resp = await _client.send(new GetObjectCommand({ Bucket: _bucket, Key }));
          const chunks = [];
          for await (const chunk of resp.Body) chunks.push(chunk);
          buffer = Buffer.concat(chunks);
        } else {
          const publicUrl = `https://r2.lelexue.cn/${Key}`;
          const resp = await fetch(publicUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const arr = await resp.arrayBuffer();
          buffer = Buffer.from(arr);
        }
        break;
      } catch { /* try next key */ }
    }

    if (!buffer) throw new Error(`Not found: ${keysToTry.join(", ")}`);

    const parquetBuffer = decompress(new Uint8Array(buffer));
    const wasmTable = readParquet(parquetBuffer);
    const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
    const rows = arrowTable.toArray();

    // Group by chapter
    const chapterMap = new Map();
    for (const row of rows) {
      const ch = String(row.n ?? "");
      if (!chapterMap.has(ch)) chapterMap.set(ch, []);
      chapterMap.get(ch).push({ n: row.n, o: row.o, t: row.t, p: row.p });
    }

    const chapters = [];
    for (const [id, chRows] of chapterMap) {
      const sample = chRows.slice(0, 3).map((r) => {
        if (cid === 1) return { c: r.o, f: r.t, n: r.p };
        return { c: r.o };
      });
      chapters.push({ id, rowCount: chRows.length, sample, rows: chRows });
    }
    chapters.sort((a, b) => Number(a.id) - Number(b.id));

    return json({ cid, bookId, lang, bookKey: Key, chapters, totalRows: rows.length });
  } catch (e) {
    return json({ error: e.message }, { status: 500 });
  }
}
