import { json, error } from "@sveltejs/kit";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET({ url, platform }) {
  const Key = url.searchParams.get("Key");
  const ContentType =
    url.searchParams.get("contentType") || "application/octet-stream";

  if (!Key) {
    throw error(400, "fileName is required");
  }

  // R2 凭据走单 secret `R2` (CF Pages Secret / dev .dev.vars),
  // 4 段逗号分隔: accountId,accessKeyId,secretAccessKey,bucket.
  // 跟 /api/r2/download 同步, 走 event.platform.env (workerd platform bindings,
  // 不是 process.env).
  const r2 = platform?.env?.R2;
  if (!r2) throw error(500, "R2 binding not configured");
  const [accountId, accessKeyId, secretAccessKey, Bucket] = r2.split(",");

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
