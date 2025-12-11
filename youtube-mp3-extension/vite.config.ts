import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import manifest from './src/manifest.json';

// Plugin to copy content script CSS to dist
const copyContentCss = () => ({
  name: 'copy-content-css',
  closeBundle() {
    const srcPath = resolve(__dirname, 'src/content/styles.css');
    const destDir = resolve(__dirname, 'dist/src/content');
    const destPath = resolve(destDir, 'styles.css');
    
    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, destPath);
    }
  }
});

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyContentCss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    // Ensure no HMR/dev code in production
    minify: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
      },
    },
  },
  // Define globals for service worker compatibility
  define: {
    'import.meta.hot': 'undefined',
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
});
