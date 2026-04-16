/**
 * JSON <-> Parquet 互转工具
 *
 * 使用方式:
 *   node seeds/json-parquet.js convert book 1 zh    # 转换 book/zh/1.json -> 1.parquet.zst
 *   node seeds/json-parquet.js extract book 1 zh    # 从 parquet 提取 JSON
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema, ParquetReader } from "parquetjs";
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const [accountId, accessKeyId, secretAccessKey, bucket] =
  process.env.R2.split(",");

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Missing R2 env vars");
  console.log("Required: R2, R2_BUCKET");
  process.exit(1);
}

const SCHEMAS = {
  book: {
    columns: [
      { name: "n", type: "UTF8" },
      { name: "o", type: "UTF8" },
    ],
    flatten: (data) => {
      const rows = [];
      for (const chapter of data) {
        const title = chapter.n || "";
        for (const para of chapter.ps || []) {
          rows.push({ n: title, o: para.o || "" });
        }
      }
      return rows;
    },
  },
  bible: {
    columns: [
      { name: "n", type: "UTF8" },
      { name: "o", type: "UTF8" },
    ],
    flatten: (data) => {
      const rows = [];
      for (const chapter of data) {
        const chapterId = String(chapter.id);
        for (const verse of chapter.verses || []) {
          rows.push({ n: chapterId, o: verse.c || "" });
        }
      }
      return rows;
    },
    group: (rows) => {
      const chapters = [];
      let currentChapter = null;
      let verseId = 1;
      for (const row of rows) {
        if (!currentChapter || currentChapter.id !== row.n) {
          if (currentChapter) chapters.push(currentChapter);
          currentChapter = { id: row.n, verses: [] };
          verseId = 1;
        }
        currentChapter.verses.push({ id: verseId++, c: row.o });
      }
      if (currentChapter) chapters.push(currentChapter);
      return chapters;
    },
  },
  sda: {
    columns: [
      { name: "n", type: "UTF8" },
      { name: "o", type: "UTF8" },
      { name: "t", type: "INT32" },
      { name: "p", type: "INT32" },
    ],
    flatten: (data) => {
      const rows = [];
      for (const key of Object.keys(data)) {
        const chapter = data[key];
        const title = chapter.n || "";
        for (const para of chapter.ps || []) {
          rows.push({
            n: title,
            o: para.c || "",
            t: para.t || 0,
            p: para.p || 0,
          });
        }
      }
      return rows;
    },
    group: (rows) => {
      const chapters = [];
      let currentChapter = null;
      for (const row of rows) {
        if (!currentChapter || currentChapter.n !== row.n) {
          currentChapter = { n: row.n, ps: [] };
          chapters.push(currentChapter);
        }
        currentChapter.ps.push({ t: row.t, p: row.p, c: row.o });
      }
      return chapters;
    },
  },
};

async function getR2Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function downloadFromR2(client, key) {
  const resp = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const chunks = [];
  for await (const chunk of resp.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function uploadToR2(client, key, data) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: "application/octet-stream",
    }),
  );
}

async function jsonToParquet(jsonData, schema) {
  const schemaDef = {};
  for (const col of schema.columns) {
    schemaDef[col.name] = { type: col.type };
  }

  const writer = await ParquetWriter.openFile(
    new ParquetSchema(schemaDef),
    "/tmp/temp.parquet",
  );

  const rows = schema.flatten(jsonData);
  for (const row of rows) {
    await writer.appendRow(row);
  }
  await writer.close();

  execSync(`zstd -19 -f /tmp/temp.parquet -o /tmp/temp.parquet.zst`);
  const result = fs.readFileSync("/tmp/temp.parquet.zst");

  fs.unlinkSync("/tmp/temp.parquet");
  fs.unlinkSync("/tmp/temp.parquet.zst");

  return result;
}

async function parquetToJson(parquetBuffer, schema) {
  const reader = await ParquetReader.openFile(parquetBuffer);
  const cursor = reader.getCursor();
  const rows = [];
  let row;
  while ((row = await cursor.next())) {
    rows.push({ n: row.n, o: row.o, t: row.t, p: row.p });
  }
  await reader.close();

  if (schema.group) {
    return schema.group(rows);
  }

  const chapters = [];
  let currentChapter = null;
  for (const r of rows) {
    if (!currentChapter || currentChapter.n !== r.n) {
      currentChapter = { n: r.n, ps: [] };
      chapters.push(currentChapter);
    }
    currentChapter.ps.push({ o: r.o });
  }
  return chapters;
}

async function convert(cid, id, lang) {
  const client = await getR2Client();
  const schema = SCHEMAS[cid];

  if (!schema) {
    console.error(`Unknown cid: ${cid}`);
    console.log(`Available: ${Object.keys(SCHEMAS).join(", ")}`);
    return;
  }

  console.log(`Converting ${cid}/${id} (${lang})...`);

  const jsonKey = `${cid}/${lang}/${id}.json`;
  const parquetKey = `${cid}/${lang}/${id}.parquet.zst`;

  try {
    const jsonBuffer = await downloadFromR2(client, jsonKey);
    const jsonData = JSON.parse(jsonBuffer.toString());
    console.log(`  Downloaded JSON`);

    const parquetBuffer = await jsonToParquet(jsonData, schema);
    console.log(
      `  Created Parquet: ${(parquetBuffer.length / 1024).toFixed(1)} KB`,
    );

    await uploadToR2(client, parquetKey, parquetBuffer);
    console.log(`  Uploaded to R2: ${parquetKey}`);
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

async function extract(cid, id, lang) {
  const client = await getR2Client();
  const schema = SCHEMAS[cid];

  if (!schema) {
    console.error(`Unknown cid: ${cid}`);
    return;
  }

  console.log(`Extracting ${cid}/${id} (${lang})...`);

  const parquetKey = `${cid}/${lang}/${id}.parquet.zst`;

  try {
    const parquetBuffer = await downloadFromR2(client, parquetKey);
    const zstPath = "/tmp/temp_extract.parquet.zst";
    fs.writeFileSync(zstPath, parquetBuffer);
    execSync(`zstd -d -f ${zstPath} -o /tmp/temp_extract.parquet`);

    const jsonData = await parquetToJson("/tmp/temp_extract.parquet", schema);
    console.log(`  Extracted: ${jsonData.length} chapters`);

    const jsonPath = path.join(process.cwd(), `${cid}_${id}_${lang}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`  Saved to: ${jsonPath}`);

    fs.unlinkSync(zstPath);
    fs.unlinkSync("/tmp/temp_extract.parquet");
  } catch (e) {
    console.error(`Error: ${e.message}`);
  }
}

async function batchConvert(cid, lang) {
  const client = await getR2Client();
  const schema = SCHEMAS[cid];

  console.log(`Batch converting ${cid}/${lang}...`);

  let continuationToken;
  const toConvert = [];

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${cid}/${lang}/`,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of resp.Contents || []) {
      if (obj.Key.endsWith(".json")) {
        const match = obj.Key.match(/(\d+)\.json$/);
        if (match) toConvert.push(match[1]);
      }
    }

    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);

  console.log(`Found ${toConvert.length} files to convert`);

  for (const id of toConvert) {
    await convert(cid, id, lang);
  }

  console.log("Done!");
}

async function main() {
  const [command, cid, id, lang] = process.argv.slice(2);

  if (!command || !cid) {
    console.log(`
JSON <-> Parquet 互转工具

Usage:
  node json-parquet.js convert <cid> <id> <lang>   # JSON -> Parquet
  node json-parquet.js extract <cid> <id> <lang>   # Parquet -> JSON
  node json-parquet.js batch <cid> <lang>           # 批量转换

Examples:
  node json-parquet.js convert book 1 zh
  node json-parquet.js extract bible 1 zh
  node json-parquet.js batch sda zh

Available cid: book, bible, sda
    `);
    process.exit(1);
  }

  switch (command) {
    case "convert":
      await convert(cid, id, lang);
      break;
    case "extract":
      await extract(cid, id, lang);
      break;
    case "batch":
      await batchConvert(cid, lang);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(console.error);
