import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development, Vite serves the React app on :5173 and forwards every
// /api request to the Express server on :3001. The browser only ever
// talks to :5173, so the session cookie works without any CORS setup.
//
// '@/' is short for 'src/' in imports (e.g. '@/lib/utils.js'). shadcn,
// Kokonut UI and Bklit UI components use it; jsconfig.json has the same
// alias so editors understand it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
