import { json, error } from "@sveltejs/kit";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "$env/dynamic/private";

/** GET /api/r2/download?Key=1/en/1/1.parquet.zst */
export async function GET({ url }) {
  const Key = url.searchParams.get("Key");
  if (!Key) throw error(400, "Key required");

  // R2 凭据拆 4 个 env 读:
  //   - R2_ACCOUNT_ID + R2_BUCKET: 公开信息, wrangler.toml [vars] 提供
  //   - R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY: 走 wrangler secret put (prod) /
  //     .dev.vars (dev), 严禁进 git
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

  const command = new GetObjectCommand({ Bucket, Key });
  const signedUrl = await getSignedUrl(client, command, { expiresIn: 300 });

  return json({ Key, url: signedUrl });
}
