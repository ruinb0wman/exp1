import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'node:url';

// UI 库源码在仓库外，别名与 dedupe 必须和 vite.config.ts 保持一致（vitest 不复用 vite 配置）
const uiSrc = fileURLToPath(new URL('../ui/src', import.meta.url));

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@ruinb0w/ui/style.css', replacement: `${uiSrc}/index.css` },
      { find: '@ruinb0w/ui', replacement: `${uiSrc}/index.ts` },
    ],
    // 同 vite.config.ts：库源码在仓外，vue / @lucide/vue 必须只留一份
    dedupe: ['vue', '@lucide/vue'],
  },
});
