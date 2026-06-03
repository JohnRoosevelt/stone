import { json } from "@sveltejs/kit";

/**
 * GET /api/release
 *
 * Cached GitHub Releases API proxy.
 *
 * Why this exists:
 *   Direct client calls to api.github.com/repos/.../releases/latest are
 *   unauthenticated (60 req/hr per IP) and get 403'd as soon as a few
 *   users hit the /my or /download pages around the same time. Production
 *   fails on the very first deploy. This endpoint relays the call from
 *   the Cloudflare Worker (shared egress IP, plus KV cache) so the page
 *   stays responsive under load.
 *
 * Caching strategy:
 *   - KV: 1 hour TTL on the normalized release payload. After the first
 *     call no further GitHub requests are made for an hour.
 *   - On miss: fetch from GitHub, normalize, write to KV, return.
 *   - On GitHub failure: 502 with the upstream status. The client falls
 *     back to a direct call (5 min in-memory cache) so the user still
 *     sees something during a transient outage.
 *
 * Dev mode:
 *   - No KV binding is available in `vite dev`, so this endpoint just
 *     passes through to GitHub. Same 60/hr limit applies, but the client
 *   - side 5-min cache smooths over a single dev session.
 */

const GITHUB_REPO_DEFAULT = "JohnRoosevelt/stone";
const CACHE_KEY = "stone:release:latest";
const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

function normalize(data) {
  return {
    tag: data.tag_name,
    name: data.name,
    publishedAt: data.published_at,
    htmlUrl: data.html_url,
    assets: (data.assets || []).map((a) => ({
      name: a.name,
      size: a.size,
      url: a.browser_download_url,
    })),
  };
}

export async function GET({ url, platform }) {
  const repo = url.searchParams.get("repo") || GITHUB_REPO_DEFAULT;
  const kv = platform?.env?.STONE_SEARCH_CACHE;

  // 1. KV cache hit
  if (kv) {
    try {
      const cached = await kv.get(CACHE_KEY, "json");
      if (cached) {
        return json(cached, {
          headers: { "X-Cache": "HIT" },
        });
      }
    } catch (e) {
      console.warn("[release] KV get error:", e.message);
    }
  }

  // 2. Fetch from GitHub
  let res;
  try {
    res = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      { headers: { "User-Agent": "stone-app-server" } },
    );
  } catch (e) {
    return json(
      { error: `GitHub fetch failed: ${e.message}` },
      { status: 502 },
    );
  }

  if (!res.ok) {
    return json(
      { error: `GitHub releases/latest: HTTP ${res.status}` },
      { status: 502 },
    );
  }

  const data = await res.json();
  const out = normalize(data);

  // 3. Write back to KV (best-effort, non-blocking on error)
  if (kv) {
    try {
      await kv.put(CACHE_KEY, JSON.stringify(out), {
        expirationTtl: CACHE_TTL_SECONDS,
      });
    } catch (e) {
      console.warn("[release] KV put error:", e.message);
    }
  }

  return json(out, {
    headers: { "X-Cache": kv ? "MISS" : "BYPASS" },
  });
}
