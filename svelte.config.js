import adapter from "@sveltejs/adapter-cloudflare";
import staticAdapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import UnoCSS from "@unocss/svelte-scoped/preprocess";

const combine = process.env.NODE_ENV !== "development";

const config = {
  preprocess: [
    vitePreprocess(),
    UnoCSS({
      combine,
    }),
  ],
  kit: {
    // Cloudflare 部署用 adapter-cloudflare
    // Tauri 构建用 adapter-static
    adapter: process.env.TAURI
      ? staticAdapter({
          pages: "build",
          assets: "build",
          fallback: "index.html",
        })
      : adapter(),
  },
  vitePlugin: {
    inspector: {
      showToggleButton: "always",
    },
  },
};

export default config;
