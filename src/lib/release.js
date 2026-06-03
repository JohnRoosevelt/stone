// Shared module for fetching the latest release info from the R2
// bucket. Used by the /my and /download web pages to resolve real
// download URLs (Android APK + macOS DMG) and show the latest version.
//
// Primary source: https://r2.lelexue.cn/apk/update.json (written by CI
// on every tag push). R2 is fast in China and has no rate limits, so
// no server-side proxy or KV cache is needed. The previous GitHub
// Releases path was dropped because unauthenticated api.github.com is
// capped at 60/hr/IP and is slow for China-based users.

const R2_PUBLIC = "https://r2.lelexue.cn";
const MANIFEST_URL = `${R2_PUBLIC}/apk/update.json`;

/** Always-latest asset URLs — CI overwrites these on every release. */
const APK_LATEST_URL = `${R2_PUBLIC}/apk/stone-latest.apk`;
const DMG_LATEST_URL = `${R2_PUBLIC}/apk/stone-latest.dmg`;

/** 5-min in-memory cache so we don't re-fetch on every page render. */
const CACHE_TTL_MS = 5 * 60 * 1000;
let _cached = null;
let _fetchedAt = 0;

/**
 * Normalize the R2 `update.json` shape into the `{tag, name,
 * publishedAt, assets: [{name, size, url}]}` shape the existing
 * /my and /download pages already consume.
 */
function normalize(manifest) {
  const assets = [];
  for (const [platform, info] of Object.entries(manifest.platforms || {})) {
    if (!info || !info.url) continue;
    // Derive a friendly filename from the URL (e.g. stone-latest.apk).
    const name = info.url.split("/").pop() || platform;
    assets.push({
      name,
      size: typeof info.size === "number" ? info.size : 0,
      url: info.url,
    });
  }
  return {
    tag: manifest.version,
    name: manifest.version,
    publishedAt: manifest.pub_date,
    htmlUrl: `${R2_PUBLIC}/apk/`,
    assets,
  };
}

export async function getLatestRelease({ force = false } = {}) {
  const now = Date.now();
  if (!force && _cached && now - _fetchedAt < CACHE_TTL_MS) {
    return _cached;
  }

  const res = await fetch(`${MANIFEST_URL}?t=${now}`);
  if (!res.ok) {
    throw new Error(`R2 update.json: HTTP ${res.status}`);
  }
  const manifest = await res.json();
  const out = normalize(manifest);
  _cached = out;
  _fetchedAt = now;
  return out;
}

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

// Re-export the latest URLs so non-page consumers (settings, /download
// share sheet) can build a link without re-parsing the manifest.
export const LATEST_APK_URL = APK_LATEST_URL;
export const LATEST_DMG_URL = DMG_LATEST_URL;
