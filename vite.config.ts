import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;
const port = parseInt(process.env.VITE_DEV_PORT || "1420");

// UI 库源码在仓库外（~/Workspace/ui），dev/build 都直连源码（HMR 从源生效）
const uiSrc = fileURLToPath(new URL("../ui/src", import.meta.url));
const uiRoot = fileURLToPath(new URL("../ui", import.meta.url));
const projectRoot = fileURLToPath(new URL("./", import.meta.url));

// Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
//
// 1. prevent Vite from obscuring rust errors
// 2. tauri expects a fixed port, fail if that port is not available
export default defineConfig(async () => ({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      // 带斜杠的别名必须排在包入口之前
      { find: "@ruinb0w/ui/style.css", replacement: `${uiSrc}/index.css` },
      { find: "@ruinb0w/ui", replacement: `${uiSrc}/index.ts` },
    ],
    // 库源码在仓外，vue / @lucide/vue 会被解析成两份（项目一份、ui/node_modules 一份）。
    // 两套 inject key 对不上会让图标渲染失败（inject 返回 undefined），也会让包体积翻倍。
    dedupe: ["vue", "@lucide/vue"],
  },
  clearScreen: false,
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    hmr: {
      protocol: "ws",
      host: host || "localhost",
      port: port + 1,
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // 源码在仓外：fs.allow 一旦设置就覆盖默认值，项目根要自己列
    fs: { allow: [projectRoot, uiRoot] },
  },
}));
