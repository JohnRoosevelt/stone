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

  const [accessKeyId, secretAccessKey, accountId] = env.R2.split(",");
  const Bucket = env.R2_BUCKET;

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
    expiresIn: 300,
  });

  const urlObj = new URL(signedUrl);
  const paramsToRemove = [
    "x-amz-checksum-crc32",
    "x-amz-checksum-crc32c",
    "x-amz-checksum-sha1",
    "x-amz-checksum-sha256",
    "x-amz-sdk-checksum-algorithm",
  ];

  paramsToRemove.forEach((param) => urlObj.searchParams.delete(param));
  url = urlObj.toString();

  return json({ Key, url });
}
