import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

import { writeFileSync, existsSync, mkdirSync } from 'fs';

// Custom plugin to auto-generate version.json
const autoVersion = () => ({
  name: 'auto-version',
  buildStart() {
    const versionData = { 
      version: '1.0.' + Math.floor(Date.now() / 1000), 
      timestamp: Date.now() 
    };
    const publicDir = resolve(__dirname, 'public');
    if (!existsSync(publicDir)) mkdirSync(publicDir);
    writeFileSync(resolve(publicDir, 'version.json'), JSON.stringify(versionData, null, 2));
    console.log('✅ version.json updated automatically');
  }
});

export default defineConfig({
  plugins: [react(), autoVersion()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
