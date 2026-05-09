import pc from "picocolors";

/** Whether the current build targets Tauri (vs Cloudflare) */
export const isTauri = !!process.env.TAURI;

if (typeof console !== "undefined") {
  console.log(
    pc.cyan("[config]"),
    "isTauri:",
    isTauri ? pc.green(true) : pc.red(false),
  );
}
