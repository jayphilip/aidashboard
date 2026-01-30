import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite', '@electric-sql/pglite-sync'],
  },
  server: {
    port: 5173,
    strictPort: true, // Fail if port is in use instead of using next available
    proxy: {
      '/api/electric': {
        target: process.env.VITE_ELECTRIC_URL || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/electric/, '/v1'),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req, _res) => {
            // Add Electric secret header if available
            const secret = process.env.VITE_ELECTRIC_SECRET;
            if (secret) {
              proxyReq.setHeader('Authorization', `Bearer ${secret}`);
            }
          });
        },
      },
    },
  },
});
