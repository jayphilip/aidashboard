// web/vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    exclude: ['@electric-sql/pglite', '@electric-sql/pglite-sync'],
  },
  ssr: {
    noExternal: ['@electric-sql/pglite', '@electric-sql/pglite-sync'],
  },
});
