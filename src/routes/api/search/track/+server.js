import { json } from "@sveltejs/kit";

/**
 * POST /api/search/track
 *
 * Lightweight keyword-heat tracker used by the Tauri client (Android) to
 * share its search-keyword counts with the central Cloudflare KV — without
 * paying the cost of a full D1 query + result-cache write.
 *
 * Body: { q: string, lang?: string }
 *   or query:  ?q=<q>&lang=<lang>
 *
 * Only mutates `search:count:<lang>:<q>`. Returns the new count.
 * Network failures on the caller side are fire-and-forget — they don't
 * affect the local SQLite search progress.
 */
async function trackKeyword(kv, lang, q) {
  const key = `search:count:${lang}:${q}`;
  const cur = (await kv.get(key)) || "0";
  const next = String(Number(cur) + 1);
  await kv.put(key, next);
  return Number(next);
}

export async function POST({ request, platform }) {
  const kv = platform?.env?.STONE_SEARCH_CACHE;
  if (!kv) {
    return json({ error: "KV not configured" }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const q = String(body?.q || "").trim();
  const lang = String(body?.lang || "zh");
  if (!q) return json({ error: "Missing q" }, { status: 400 });

  try {
    const count = await trackKeyword(kv, lang, q);
    return json({ q, lang, count });
  } catch (e) {
    return json(
      { error: "Track failed", details: e.message },
      { status: 500 },
    );
  }
}

// Also accept GET for clients that prefer query params (e.g. simple
// keepalive-style ping from a web worker / Tauri webview).
export async function GET({ url, platform }) {
  const kv = platform?.env?.STONE_SEARCH_CACHE;
  if (!kv) {
    return json({ error: "KV not configured" }, { status: 503 });
  }
  const q = (url.searchParams.get("q") || "").trim();
  const lang = url.searchParams.get("lang") || "zh";
  if (!q) return json({ error: "Missing q" }, { status: 400 });

  try {
    const count = await trackKeyword(kv, lang, q);
    return json({ q, lang, count });
  } catch (e) {
    return json(
      { error: "Track failed", details: e.message },
      { status: 500 },
    );
  }
}
