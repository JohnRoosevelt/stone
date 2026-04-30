/**
 * Parquet 拆分工具
 *
 * 从 R2 下载 book-level 的 .parquet.zst 文件，拆分为 chapter-level 文件，
 * 简化数据后重新压缩上传到 R2。
 *
 * 使用方式:
 *   node scripts/split-parquet.mjs --cid 0 --lang zh              # 处理所有圣经中文书卷
 *   node scripts/split-parquet.mjs --cid 0 --lang zh --book 1     # 处理单卷
 *   node scripts/split-parquet.mjs --cid 1 --lang zh              # 处理所有预言之灵书卷
 *   node scripts/split-parquet.mjs --cid 2 --lang zh              # 处理所有通用书卷
 *   node scripts/split-parquet.mjs --list                         # 列出所有可用的 book-level 文件
 *   node scripts/split-parquet.mjs --list --cid 0 --lang zh       # 列出指定分类/语言的 book-level 文件
 *   node scripts/split-parquet.mjs --cid 0 --lang zh --dry-run    # 试运行（不上传）
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import pkg from "parquetjs";
const { ParquetReader, ParquetWriter, ParquetSchema } = pkg;
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const R2_PARTS = (process.env.R2 || "").split(",");
const [accountId, accessKeyId, secretAccessKey, bucket] = R2_PARTS;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("❌ 缺少 R2 环境变量");
  console.log(
    "请在 .env.local 中设置: R2=accountId,accessKeyId,secretAccessKey,bucketName",
  );
  process.exit(1);
}

// cid 数值 → R2 路径名称
const CID_NAME = { 0: "bible", 1: "sda", 2: "book" };

/**
 * 每类数据的 Chapter-level Schema 及行简化规则
 *
 * | Category | cid | Keep Columns                  | Drop       |
 * |----------|-----|-------------------------------|------------|
 * | bible    | 0   | c (UTF8)                       | n, t, p    |
 * | sda      | 1   | c (UTF8), f (INT32), n (INT32) | old t/p renamed |
 * | book     | 2   | c (UTF8)                       | n, t, p    |
 *
 * 章节号由文件路径隐式表达（{cid}/{lang}/{bookId}/{chapterId}.parquet.zst），
 * 故无需在数据列中重复存储。
 */
const CHAPTER_CONFIG = {
  0: {
    // bible: 只保留经文内容 c
    schema: new ParquetSchema({
      c: { type: "UTF8" },
    }),
    mapRow: (row) => ({ c: row.o }),
  },
  1: {
    // sda: 保留 c (正文), f (format), n (num)
    schema: new ParquetSchema({
      c: { type: "UTF8" },
      f: { type: "INT32" },
      n: { type: "INT32" },
    }),
    mapRow: (row) => ({ c: row.o, t: row.t, p: row.p }),
  },
  2: {
    // book: 只保留段落内容 c
    schema: new ParquetSchema({
      c: { type: "UTF8" },
    }),
    mapRow: (row) => ({ c: row.o }),
  },
};

/**
 * 精简后的书级 Parquet Schema（含 chapter_id 用于分组）。
 * 拆分章节的同时重新生成精简书级文件，覆盖旧数据。
 *
 *   bible/book: n (UTF8), c (UTF8)
 *   sda:        n (UTF8), c (UTF8), t (INT32), p (INT32)
 */
const BOOK_LEVEL_CONFIG = {
  0: {
    schema: new ParquetSchema({ n: { type: "UTF8" }, c: { type: "UTF8" } }),
    mapRow: (row) => ({ n: row.n, c: row.o }),
  },
  1: {
    schema: new ParquetSchema({
      n: { type: "UTF8" },
      c: { type: "UTF8" },
      f: { type: "INT32" },
      p: { type: "INT32" },
    }),
    mapRow: (row) => ({ n: row.n, c: row.o, f: row.t, p: row.p }),
  },
  2: {
    schema: new ParquetSchema({ n: { type: "UTF8" }, c: { type: "UTF8" } }),
    mapRow: (row) => ({ n: row.n, c: row.o }),
  },
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 获取 R2 S3 客户端
 */
function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * 从 R2 下载文件到本地路径
 */
async function downloadFromR2(client, key, localPath) {
  const resp = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const chunks = [];
  for await (const chunk of resp.Body) {
    chunks.push(chunk);
  }
  fs.writeFileSync(localPath, Buffer.concat(chunks));
}

/**
 * 上传本地文件到 R2
 */
async function uploadToR2(client, key, localPath) {
  const fileBuffer = fs.readFileSync(localPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: "application/octet-stream",
    }),
  );
}

/**
 * 用 zstd -d 解压 .zst 文件
 */
function zstdDecompress(zstPath, outPath) {
  if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  execSync(`zstd -d "${zstPath}" -o "${outPath}"`, { stdio: "pipe" });
}

/**
 * 用 zstd -19 压缩文件，返回压缩后的路径
 */
function zstdCompress(inputPath) {
  const zstPath = inputPath + ".zst";
  if (fs.existsSync(zstPath)) fs.unlinkSync(zstPath);
  execSync(`zstd -19 -f "${inputPath}" -o "${zstPath}"`, { stdio: "pipe" });
  return zstPath;
}

// ---------------------------------------------------------------------------
// 列出 book-level 文件
// ---------------------------------------------------------------------------

/**
 * 列出 R2 上可用的 book-level parquet.zst 文件
 */
async function listBookFiles(client, cid, lang) {
  let prefix = "";
  if (cid !== undefined && lang !== undefined) {
    prefix = `${cid}/${lang}/`;
  } else if (cid !== undefined) {
    prefix = `${cid}/`;
  }

  console.log("🔍 扫描 R2 上的 book-level parquet.zst 文件...\n");

  const allFiles = [];
  let continuationToken;

  do {
    const params = {
      Bucket: bucket,
      ContinuationToken: continuationToken,
    };
    if (prefix) {
      params.Prefix = prefix;
    }

    const resp = await client.send(new ListObjectsV2Command(params));

    for (const obj of resp.Contents || []) {
      const key = obj.Key;
      // 匹配 book-level 路径: {cid}/{lang}/{bookId}.parquet.zst
      const match = key.match(/^(\d+)\/(\w+)\/(\d+)\.parquet\.zst$/);
      if (match) {
        allFiles.push({
          key,
          cid: parseInt(match[1], 10),
          lang: match[2],
          bookId: parseInt(match[3], 10),
          size: obj.Size,
        });
      }
    }

    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);

  if (allFiles.length === 0) {
    console.log("（未找到 book-level parquet.zst 文件）\n");
    return allFiles;
  }

  // 分组展示
  const grouped = {};
  for (const f of allFiles) {
    const groupKey = `${f.cid}/${f.lang}`;
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(f);
  }

  let totalSize = 0;
  for (const [groupKey, files] of Object.entries(grouped)) {
    const [cidStr, lang] = groupKey.split("/");
    const cidNum = parseInt(cidStr, 10);
    const cidName = CID_NAME[cidNum] || `cid${cidNum}`;
    const groupSize = files.reduce((s, f) => s + f.size, 0);
    totalSize += groupSize;

    console.log(
      `📁 [${cidName}] lang=${lang}  (${files.length} 卷, ${(groupSize / 1024 / 1024).toFixed(2)} MB)`,
    );
    for (const f of files.sort((a, b) => a.bookId - b.bookId)) {
      console.log(
        `    book ${String(f.bookId).padStart(3, " ")}  ${(f.size / 1024).toFixed(1)} KB  ${f.key}`,
      );
    }
    console.log("");
  }

  console.log(
    `📊 总计: ${allFiles.length} 卷, ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`,
  );

  return allFiles;
}

// ---------------------------------------------------------------------------
// 核心：拆分单本书
// ---------------------------------------------------------------------------

/**
 * 处理单本书：下载 → 解压 → 读取 → 按章节分组 → 写入/压缩/上传每个章节
 *
 * @returns {{ success: boolean, chapters: number, size: number }}
 */
async function splitBook(client, cid, bookId, lang, dryRun) {
  const config = CHAPTER_CONFIG[cid];
  if (!config) {
    throw new Error(`不支持的 cid: ${cid}`);
  }

  const bookKey = `${cid}/${lang}/${bookId}.parquet.zst`;
  const tempId = `split_${cid}_${bookId}_${lang}_${Date.now()}`;
  const zstPath = `/tmp/${tempId}.parquet.zst`;
  const parquetPath = `/tmp/${tempId}.parquet`;

  try {
    // 1. 下载 book-level .parquet.zst
    process.stdout.write(`  下载中...`);
    await downloadFromR2(client, bookKey, zstPath);
    const zstSize = fs.statSync(zstPath).size;
    process.stdout.write(` ${(zstSize / 1024).toFixed(1)} KB →`);

    // 2. 解压
    zstdDecompress(zstPath, parquetPath);
    const parquetSize = fs.statSync(parquetPath).size;
    process.stdout.write(` ${(parquetSize / 1024).toFixed(1)} KB →`);

    // 3. 读取 parquet 所有行
    const reader = await ParquetReader.openFile(parquetPath);
    const cursor = reader.getCursor();
    const rows = [];
    let row;
    while ((row = await cursor.next())) {
      rows.push({ n: row.n, o: row.o, t: row.t, p: row.p });
    }
    await reader.close();

    if (rows.length === 0) {
      process.stdout.write(` ⏭️  无数据\n`);
      return { success: true, chapters: 0, size: 0 };
    }

    // 4. 按 n (chapter_id) 分组
    const chapters = new Map();
    for (const r of rows) {
      const chapterId = String(r.n);
      if (!chapters.has(chapterId)) {
        chapters.set(chapterId, []);
      }
      chapters.get(chapterId).push(r);
    }

    process.stdout.write(` ${chapters.size} 章 →`);

    // 5. 逐章处理
    let totalUploaded = 0;
    let chapterCount = 0;

    for (const [chapterId, chapterRows] of chapters) {
      const chapterParquetPath = `/tmp/${tempId}_ch_${chapterId}.parquet`;
      const chapterKey = `${cid}/${lang}/${bookId}/${chapterId}.parquet.zst`;

      try {
        // 5a. 写入 chapter-level parquet
        const writer = await ParquetWriter.openFile(
          config.schema,
          chapterParquetPath,
        );
        for (const r of chapterRows) {
          await writer.appendRow(config.mapRow(r));
        }
        await writer.close();

        // 5b. 压缩
        const chapterZstPath = zstdCompress(chapterParquetPath);
        const chapterZstSize = fs.statSync(chapterZstPath).size;

        // 5c. 上传（非 dry-run）
        if (!dryRun) {
          await uploadToR2(client, chapterKey, chapterZstPath);
        }

        totalUploaded += chapterZstSize;
        chapterCount++;

        // 5d. 清理本章临时文件
        if (fs.existsSync(chapterParquetPath))
          fs.unlinkSync(chapterParquetPath);
        if (fs.existsSync(chapterZstPath)) fs.unlinkSync(chapterZstPath);
      } catch (err) {
        console.error(`\n    ❌ 章节 ${chapterId} 失败: ${err.message}`);
        // 尽力清理
        try {
          if (fs.existsSync(chapterParquetPath))
            fs.unlinkSync(chapterParquetPath);
        } catch (_) {}
      }
    }

    const action = dryRun ? "试运行" : "上传";
    process.stdout.write(` ${(totalUploaded / 1024).toFixed(1)} KB ${action}`);

    // 5.5 重新生成嵌套 JSON 书级文件 (.json.zst)
    const bookJsonPath = `/tmp/${tempId}_book.json`;
    try {
      // Build nested structure: [{ n, ps: [{c, f?, p?}] }]
      const chapterMap = new Map();
      for (const r of rows) {
        const ch = String(r.n ?? "");
        if (!chapterMap.has(ch)) chapterMap.set(ch, []);
        chapterMap.get(ch).push(r);
      }
      const bookJson = [];
      for (const [n, chRows] of chapterMap) {
        bookJson.push({
          n,
          ps: chRows.map((r) => {
            if (cid === 1) return { c: r.o, f: r.t, n: r.p };
            return { c: r.o };
          }),
        });
      }
      fs.writeFileSync(bookJsonPath, JSON.stringify(bookJson));

      const bookZstPath = zstdCompress(bookJsonPath);
      const bookZstSize = fs.statSync(bookZstPath).size;

      const bookJsonKey = `${cid}/${lang}/${bookId}.json.zst`;
      if (!dryRun) {
        await uploadToR2(client, bookJsonKey, bookZstPath);
      }

      totalUploaded += bookZstSize;
      process.stdout.write(` → 书级 ${(bookZstSize / 1024).toFixed(1)} KB`);

      if (fs.existsSync(bookJsonPath)) fs.unlinkSync(bookJsonPath);
      if (fs.existsSync(bookZstPath)) fs.unlinkSync(bookZstPath);
    } catch (err) {
      console.error(`\n    ❌ 书级重建失败: ${err.message}`);
      try { if (fs.existsSync(bookJsonPath)) fs.unlinkSync(bookJsonPath); } catch (_) {}
    }

    process.stdout.write(` ✅\n`);

    return { success: true, chapters: chapterCount, size: totalUploaded };
  } finally {
    // 6. 清理 book-level 临时文件
    try {
      if (fs.existsSync(zstPath)) fs.unlinkSync(zstPath);
      if (fs.existsSync(parquetPath)) fs.unlinkSync(parquetPath);
    } catch (_) {}
  }
}

// ---------------------------------------------------------------------------
// 批量处理
// ---------------------------------------------------------------------------

/**
 * 获取指定 cid/lang 下的所有 book-level 文件列表
 */
async function findBooks(client, cid, lang) {
  const prefix = `${cid}/${lang}/`;
  const bookIds = [];
  let continuationToken;

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of resp.Contents || []) {
      const match = obj.Key.match(/^(\d+)\/(\w+)\/(\d+)\.parquet\.zst$/);
      if (match) {
        bookIds.push(parseInt(match[3], 10));
      }
    }

    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);

  return bookIds.sort((a, b) => a - b);
}

/**
 * 批量处理某分类某语言下的所有书卷
 */
async function splitAll(client, cid, lang, dryRun) {
  const cidName = CID_NAME[cid];
  if (!cidName) {
    console.error(`❌ 不支持的 cid: ${cid} (支持: 0=bible, 1=sda, 2=book)`);
    process.exit(1);
  }

  console.log(`🔍 查找 R2 上 [${cidName}] lang=${lang} 的 book-level 文件...`);

  const bookIds = await findBooks(client, cid, lang);

  if (bookIds.length === 0) {
    console.log(`⚠️  未找到 cid=${cid} lang=${lang} 的 book-level 文件`);
    return;
  }

  const action = dryRun ? "试运行（不上传）" : "拆分并上传";
  console.log(
    `\n📦 ${action}: [${cidName}] (cid=${cid}) 语言=${lang}  共 ${bookIds.length} 卷\n`,
  );

  let totalChapters = 0;
  let totalSize = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < bookIds.length; i++) {
    const bookId = bookIds[i];
    process.stdout.write(`[${i + 1}/${bookIds.length}] book ${bookId}  `);

    try {
      const result = await splitBook(client, cid, bookId, lang, dryRun);
      if (result.chapters === 0) {
        // 无数据，不算成功也不算失败
      } else {
        successCount++;
        totalChapters += result.chapters;
        totalSize += result.size;
      }
    } catch (err) {
      console.log(`  ❌ 失败: ${err.message}`);
      failCount++;
    }
  }

  const actionPast = dryRun ? "试运行完成" : "上传完成";
  console.log(
    `\n✅ ${actionPast}: ${successCount} 卷成功, ${failCount} 卷失败, ${totalChapters} 章, 总计 ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`,
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  const help = `
Parquet 拆分工具 — 将 book-level parquet.zst 拆分为 chapter-level 文件

用法:
  node scripts/split-parquet.mjs --cid <0|1|2> --lang <code>            处理该分类下所有书卷
  node scripts/split-parquet.mjs --cid <0|1|2> --lang <code> --book N   处理单卷
  node scripts/split-parquet.mjs --list                                 列出所有 book-level 文件
  node scripts/split-parquet.mjs --list --cid <0|1|2> --lang <code>     列出指定分类/语言的文件
  node scripts/split-parquet.mjs --cid <0|1|2> --lang <code> --dry-run  试运行（不上传）

分类:
  0 = bible (圣经)    1 = sda (预言之灵)    2 = book (通用书籍)

简化规则:
  bible (cid=0): 保留 n, o — 丢弃 t, p
  sda   (cid=1): 保留 n, t, p, o — 全部保留
  book  (cid=2): 保留 n, o — 丢弃 t, p

示例:
  node scripts/split-parquet.mjs --cid 0 --lang zh              拆分全部圣经中文
  node scripts/split-parquet.mjs --cid 0 --lang zh --book 1     拆分圣经第1卷
  node scripts/split-parquet.mjs --cid 1 --lang zh              拆分全部预言之灵中文
  node scripts/split-parquet.mjs --cid 2 --lang en              拆分全部通用书籍英文
  node scripts/split-parquet.mjs --list                         列出所有文件
  node scripts/split-parquet.mjs --list --cid 0 --lang zh       列出圣经中文文件
  node scripts/split-parquet.mjs --cid 0 --lang zh --dry-run    试运行
`.trim();
  console.log(help);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--cid":
        opts.cid = parseInt(args[++i], 10);
        break;
      case "--lang":
        opts.lang = args[++i];
        break;
      case "--book":
        opts.book = parseInt(args[++i], 10);
        break;
      case "--list":
        opts.list = true;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
    }
  }

  return opts;
}

async function main() {
  const opts = parseArgs();

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const client = getR2Client();

  // --list: 列出文件
  if (opts.list) {
    await listBookFiles(client, opts.cid, opts.lang);
    process.exit(0);
  }

  // 验证参数
  if (opts.cid === undefined || isNaN(opts.cid) || !CID_NAME[opts.cid]) {
    console.error("❌ 请提供有效的 --cid (0=bible, 1=sda, 2=book)");
    printHelp();
    process.exit(1);
  }

  if (!opts.lang) {
    console.error("❌ 请提供 --lang (如 zh, en)");
    printHelp();
    process.exit(1);
  }

  const dryRun = opts.dryRun === true;
  if (dryRun) {
    console.log("⚠️  试运行模式：仅下载、解析、拆分，不上传\n");
  }

  if (opts.book !== undefined) {
    // 处理单卷
    const { cid, book, lang } = opts;
    const cidName = CID_NAME[cid];
    console.log(`\n📖 拆分单卷: [${cidName}] book ${book} (${lang})\n`);

    try {
      const result = await splitBook(client, cid, book, lang, dryRun);
      if (result.chapters === 0) {
        console.log("\n⚠️  该书卷无数据\n");
      } else {
        const action = dryRun ? "试运行完成" : "完成";
        console.log(
          `\n✅ ${action}: ${result.chapters} 章, ${(result.size / 1024).toFixed(1)} KB\n`,
        );
      }
    } catch (err) {
      console.error(`\n❌ 拆分失败: ${err.message}\n`);
      process.exit(1);
    }
  } else {
    // 批量处理
    await splitAll(client, opts.cid, opts.lang, dryRun);
  }
}

main().catch((err) => {
  console.error("❌ 未捕获的错误:", err);
  process.exit(1);
});
