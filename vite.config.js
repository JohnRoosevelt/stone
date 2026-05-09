import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import UnoCSS from "@unocss/svelte-scoped/vite";
import { execSync } from "child_process";
import svelteAttributifyToClass from "./src/lib/svelte-attributify-to-class.js";

let GIT_COMMIT = "unknown";
const BUILD_TIME = new Date().toISOString().replace("T", " ").slice(0, 19);
try {
  GIT_COMMIT = execSync("git rev-parse --short HEAD").toString().trim();
} catch (_) {}

export default defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(GIT_COMMIT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    "process.env.TAURI": !!process.env.TAURI,
  },
  plugins: [
    svelteAttributifyToClass(),
    UnoCSS({ onlyGlobal: true, injectReset: "@unocss/reset/tailwind-v4.css" }),
    sveltekit(),
  ],
  server: { port: 5175 },
  optimizeDeps: { exclude: ["parquet-wasm", "@dweb-browser/zstd-wasm"] },
});
