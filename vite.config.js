import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Cache-first: precache everything the app shell needs to boot,
      // including the sql.js WASM binary — without it, offline cold-start
      // would load the UI but fail to initialize the local database.
      includeAssets: ['favicon.svg', 'icons.svg', 'apple-touch-icon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        // sql-wasm-browser.wasm is a few hundred KB — raise the default
        // 2MB precache limit slightly so it's never skipped.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // The precached HTML would otherwise be served Cache First forever,
        // meaning deleting the real deployment would never "take effect" for
        // anyone who visited before — the Service Worker would keep serving
        // its own local copy indefinitely, even with a live internet connection.
        // NetworkFirst here means: always try the real, current deployment
        // first; only fall back to the cached shell if the network genuinely
        // fails (true offline). JS/CSS/WASM stay on the default Cache First
        // precache strategy since their filenames are content-hashed, so a
        // cached copy is always correct until you actually redeploy.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 4,
            },
          },
        ],
      },
      manifest: {
        name: 'AuraSync — Offline Emergency Coordination',
        short_name: 'AuraSync',
        description: 'Offline-first emergency coordination: walkie-talkie, location sharing, and safe shelters — works with zero internet.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
