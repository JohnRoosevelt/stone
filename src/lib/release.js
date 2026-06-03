// Shared module for fetching the latest GitHub release info.
// Used by the download page (to build the actual APK/DMG URL) and by the
// "我的" page (to list supported platforms with their download links).
//
// The `update.json` manifest is for the Tauri auto-updater and only covers
// the Android-aarch64 target; for the macOS DMG and any future asset we
// need the full release info from the GitHub API.
//
// VITE_GITHUB_REPO is injected at build time. The dev default points at
// the real upstream so the URLs work locally too.

const GITHUB_REPO =
  import.meta.env.VITE_GITHUB_REPO || "JohnRoosevelt/stone";

/** Server-side cached proxy at /api/release (1h KV TTL in prod). */
const SERVER_RELEASE_URL = "/api/release";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes (in-memory, per session)
let _cached = null;
let _fetchedAt = 0;

/** Shape returned to callers. */
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

export async function getLatestRelease({ force = false } = {}) {
  const now = Date.now();
  if (!force && _cached && now - _fetchedAt < CACHE_TTL_MS) {
    return _cached;
  }

  // 1. Try the server-side proxy (KV-cached, dodges the 60/hr/IP GitHub limit).
  try {
    const res = await fetch(SERVER_RELEASE_URL);
    if (res.ok) {
      const data = await res.json();
      _cached = data;
      _fetchedAt = now;
      return data;
    }
    console.warn(
      `[release] server proxy returned HTTP ${res.status}, falling back to direct`,
    );
  } catch (e) {
    console.warn(`[release] server proxy failed: ${e.message}, falling back to direct`);
  }

  // 2. Fallback: direct GitHub call. Same-origin rate limit applies, but
  //    this path is what dev mode (no KV) and outages fall back on.
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
  );
  if (!res.ok) {
    // 3. Last resort: a hardcoded recent release so dev mode (where the
    //    /api/release proxy just relays and also hits the 60/hr limit)
    //    still renders the /my and /download pages with real asset URLs.
    //    Update this object when a new version ships.
    if (HARDCODED_FALLBACK.tag) {
      console.warn(
        `[release] GitHub returned HTTP ${res.status}; using hardcoded v${HARDCODED_FALLBACK.tag} fallback`,
      );
      _cached = HARDCODED_FALLBACK;
      _fetchedAt = now;
      return HARDCODED_FALLBACK;
    }
    throw new Error(`GitHub releases/latest: HTTP ${res.status}`);
  }
  const data = await res.json();
  const out = normalize(data);
  _cached = out;
  _fetchedAt = now;
  return out;
}

/**
 * Hardcoded fallback release. Used when both the server proxy and the
 * direct GitHub call fail (dev-mode rate limit, transient outage, etc).
 * Set `tag` to `""` to disable and let the error throw instead.
 *
 * Update this when releasing a new version, or rely on the GitHub API
 * path in production where the KV cache absorbs almost all traffic.
 */
const HARDCODED_FALLBACK = {
  tag: "0.2.0",
  name: "stone 0.2.0",
  publishedAt: "2026-06-03T00:00:00Z",
  htmlUrl: `https://github.com/${GITHUB_REPO}/releases/tag/v0.2.0`,
  assets: [
    {
      name: "stone-0.2.0.apk",
      size: 11.2 * 1024 * 1024,
      url: `https://github.com/${GITHUB_REPO}/releases/download/v0.2.0/stone-0.2.0.apk`,
    },
    {
      name: "stone-0.2.0.dmg",
      size: 10.5 * 1024 * 1024,
      url: `https://github.com/${GITHUB_REPO}/releases/download/v0.2.0/stone-0.2.0.dmg`,
    },
  ],
};

export function findAsset(release, predicate) {
  if (!release || !release.assets) return null;
  return release.assets.find(predicate) || null;
}

export const androidAsset = (release) =>
  findAsset(release, (a) => /\.apk$/i.test(a.name));

export const macAsset = (release) =>
  findAsset(release, (a) => /\.dmg$/i.test(a.name));

export const windowsAsset = (release) =>
  findAsset(release, (a) => /\.(exe|msi)$/i.test(a.name));

export function formatSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export const SUPPORTED_PLATFORMS = [
  {
    id: "android",
    label: "Android",
    asset: androidAsset,
    icon: "i-carbon-logo-android",
    iconColor: "text-green-500",
    minVersion: "7.0",
  },
  {
    id: "macos",
    label: "macOS",
    asset: macAsset,
    icon: "i-carbon-logo-apple",
    iconColor: "text-gray-700 dark:text-gray-300",
    minVersion: "11",
  },
];
