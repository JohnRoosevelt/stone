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

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
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
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
  );
  if (!res.ok) {
    throw new Error(`GitHub releases/latest: HTTP ${res.status}`);
  }
  const data = await res.json();
  const out = normalize(data);
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
