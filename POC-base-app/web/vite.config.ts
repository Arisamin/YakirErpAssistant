import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// אפליקציית PWA — ניתנת להתקנה במחשב ובנייד
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: '<CompNamePlaceHolder> — ניהול פרויקטלי',
        short_name: '<CompNamePlaceHolder>',
        description: 'מערכת ניהול פרויקטלי-פיננסי של <CompLTDNamePlaceHolder>',
        lang: 'he',
        dir: 'rtl',
        theme_color: '#1f5f8b',
        background_color: '#f4f6f9',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 5173 },
});
