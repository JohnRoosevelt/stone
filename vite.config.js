import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [UnoCSS(), sveltekit()],
  server: {
    port: 5175,
    // headers: {
    //   "Cross-Origin-Opener-Policy": "same-origin",
    //   "Cross-Origin-Embedder-Policy": "credentialless",
    // },
  },
  optimizeDeps: {
    // Exclude sqlite-wasm from pre-bundling since it's a large WASM module
    // that Vite can't properly optimize, and it's already self-contained
    exclude: ["@sqlite.org/sqlite-wasm"],
  },
});
