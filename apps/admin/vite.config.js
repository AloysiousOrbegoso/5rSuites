import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev:ui` hot-reloads the UI against `wrangler pages dev` running on :8788.
    proxy: { '/api': 'http://localhost:8788', '/media': 'http://localhost:8788' },
  },
});
