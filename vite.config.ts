import { defineConfig } from 'vite';

// The preview proxy serves the app from *.e2b.app hosts, so Vite must accept them (brief: preview origins).
export default defineConfig({
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
  },
});
