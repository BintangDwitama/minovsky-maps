/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // local development: `go run ./cmd/api` in server/ listens on :8080 (Cloudflare does this in production)
    proxy: { '/api': 'http://localhost:8080' },
    fs: {
      // allow importing the shared schema from ../schema
      allow: ['..'],
    },
  },
  test: {
    environment: 'node',
    // never put tests in functions/: Cloudflare Pages turns every file there into a route
    include: ['src/**/*.test.ts'],
  },
});
