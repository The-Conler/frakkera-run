import { defineConfig } from 'vite';

// base './' => la build funziona in qualsiasi sottocartella o dentro un iframe
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    chunkSizeWarningLimit: 1600,
  },
  server: { host: true },
});
