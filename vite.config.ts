import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The service worker is generated from the build output, so precache names always
// match the hashed assets. No hand-maintained VERSION/SHELL list to keep in sync.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // keep the hand-written public/manifest.webmanifest
      injectRegister: null, // registration is explicit in js/main.ts
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,jpg,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/vendor\//],
        runtimeCaching: [
          {
            // Book covers: show cached immediately, refresh quietly. Cap at 200.
            urlPattern: ({ url }) =>
              url.hostname === 'covers.openlibrary.org' ||
              url.hostname.endsWith('archive.org') ||
              url.hostname === 'books.google.com' ||
              url.hostname.endsWith('googleusercontent.com'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'pawsage-covers',
              expiration: { maxEntries: 200 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Book data, auth and sync must always hit the network.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('supabase.co') ||
              url.hostname === 'openlibrary.org' ||
              url.hostname === 'www.googleapis.com',
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
