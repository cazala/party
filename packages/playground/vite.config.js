import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@party/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url))
    }
  },
  server: {
    port: 3000
  }
});