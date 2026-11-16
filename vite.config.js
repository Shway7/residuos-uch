import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: funciona igual en Vercel (raíz) y en GitHub Pages (/repo/).
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 2048,
  },
  server: {
    port: 5173,
    open: false,
  },
});
