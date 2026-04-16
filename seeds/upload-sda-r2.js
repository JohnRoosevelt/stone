import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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
  console.log("Required: R2, R2_BUCKET");
  process.exit(1);
}

const SDA_IDS = ["1", "2", "3", "4", "5"];

async function convertSdaToParquet(jsonPath, parquetPath) {
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const schema = new ParquetSchema({
    n: { type: "UTF8" },
    o: { type: "UTF8" },
    t: { type: "INT32" },
    p: { type: "INT32" },
  });

  const writer = await ParquetWriter.openFile(schema, parquetPath);

  for (const key of Object.keys(jsonData)) {
    const chapter = jsonData[key];
    const title = chapter.n || "";

    for (const para of chapter.ps || []) {
      await writer.appendRow({
        n: title,
        o: para.c || "",
        t: para.t || 0,
        p: para.p || 0,
      });
    }
  }

  await writer.close();
}

function compressParquet(parquetPath, zstPath) {
  if (fs.existsSync(zstPath)) fs.unlinkSync(zstPath);
  execSync(`zstd -19 -f "${parquetPath}" -o "${zstPath}"`);
  const ratio = (
    (1 - fs.statSync(zstPath).size / fs.statSync(parquetPath).size) *
    100
  ).toFixed(1);
  console.log(
    `  Compressed: ${(fs.statSync(zstPath).size / 1024).toFixed(1)} KB (${ratio}% smaller)`,
  );
}

async function uploadToR2(client, key, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: "application/octet-stream",
    }),
  );
  console.log(`  Uploaded: ${key}`);
}

async function uploadSda(client, lang) {
  const inputDir = path.join(process.cwd(), "seeds/sda", lang);
  let totalOriginal = 0;
  let totalCompressed = 0;

  console.log(`\n=== Processing SDA (${lang}) ===`);

  for (const sdaId of SDA_IDS) {
    const jsonPath = path.join(inputDir, `${sdaId}.json`);
    const parquetPath = path.join(inputDir, `${sdaId}.parquet`);
    const zstPath = path.join(inputDir, `${sdaId}.parquet.zst`);

    if (!fs.existsSync(jsonPath)) {
      console.log(`  SDA ${sdaId}: skipped (not found)`);
      continue;
    }

    process.stdout.write(`  SDA ${sdaId}...`);

    const originalSize = fs.statSync(jsonPath).size;
    totalOriginal += originalSize;

    await convertSdaToParquet(jsonPath, parquetPath);
    compressParquet(parquetPath, zstPath);
    await uploadToR2(client, `sda/${lang}/${sdaId}.parquet.zst`, zstPath);

    totalCompressed += fs.statSync(zstPath).size;

    fs.unlinkSync(parquetPath);
    fs.unlinkSync(zstPath);

    console.log(" done");
  }

  const overallRatio = ((1 - totalCompressed / totalOriginal) * 100).toFixed(1);
  console.log(
    `\n  Total: ${(totalOriginal / 1024 / 1024).toFixed(1)} MB -> ${(totalCompressed / 1024 / 1024).toFixed(1)} MB (${overallRatio}% smaller)`,
  );
}

async function main() {
  console.log("SDA R2 Upload Script\n");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await uploadSda(client, "zh");
  await uploadSda(client, "en");

  console.log("\nDone!");
}

main().catch(console.error);
