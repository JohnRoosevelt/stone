import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import pkg from "parquetjs";
const { ParquetWriter, ParquetSchema } = pkg;
import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const [accountId, accessKeyId, secretAccessKey] = process.env.R2.split(",");
const bucket = process.env.R2_BUCKET;

if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
  console.error("Missing R2 env vars");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId, secretAccessKey },
});

async function getUploadedIds(prefix) {
  const ids = new Set();
  let continuationToken;
  do {
    const resp = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken
    }));
    for (const obj of resp.Contents || []) {
      const match = obj.Key.match(/sda\/[^/]+\/(\d+)\.parquet\.zst/);
      if (match) ids.add(match[1]);
    }
    continuationToken = resp.NextContinuationToken;
  } while (continuationToken);
  return ids;
}

async function downloadFromR2(key) {
  const resp = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const chunks = [];
  for await (const chunk of resp.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function convertSdaToParquet(jsonData) {
  const schema = new ParquetSchema({
    n: { type: "UTF8" },
    o: { type: "UTF8" },
    t: { type: "INT32" },
    p: { type: "INT32" },
  });
  const parquetPath = `/tmp/sda_${Date.now()}.parquet`;
  const writer = await ParquetWriter.openFile(schema, parquetPath);
  for (const key of Object.keys(jsonData)) {
    const chapter = jsonData[key];
    for (const para of chapter.ps || []) {
      await writer.appendRow({ n: chapter.n || "", o: para.c || "", t: para.t || 0, p: para.p || 0 });
    }
  }
  await writer.close();
  return parquetPath;
}

function compressParquet(parquetPath) {
  const zstPath = parquetPath + ".zst";
  execSync(`zstd -19 -f "${parquetPath}" -o "${zstPath}"`);
  return zstPath;
}

async function uploadToR2(key, filePath) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fs.readFileSync(filePath),
    ContentType: "application/octet-stream",
  }));
}

async function processLang(lang) {
  const prefix = `sda/${lang}/`;
  const uploadedIds = await getUploadedIds(prefix);
  
  const allIds = [];
  for (let i = 1; i <= 175; i++) allIds.push(String(i));
  const pendingIds = allIds.filter(id => !uploadedIds.has(id));
  
  console.log(`\n=== ${lang.toUpperCase()}: ${pendingIds.length} files to process ===`);
  
  let processed = 0;
  for (const id of pendingIds) {
    process.stdout.write(`[${processed + 1}/${pendingIds.length}] ${lang}/${id}... `);
    try {
      const jsonData = JSON.parse(await downloadFromR2(`sda/${lang}/${id}.json`));
      const parquetPath = await convertSdaToParquet(jsonData);
      const zstPath = compressParquet(parquetPath);
      await uploadToR2(`sda/${lang}/${id}.parquet.zst`, zstPath);
      fs.unlinkSync(parquetPath);
      fs.unlinkSync(zstPath);
      console.log("OK");
      processed++;
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
  }
  console.log(`\n${lang.toUpperCase()} done: ${processed} files`);
}

async function main() {
  console.log("SDA Upload - Progress Mode\n");
  await processLang("zh");
  await processLang("en");
  console.log("\nAll done!");
}

main().catch(console.error);
