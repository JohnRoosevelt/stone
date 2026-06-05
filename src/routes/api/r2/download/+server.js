import { json, error } from "@sveltejs/kit";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** GET /api/r2/download?Key=1/en/1/1.parquet.zst */
export async function GET({ url, platform }) {
  const Key = url.searchParams.get("Key");
  if (!Key) throw error(400, "Key required");

  // R2 凭据走单 secret `R2` (CF Pages Secret / dev .dev.vars),
  // 4 段逗号分隔: accountId,accessKeyId,secretAccessKey,bucket.
  // miniflare 启的 workerd 把 .dev.vars 注入到 platform.env (不是 process.env),
  // 所以 SvelteKit server endpoint 必须走 event.platform.env.
  const r2 = platform?.env?.R2;
  if (!r2) throw error(500, "R2 binding not configured");
  const [accountId, accessKeyId, secretAccessKey, Bucket] = r2.split(",");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  const command = new GetObjectCommand({ Bucket, Key });
  const signedUrl = await getSignedUrl(client, command, { expiresIn: 300 });

  return json({ Key, url: signedUrl });
}
