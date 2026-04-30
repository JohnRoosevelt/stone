/**
 * D1 → R2 导出工具
 *
 * 从 Cloudflare D1 数据库查询数据，转换为 Parquet 并用 Zstd 压缩后上传到 R2。
 *
 * 使用方式:
 *   node scripts/d1-to-r2.mjs --cid 0 --lang zh              # 导出所有圣经中文书卷
 *   node scripts/d1-to-r2.mjs --cid 0 --lang zh --book 1     # 导出单卷
 *   node scripts/d1-to-r2.mjs --cid 1 --lang zh              # 导出所有预言之灵书卷
 *   node scripts/d1-to-r2.mjs --cid 2 --lang zh              # 导出所有通用书卷
 *   node scripts/d1-to-r2.mjs --list                         # 列出所有可用的书卷及段落数
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import pkg from "parquetjs";
const { ParquetWriter, ParquetSchema } = pkg;
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

// 每类数据的 Parquet Schema 及行处理
const CATEGORY_CONFIG = {
  0: {
    // bible: 只保留 chapter_id 和 text_content
    schema: new ParquetSchema({
      n: { type: "UTF8" },
      c: { type: "UTF8" },
    }),
    mapRow: (row, columns) => {
      const get = (name) => row[columns.indexOf(name)];
      return { n: String(get("chapter_id")), c: get("text_content") || "" };
    },
  },
  1: {
    // sda: 保留 chapter_id, format, num, text_content
    schema: new ParquetSchema({
      n: { type: "UTF8" },
      t: { type: "INT32" },
      p: { type: "INT32" },
      o: { type: "UTF8" },
    }),
    mapRow: (row, columns) => {
      const get = (name) => row[columns.indexOf(name)];
      return {
        n: String(get("chapter_id")),
        t: get("format") ?? 0,
        p: get("num") ?? 0,
        c: get("text_content") || "",
      };
    },
  },
  2: {
    // book: 同 bible，只保留 chapter_id 和 text_content
    schema: new ParquetSchema({
      n: { type: "UTF8" },
      o: { type: "UTF8" },
    }),
    mapRow: (row, columns) => {
      const get = (name) => row[columns.indexOf(name)];
      return { n: String(get("chapter_id")), c: get("text_content") || "" };
    },
  },
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 执行 D1 查询并返回解析后的行数组。
 * wrangler 返回格式: [{"results":[{"columns":[...],"rows":[[...],...]}]}]
 */
function execD1(sql) {
  const cmd = `wrangler d1 execute stone-db --remote --json --command "${sql.replace(/"/g, '\\"')}"`;
  let output;
  try {
    output = execSync(cmd, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 120_000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err) {
    console.error("❌ wrangler 命令执行失败:");
    console.error("  SQL:", sql.length > 120 ? sql.slice(0, 120) + "..." : sql);
    console.error("  Stderr:", err.stderr || err.message);
    throw err;
  }

  // 尝试从输出中提取 JSON 数组（wrangler 可能输出一些非 JSON 的日志行）
  // 格式: [{"results":[{"columns":[...],"rows":[[...],...]}]}]
  const jsonMatch = output.match(/\[\{"results":[\s\S]*\}\]/);
  if (!jsonMatch) {
    console.error("❌ 无法从 wrangler 输出中解析 JSON");
    console.error("  输出:", output.slice(0, 500));
    throw new Error("Invalid wrangler output");
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("❌ JSON 解析失败");
    console.error("  原始:", jsonMatch[0].slice(0, 500));
    throw e;
  }

  // 结构: [{ results: [{ columns, rows }] }]
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }
  const results = parsed[0].results;
  if (!Array.isArray(results) || results.length === 0) {
    return [];
  }

  return results[0];
}

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
 * 将 tempPath 用 zstd -19 压缩，返回压缩后的文件路径 (.zst)
 */
function zstdCompress(tempPath) {
  const zstPath = tempPath + ".zst";
  if (fs.existsSync(zstPath)) fs.unlinkSync(zstPath);
  execSync(`zstd -19 -f "${tempPath}" -o "${zstPath}"`, { stdio: "pipe" });
  return zstPath;
}

// ---------------------------------------------------------------------------
// 核心操作
// ---------------------------------------------------------------------------

/**
 * 列出所有可用的书卷及段落数
 */
function listBooks() {
  const sql = `SELECT cid, book_id, lang_code, COUNT(*) as cnt FROM chapter_paragraphs GROUP BY cid, book_id, lang_code ORDER BY cid, book_id, lang_code`;
  console.log("🔍 查询 D1 数据库...");
  const result = execD1(sql);

  if (!result.rows || result.rows.length === 0) {
    console.log("（无数据）");
    return;
  }

  const cols = result.columns;
  const ci = cols.indexOf("cid");
  const bi = cols.indexOf("book_id");
  const li = cols.indexOf("lang_code");
  const cnti = cols.indexOf("cnt");

  console.log(`\n📚 可用书卷 (共 ${result.rows.length} 条):\n`);

  const nameMap = { 0: "bible", 1: "sda  ", 2: "book " };
  for (const row of result.rows) {
    const cidName = nameMap[row[ci]] || `cid${row[ci]}`;
    const bookId = String(row[bi]).padStart(3, " ");
    const lang = String(row[li]).padEnd(4, " ");
    const cnt = String(row[cnti]).padStart(8, " ");
    console.log(`  [${cidName}] book ${bookId}  ${lang}  ${cnt} 段落`);
  }
  console.log("");
}

/**
 * 导出单本书到 R2
 * @returns {{ success: boolean, size: number }}
 */
async function exportBook(client, cid, bookId, lang) {
  const config = CATEGORY_CONFIG[cid];
  if (!config) {
    throw new Error(`不支持的 cid: ${cid}`);
  }

  const r2Key = `${cid}/${lang}/${bookId}.parquet.zst`;

  // 1. 查询 D1
  const sql = `SELECT chapter_id, id, num, text_content, format FROM chapter_paragraphs WHERE cid = ${cid} AND book_id = ${bookId} AND lang_code = '${lang}' ORDER BY chapter_id, id`;
  const result = execD1(sql);

  if (!result.rows || result.rows.length === 0) {
    console.log(`  ⏭️  book ${bookId} (${lang}): 无段落数据，跳过`);
    return { success: true, size: 0 };
  }

  const { columns, rows } = result;
  const rowCount = rows.length;

  // 2. 写入 Parquet
  const tempId = `${cid}_${bookId}_${lang}_${Date.now()}`;
  const parquetPath = `/tmp/${tempId}.parquet`;
  const writer = await ParquetWriter.openFile(config.schema, parquetPath);

  for (const row of rows) {
    await writer.appendRow(config.mapRow(row, columns));
  }
  await writer.close();

  const parquetSize = fs.statSync(parquetPath).size;

  // 3. Zstd 压缩
  const zstPath = zstdCompress(parquetPath);
  const zstSize = fs.statSync(zstPath).size;
  const ratio = ((1 - zstSize / parquetSize) * 100).toFixed(1);

  process.stdout.write(
    `  ${(parquetSize / 1024).toFixed(1)} KB → ${(zstSize / 1024).toFixed(1)} KB (${ratio}%)`,
  );

  // 4. 上传到 R2
  const fileBuffer = fs.readFileSync(zstPath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: r2Key,
      Body: fileBuffer,
      ContentType: "application/octet-stream",
    }),
  );

  // 5. 清理临时文件
  fs.unlinkSync(parquetPath);
  fs.unlinkSync(zstPath);

  process.stdout.write(` → ✅ R2: ${r2Key}\n`);

  return { success: true, size: zstSize };
}

/**
 * 导出某一类别 + 语言下的所有书卷
 */
async function exportAll(client, cid, lang) {
  const cidName = CID_NAME[cid];
  if (!cidName) {
    console.error(`❌ 不支持的 cid: ${cid} (支持: 0=bible, 1=sda, 2=book)`);
    process.exit(1);
  }

  // 查询所有 book_id
  const sql = `SELECT DISTINCT book_id FROM chapter_paragraphs WHERE cid = ${cid} AND lang_code = '${lang}' ORDER BY book_id`;
  const result = execD1(sql);

  if (!result.rows || result.rows.length === 0) {
    console.log(`⚠️  cid=${cid} lang=${lang} 无数据`);
    return;
  }

  const bookIds = result.rows.map((r) => r[0]);

  console.log(
    `\n📦 导出 [${cidName}] (cid=${cid}) 语言=${lang}  共 ${bookIds.length} 卷\n`,
  );

  let totalSize = 0;
  let successCount = 0;
  let skipCount = 0;

  for (let i = 0; i < bookIds.length; i++) {
    const bookId = bookIds[i];
    process.stdout.write(`[${i + 1}/${bookIds.length}] book ${bookId}  `);

    try {
      const { success, size } = await exportBook(client, cid, bookId, lang);
      if (size === 0) {
        skipCount++;
      } else {
        successCount++;
        totalSize += size;
      }
    } catch (err) {
      console.log(`  ❌ 失败: ${err.message}`);
    }
  }

  console.log(
    `\n✅ 完成: ${successCount} 卷上传, ${skipCount} 卷跳过, 总计 ${(totalSize / 1024 / 1024).toFixed(2)} MB\n`,
  );
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  const help = `
D1 → R2 导出工具

用法:
  node scripts/d1-to-r2.mjs --cid <0|1|2> --lang <code>           导出该分类下所有书卷
  node scripts/d1-to-r2.mjs --cid <0|1|2> --lang <code> --book N 导出单卷
  node scripts/d1-to-r2.mjs --list                                列出所有可用书卷

分类:
  0 = bible (圣经)    1 = sda (预言之灵)    2 = book (通用书籍)

示例:
  node scripts/d1-to-r2.mjs --cid 0 --lang zh              导出全部圣经中文
  node scripts/d1-to-r2.mjs --cid 0 --lang zh --book 1     导出圣经第1卷(创世记)
  node scripts/d1-to-r2.mjs --cid 1 --lang zh              导出全部预言之灵中文
  node scripts/d1-to-r2.mjs --cid 2 --lang en              导出全部通用书籍英文
  node scripts/d1-to-r2.mjs --list                         列出可用书卷
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

  if (opts.list) {
    listBooks();
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

  const client = getR2Client();

  if (opts.book !== undefined) {
    // 导出单卷
    const { cid, book, lang } = opts;
    console.log(`\n📖 导出单卷: [${CID_NAME[cid]}] book ${book} (${lang})\n`);
    try {
      await exportBook(client, cid, book, lang);
      console.log("\n✅ 完成\n");
    } catch (err) {
      console.error(`\n❌ 导出失败: ${err.message}\n`);
      process.exit(1);
    }
  } else {
    // 批量导出
    await exportAll(client, opts.cid, opts.lang);
  }
}

main().catch((err) => {
  console.error("❌ 未捕获的错误:", err);
  process.exit(1);
});
