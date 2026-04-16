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

  const [accountId, accessKeyId, secretAccessKey, Bucket] = env.R2.split(",");

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
