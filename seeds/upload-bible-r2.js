import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import pkg from "parquetjs";
const { ParquetWriter, ParquetSchema } = pkg;
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

const BIBLE_IDS = Array.from({ length: 66 }, (_, i) => String(i + 1));

async function convertBookToParquet(jsonPath, parquetPath) {
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const schema = new ParquetSchema({
    n: { type: "UTF8" },
    o: { type: "UTF8" },
  });

  const writer = await ParquetWriter.openFile(schema, parquetPath);

  if (Array.isArray(jsonData)) {
    for (const chapter of jsonData) {
      const title = chapter.n || "";
      for (const para of chapter.ps || []) {
        await writer.appendRow({ n: title, o: para.o || "" });
      }
    }
  } else if (jsonData.n && jsonData.ps) {
    for (const para of jsonData.ps) {
      await writer.appendRow({ n: jsonData.n, o: para.o || "" });
    }
  }

  await writer.close();
}

async function convertBibleToParquet(jsonPath, parquetPath) {
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));

  const schema = new ParquetSchema({
    n: { type: "UTF8" },
    o: { type: "UTF8" },
  });

  const writer = await ParquetWriter.openFile(schema, parquetPath);

  if (Array.isArray(jsonData)) {
    for (const chapter of jsonData) {
      const chapterId = String(chapter.id);
      for (const verse of chapter.verses || []) {
        await writer.appendRow({ n: chapterId, o: verse.c || "" });
      }
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

async function uploadBible(client, lang) {
  const inputDir = path.join(process.cwd(), "seeds/bible", lang);
  let totalOriginal = 0;
  let totalCompressed = 0;

  console.log(`\n=== Processing Bible (${lang}) ===`);

  for (const bookId of BIBLE_IDS) {
    const jsonPath = path.join(inputDir, `${bookId}.json`);
    const parquetPath = path.join(inputDir, `${bookId}.parquet`);
    const zstPath = path.join(inputDir, `${bookId}.parquet.zst`);

    if (!fs.existsSync(jsonPath)) {
      console.log(`  Book ${bookId}: skipped (not found)`);
      continue;
    }

    process.stdout.write(`  Book ${bookId}...`);

    const originalSize = fs.statSync(jsonPath).size;
    totalOriginal += originalSize;

    await convertBibleToParquet(jsonPath, parquetPath);
    compressParquet(parquetPath, zstPath);
    await uploadToR2(client, `bible/${lang}/${bookId}.parquet.zst`, zstPath);

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
  console.log("Bible R2 Upload Script\n");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await uploadBible(client, "zh");
  await uploadBible(client, "en");

  console.log("\nDone!");
}

main().catch(console.error);
