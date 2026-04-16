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

const BOOK_IDS = ["1", "2", "3", "4"];
const INPUT_DIR = path.join(process.cwd(), "seeds/book");

async function convertToParquet(jsonPath, parquetPath) {
  const { ParquetWriter, ParquetSchema } = pkg;
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
  console.log(
    `  Created: ${(fs.statSync(parquetPath).size / 1024).toFixed(1)} KB`,
  );
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

async function main() {
  console.log("R2 Upload Script\n");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  for (const bookId of BOOK_IDS) {
    const jsonPath = path.join(INPUT_DIR, `${bookId}.json`);
    const parquetPath = path.join(INPUT_DIR, `${bookId}.parquet`);
    const zstPath = path.join(INPUT_DIR, `${bookId}.parquet.zst`);

    console.log(`\nProcessing book ${bookId}...`);

    if (!fs.existsSync(jsonPath)) {
      console.log(`  Skipped: not found`);
      continue;
    }

    await convertToParquet(jsonPath, parquetPath);
    compressParquet(parquetPath, zstPath);
    // await uploadToR2(client, `book/zh/${bookId}.json`, jsonPath);
    await uploadToR2(client, `book/zh/${bookId}.parquet.zst`, zstPath);
    fs.unlinkSync(parquetPath);
    fs.unlinkSync(zstPath);
  }

  console.log("\nDone!");
}

main().catch(console.error);
