import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Listen on the LAN too, so you can open the app on your phone.
    host: true,
    proxy: { '/api': `http://localhost:${process.env.API_PORT || 8787}` },
  },
});
