/**
 * Apply the dark class to <html>.
 *
 * localStorage persistence of `themeMode` is handled by the
 * `$effect` in `src/routes/+layout.svelte` — this helper only
 * mirrors the current `isDarkMode` into the DOM, so we don't
 * double-write / drift the key.
 */
export function setTheme(theme = "light") {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}
