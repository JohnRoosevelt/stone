import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { tableFromIPC } from "apache-arrow";

// ════════════════════════════════════════════════════════════════
// Cross-platform WASM init:
//   dev (Vite SSR)  → readFileSync + initSync (avoid fetch on file://)
//   prod (CF Workers) → initWasm / initZstd (default, works in worker)
// ════════════════════════════════════════════════════════════════

import {
  readParquet,
  initSync as initParquetSync,
  default as initParquet,
} from "parquet-wasm/esm";
import {
  decompress,
  initSync as initZstdSync,
  default as initZstd,
} from "@dweb-browser/zstd-wasm";

import { readRows, groupRows } from "$lib/parquet-common";

// ── Detect Node.js (dev) vs CF Workers (prod) ──────────────
const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

let _wasmInit = false;

async function ensureWasm() {
  if (_wasmInit) return;
  _wasmInit = true;

  if (isNode) {
    const { readFileSync } = await import("node:fs");
    const { createRequire } = await import("node:module");
    const _require = createRequire(import.meta.url);

    console.log("[r2-parquet] WASM init (Node): reading files directly");

    initParquetSync({
      module: readFileSync(
        _require.resolve("parquet-wasm/esm/parquet_wasm_bg.wasm"),
      ),
    });
    initZstdSync({
      module: readFileSync(
        _require.resolve("@dweb-browser/zstd-wasm/zstd_wasm_bg.wasm"),
      ),
    });

    console.log("[r2-parquet] WASM init (Node): done ✓");
  } else {
    console.log("[r2-parquet] WASM init (Workers): calling default init");
    await Promise.all([initParquet({}), initZstd({})]);
    console.log("[r2-parquet] WASM init (Workers): done ✓");
  }
}

// ─── R2 S3 client singleton ────────────────────────────────
let _client = null;
let _bucket = null;

function getS3Client(platform) {
  const raw = platform?.env?.R2;
  if (!raw) return null;
  const [id, key, secret, bucket] = raw.split(",");
  _client ??= new S3Client({
    region: "auto",
    endpoint: `https://${id}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: key, secretAccessKey: secret },
    forcePathStyle: true,
  });
  _bucket ??= bucket;
  console.log("[r2-parquet] R2 S3 client initialized, bucket:", _bucket);
  return _client;
}

async function fetchParquetBuffer(platform, cid, lang, bookId) {
  const Key = `${cid}/${lang}/${bookId}.parquet.zst`;
  console.log("[r2-parquet] Fetching parquet file:", Key);

  const client = getS3Client(platform);
  const bucket = _bucket;

  try {
    if (client && bucket) {
      console.log("[r2-parquet] Trying S3 getObject:", Key);
      const resp = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key }),
      );
      const chunks = [];
      for await (const chunk of resp.Body) chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      console.log(
        "[r2-parquet] S3 success:",
        Key,
        `(${(buf.length / 1024).toFixed(1)} KB)`,
      );
      return buf;
    } else {
      const publicUrl = `https://r2.lelexue.cn/${Key}`;
      console.log("[r2-parquet] Trying public URL:", publicUrl);
      const resp = await fetch(publicUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arr = await resp.arrayBuffer();
      const buf = Buffer.from(arr);
      console.log(
        "[r2-parquet] Public URL success:",
        publicUrl,
        `(${(buf.length / 1024).toFixed(1)} KB)`,
      );
      return buf;
    }
  } catch (e) {
    console.log("[r2-parquet] S3 fetch failed:", Key, e.message);
    throw e;
  }
}

/** Parse parquet → rows → chapters → DB insert format */
async function parseBook(buffer, cid) {
  console.log(
    "[r2-parquet] Parsing parquet, size:",
    (buffer.length / 1024).toFixed(1),
    "KB, cid:",
    cid,
  );

  await ensureWasm();

  const rows = readRows(buffer, decompress, readParquet);
  console.log("[r2-parquet] Total rows:", rows.length);

  if (rows.length > 0) {
    const sample = rows.slice(0, 3).map((r) => ({
      keys: Object.keys(r),
      n: r.n,
      c: typeof r.c === "string" ? r.c.slice(0, 60) : r.c,
      o: typeof r.o === "string" ? r.o.slice(0, 60) : r.o,
      t: r.t,
      p: r.p,
    }));
    console.log("[r2-parquet] First 3 rows:", JSON.stringify(sample, null, 2));
  }

  const grouped = groupRows(rows);
  console.log("[r2-parquet] Chapters found:", grouped.length);

  // Map to DB insert format
  const chapters = grouped.map((ch, idx) => {
    const numericId = Number(ch.n);
    const chapterId = idx + 1;
    const title = String(ch.n);

    const paragraphs = ch.ps.map((p, i) => {
      return {
        id: i + 1,
        textContent: p.c || "",
        num: p.p != null ? Number(p.p) : null,
        format: p.t != null ? Number(p.t) : null,
      };
    });

    return { chapterId, title, paragraphs };
  });

  const totalParagraphs = chapters.reduce(
    (s, ch) => s + ch.paragraphs.length,
    0,
  );
  console.log(
    "[r2-parquet] Grouped:",
    chapters.length,
    "chapters,",
    totalParagraphs,
    "paragraphs",
  );

  return chapters;
}

/**
 * Load & parse a book's full data from R2 (server-side)
 *
 * @param {object}  platform — SvelteKit platform (env.R2, env.DB)
 * @param {number|string} cid    — category ID (0/1/2)
 * @param {string}  lang    — language code (zh/en)
 * @param {number|string} bookId — book ID
 * @returns {Promise<{ chapters: Array, chapterCount: number, paragraphCount: number }>}
 */
export async function loadBookFromR2(platform, cid, lang, bookId) {
  console.log("[r2-parquet] loadBookFromR2 called:", { cid, lang, bookId });

  const buffer = await fetchParquetBuffer(platform, cid, lang, bookId);
  const chapters = await parseBook(buffer, cid);

  const chapterCount = chapters.length;
  const paragraphCount = chapters.reduce(
    (s, ch) => s + ch.paragraphs.length,
    0,
  );

  console.log("[r2-parquet] loadBookFromR2 complete:", {
    chapterCount,
    paragraphCount,
  });

  return { chapters, chapterCount, paragraphCount };
}
