import { json, error } from "@sveltejs/kit";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "$env/dynamic/private";

export async function GET({ url }) {
  const Key = url.searchParams.get("Key");
  const ContentType =
    url.searchParams.get("contentType") || "application/octet-stream";

  if (!Key) {
    throw error(400, "fileName is required");
  }

  // R2 凭据拆 4 个 env 读 (跟 download endpoint 同步, 见 /api/r2/download/+server.js)
  const accountId = env.R2_ACCOUNT_ID;
  const accessKeyId = env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY;
  const Bucket = env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !Bucket) {
    throw error(500, "R2 binding not configured");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const command = new PutObjectCommand({
    Bucket,
    Key,
    ContentType,
  });

  const signedUrl = await getSignedUrl(client, command, {
    expiresIn: 300000,
  });

  return json({ Key, url: signedUrl });
}
