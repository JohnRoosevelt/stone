export interface UploadResult {
  Key: string;
  url: string;
}

export async function uploadToR2(
  file: File | Blob,
  fileName: string,
  contentType: string = file.type || "application/octet-stream",
): Promise<UploadResult> {
  const res = await fetch(
    `/api/r2/upload?Key=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}`,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload API error: ${res.status} ${text}`);
  }

  const { Key, url } = await res.json();

  const cmd = `curl -v -X PUT \
    --noproxy "*" \
    -H "Content-Type: ${contentType}" \
    --data-binary @1.parquet.zst \
    ${url}`;
  console.log({ Key, url, contentType });
  console.log(cmd);
  await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });

  return { Key, url };
}
