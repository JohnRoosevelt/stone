export async function uploadToR2(
  file,
  fileName,
  contentType = file.type || "application/octet-stream",
) {
  const res = await fetch(
    `/api/r2/upload?Key=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(contentType)}`,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload API error: ${res.status} ${text}`);
  }

  const { Key, url } = await res.json();

  await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
    },
    body: file,
  });

  return { Key, url };
}
