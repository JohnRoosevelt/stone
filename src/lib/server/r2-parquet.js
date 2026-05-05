import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { tableFromIPC } from "apache-arrow";

// ════════════════════════════════════════════════════════════════
// WASM 初始化 — 跨平台方案：
//   dev (Vite SSR)  → readFileSync + initSync (避 fetch file:// 失败)
//   prod (CF Workers) → initWasm / initZstd (默认，生产可工作)
// ════════════════════════════════════════════════════════════════

// ── 先导入函数（两个环境共用） ─────────────────────────────
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

// ── 检测是否 Node.js 环境（dev） ───────────────────────────
const isNode =
  typeof process !== "undefined" &&
  process.versions != null &&
  process.versions.node != null;

let _wasmInit = false;

async function ensureWasm() {
  if (_wasmInit) return;
  _wasmInit = true;

  if (isNode) {
    // ── dev (Bun / Node) — 读本地文件 + initSync ──────────
    const { readFileSync } = await import("node:fs");
    const { createRequire } = await import("node:module");
    const _require = createRequire(import.meta.url);

    console.log("[r2-parquet] WASM init (Node): reading files directly");

    const parquetWasmPath = _require.resolve(
      "parquet-wasm/esm/parquet_wasm_bg.wasm",
    );
    initParquetSync({ module: readFileSync(parquetWasmPath) });

    const zstdWasmPath = _require.resolve(
      "@dweb-browser/zstd-wasm/zstd_wasm_bg.wasm",
    );
    initZstdSync({ module: readFileSync(zstdWasmPath) });

    console.log("[r2-parquet] WASM init (Node): done ✓");
  } else {
    // ── prod (CF Workers) — 默认 init (fetch 在 worker 内可工作) ──
    console.log("[r2-parquet] WASM init (Workers): calling default init");
    await Promise.all([initParquet({}), initZstd({})]);
    console.log("[r2-parquet] WASM init (Workers): done ✓");
  }
}

// ─── R2 S3 客户端单例 ──────────────────────────────────────
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

/**
 * 从 R2 读取 .parquet.zst 文件的原始字节
 *
 * 优先走 S3 客户端，降级到公共 URL
 */
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

/**
 * 解析 parquet 字节 → 行数组
 *
 * 返回扁平的行，每行包含:
 *   n  — 章节号（book level 文件才有）
 *   c  — 原始文本（可能 base64+zstd 双层压缩）
 *   t  — 格式类型（SDA 有）
 *   p  — 段落编号（SDA 有）
 */
async function parseParquetRows(buffer, cid) {
  console.log(
    "[r2-parquet] Parsing parquet rows, buffer size:",
    (buffer.length / 1024).toFixed(1),
    "KB, cid:",
    cid,
  );

  await ensureWasm();

  const uint8 = new Uint8Array(buffer);
  console.log("[r2-parquet] Decompressing zstd...");
  const parquetBuffer = decompress(uint8);
  console.log(
    "[r2-parquet] Decompressed:",
    (parquetBuffer.length / 1024).toFixed(1),
    "KB",
  );

  console.log("[r2-parquet] Reading parquet table...");
  const wasmTable = readParquet(parquetBuffer);
  const arrowTable = tableFromIPC(wasmTable.intoIPCStream());
  const rows = arrowTable.toArray();
  console.log("[r2-parquet] Total rows from parquet:", rows.length);

  // 打印前 3 行 raw 数据，了解列名和结构
  if (rows.length > 0) {
    const sample = rows.slice(0, 3).map((r) => ({
      keys: Object.keys(r),
      n: r.n,
      c: typeof r.c === "string" ? r.c.slice(0, 60) : r.c,
      o: typeof r.o === "string" ? r.o.slice(0, 60) : r.o,
      t: r.t,
      p: r.p,
    }));
    console.log(
      "[r2-parquet] First 3 rows (raw):",
      JSON.stringify(sample, null, 2),
    );
  }

  const isSda = String(cid) === "1";

  // 完全对齐浏览器端 groupRows 中的 fn 逻辑：
  //   rz = { c: r.c || r.o }
  //   SDA 额外加 t, p
  //   n 原样保留，不做任何类型转换
  const result = rows.map((row, idx) => {
    // 内容列：浏览器用 r.c || r.o
    const raw = row?.c ?? row?.o;
    let textContent = raw;
    // 如果以 "0" 开头，说明是 base64 + zstd 双层压缩
    if (raw && typeof raw === "string" && raw.startsWith("0")) {
      try {
        const compressed = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
        const decResult = decompress(compressed);
        textContent = new TextDecoder().decode(decResult);
      } catch {
        // keep original
      }
    }

    if (idx < 3) {
      console.log(
        "[r2-parquet] Row",
        idx,
        "→ n:",
        row.n,
        "(type:",
        typeof row.n,
        "), content length:",
        textContent?.length,
      );
    }

    // n 原样传递，不做 Number() 转换，与浏览器端一致
    const rv = { n: row.n, c: textContent };
    if (isSda) {
      if (row.t != null) rv.t = row.t;
      if (row.p != null) rv.p = row.p;
    }
    return rv;
  });

  console.log("[r2-parquet] Parsed rows done");
  return result;
}

/**
 * 将扁平的行按章节分组
 *
 * 返回值: [{ chapterId, title, paragraphs: [{ id, num, textContent, format }] }]
 */
function groupIntoChapters(rows) {
  console.log("[r2-parquet] Grouping into chapters...");

  // 完全对齐浏览器端 groupRows：遍历 rows，n 变化时切章
  const chapters = [];
  let cur = null;
  let paragraphIdx = 0;

  for (const row of rows) {
    // 章节切分：与浏览器端 !cur || cur.n !== row.n 一致
    if (!cur || cur.n !== row.n) {
      cur = { n: row.n, ps: [] };
      chapters.push(cur);
      paragraphIdx = 0;
    }

    // 内容 textContent = p.c（浏览器端 syncToDb 中 p.c || ""）
    const p = {
      id: paragraphIdx++,
      num: row.p != null ? Number(row.p) : paragraphIdx,
      textContent: row.c || "",
      format: row.t != null ? Number(row.t) : null,
    };
    cur.ps.push(p);
  }

  const chapterNumbers = chapters.map((c) => c.n);
  console.log(
    "[r2-parquet] Unique chapters found:",
    chapters.length,
    "→",
    chapterNumbers.slice(0, 30).join(",") +
      (chapterNumbers.length > 30 ? "..." : ""),
  );

  // 转成与前端 syncToDb 兼容的格式
  const result = chapters.map((ch, idx) => {
    // n 可能是数字或章节名称字符串
    const numericId = Number(ch.n);
    const chapterId =
      Number.isFinite(numericId) && numericId > 0
        ? Math.floor(numericId)
        : idx + 1;
    const title =
      Number.isFinite(numericId) && numericId > 0
        ? `第 ${numericId} 章`
        : String(ch.n ?? `第 ${idx + 1} 章`);

    return { chapterId, title, paragraphs: ch.ps };
  });

  const totalParagraphs = result.reduce((s, ch) => s + ch.paragraphs.length, 0);
  console.log(
    "[r2-parquet] Grouped:",
    result.length,
    "chapters,",
    totalParagraphs,
    "paragraphs",
  );

  return result;
}

/**
 * 从 R2 读取并解析一本书的全部章节数据（服务端用）
 *
 * @param {object}  platform  — SvelteKit platform (含 env.R2, env.DB)
 * @param {number|string} cid     — 分类 ID (0/1/2)
 * @param {string}  lang     — 语言代码 (zh/en)
 * @param {number|string} bookId  — 书籍 ID
 * @returns {Promise<{ chapters: Array, chapterCount: number, paragraphCount: number }>}
 */
export async function loadBookFromR2(platform, cid, lang, bookId) {
  console.log("[r2-parquet] loadBookFromR2 called:", { cid, lang, bookId });

  const buffer = await fetchParquetBuffer(platform, cid, lang, bookId);
  const rows = await parseParquetRows(buffer, cid);
  const chapters = groupIntoChapters(rows);

  let paragraphCount = 0;
  for (const ch of chapters) {
    paragraphCount += ch.paragraphs.length;
  }

  console.log("[r2-parquet] loadBookFromR2 complete:", {
    chapterCount: chapters.length,
    paragraphCount,
  });

  return {
    chapters,
    chapterCount: chapters.length,
    paragraphCount,
  };
}
