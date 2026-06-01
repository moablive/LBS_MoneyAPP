import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // Kill switch: the generated sw.js unregisters any previously installed
      // service worker and clears all its caches on the client's next visit,
      // then reloads — no manual hard-reload needed. The PWA caching was the
      // sole cause of clients getting stuck on a stale ("FINK") build, and
      // this app needs live data anyway, so offline precaching adds no value.
      selfDestroying: true,
      registerType: 'autoUpdate',
      manifest: {
        name: 'MoneyAPP',
        short_name: 'MoneyAPP',
        theme_color: '#0b0f17',
        background_color: '#0b0f17',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/logo/LOGO.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo/LOGO.png', sizes: '512x512', type: 'image/png' },
          { src: '/logo/LOGO.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'api', networkTimeoutSeconds: 4 },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
