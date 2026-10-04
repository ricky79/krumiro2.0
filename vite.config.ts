import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// GitHub Pages pubblica il sito su https://ricky79.github.io/krumiro2.0/
const BASE = '/krumiro2.0/';

export default defineConfig(({ mode }) => {
  // `vite build --mode android`: build per l'app Android (Capacitor), senza service worker.
  const android = mode === 'android';
  return {
    base: android ? './' : BASE,
    define: {
      __VERSIONE_APP__: JSON.stringify(pkg.version),
    },
    plugins: [
      VitePWA({
        disable: android,
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          id: BASE,
          name: 'Krumiro',
          short_name: 'Krumiro',
          description: 'Registra le timbrature di lavoro e calcola l\'ora di uscita.',
          lang: 'it',
          dir: 'ltr',
          start_url: BASE,
          scope: BASE,
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f2f2f7',
          theme_color: '#0f766e',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: `${BASE}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    test: { include: ['tests/**/*.test.ts'] },
  };
});
