import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";
import path from "path";
import { execSync } from "child_process";

let GIT_COMMIT = "unknown";
const BUILD_TIME = new Date().toISOString().replace("T", " ").slice(0, 19);
try {
  GIT_COMMIT = execSync("git rev-parse --short HEAD").toString().trim();
} catch (_) {}

export default defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(GIT_COMMIT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [UnoCSS(), sveltekit()],
  resolve: {
    alias: {
      $seeds: path.resolve("./seeds"),
    },
  },
  server: {
    port: 5175,
  },
  optimizeDeps: {
    exclude: ["parquet-wasm", "@dweb-browser/zstd-wasm"],
  },
});
