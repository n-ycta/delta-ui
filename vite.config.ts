import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      input: {main:fileURLToPath(new URL('./index.html',import.meta.url)),workbench:fileURLToPath(new URL('./workbench.html',import.meta.url))},
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('/node_modules/recharts/')) return 'charts';
          if (id.includes('/node_modules/react-grid-layout/')) return 'grid';
        },
      },
    },
  },
});
