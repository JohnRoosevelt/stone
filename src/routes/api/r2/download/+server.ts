import { json, error } from "@sveltejs/kit";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "$env/dynamic/private";

/** GET /api/r2/download?Key=1/en/1/1.parquet.zst */
export async function GET({ url }) {
  const Key = url.searchParams.get("Key");
  if (!Key) throw error(400, "Key required");

  const [accountId, accessKeyId, secretAccessKey, Bucket] = env.R2.split(",");

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
