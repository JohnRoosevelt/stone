import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";
import path from "path";

export default defineConfig({
  plugins: [UnoCSS(), sveltekit()],
  resolve: {
    alias: {
      $seeds: path.resolve("./seeds"),
    },
  },
  server: {
    port: 5175,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm", "parquet-wasm"],
  },
});
