import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, Vite serves the React app on :5173 and forwards every
// /api request to the Express server on :3001. The browser only ever
// talks to :5173, so the session cookie works without any CORS setup.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
