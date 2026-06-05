import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import UnoCSS from "@unocss/svelte-scoped/vite";
import { execSync } from "child_process";
import svelteAttributifyToClass from "./src/lib/svelte-attributify-to-class.js";
import { isTauri } from "./scripts/env.js";

let GIT_COMMIT = "unknown";
// BUILD_TIME 是 UTC ISO 字符串 (无时区). 渲染时走 $lib/format.js
// formatBuildTime() append 'Z' 当 UTC 解析, 然后用浏览器本地时区 getHours()
// 输出, 所以 web 跑在 Asia/Shanghai 看到 13:xx (+0800), Tauri 跑在其他时区
// 看到该时区时间. 不要在 vite.config.js 加 timeZone, 那样会绕过 formatBuildTime
// 的本地化逻辑, 变成"用 Asia/Shanghai 输出 + 浏览器再 +8h 转换 = 错"的双重叠加.
const BUILD_TIME = new Date().toISOString().replace("T", " ").slice(0, 19);
try {
  GIT_COMMIT = execSync("git rev-parse --short HEAD").toString().trim();
} catch (_) {}

export default defineConfig({
  define: {
    __GIT_COMMIT__: JSON.stringify(GIT_COMMIT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    "process.env.TAURI": isTauri,
  },
  plugins: [
    svelteAttributifyToClass(),
    UnoCSS({ onlyGlobal: true, injectReset: "@unocss/reset/tailwind-v4.css" }),
    sveltekit(),
  ],
  server: { port: 5175 },
  optimizeDeps: { exclude: ["parquet-wasm", "@dweb-browser/zstd-wasm"] },
});
