import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { appConfig, brandIcon } from '@feather/config/vite';

// Installable app for field phones. The app shell is cached so it opens with no signal;
// entries made offline wait in the phone's outbox and are sent when the network returns.
export default defineConfig(
  appConfig({
    root: import.meta.dirname,
    port: 5174,
    plugins: [
      brandIcon(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'favicon.svg'],
        manifest: {
          name: 'Feather Operations',
          short_name: 'Feather Ops',
          description: 'Siding, gate and dispatch entries for Feather.',
          theme_color: '#1c1c1a',
          background_color: '#f7f7f6',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        },
      }),
    ],
  }),
);
