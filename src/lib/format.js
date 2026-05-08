/**
 * Format __BUILD_TIME__ ISO string into a human-readable date-time string.
 *
 * __BUILD_TIME__ is e.g. "2026-05-14 16:02:01" (without timezone).
 * We append "Z" so `new Date()` treats it as UTC, then format as local.
 *
 * @param {string} buildTime — value of __BUILD_TIME__
 * @returns {string} e.g. "2026-05-14 16:02:01"
 */
export function formatBuildTime(buildTime) {
  const d = new Date(buildTime + "Z");
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
