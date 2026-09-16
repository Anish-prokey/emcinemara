import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    /**
     * Installable, and playable with no network.
     *
     * The game is a good fit for this: there is no backend, every puzzle for
     * the next several months is already in the bundle, and progress lives in
     * localStorage. Once the shell is cached the only thing that still wants
     * the network is TMDB artwork, and that is cached as it is seen.
     */
    VitePWA({
      // A daily game should never strand someone on yesterday's build waiting
      // for a prompt they will not read.
      registerType: 'autoUpdate',
      // Registered by hand in main.tsx rather than injected into index.html, so
      // it can be skipped inside the Android app.
      injectRegister: null,
      // So the worker can actually be exercised against `npm run dev`, rather
      // than only existing in a production build nobody tests until deploy.
      devOptions: { enabled: true, type: 'module' },
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'EmCinemaRa — Guess the movie',
        short_name: 'EmCinemaRa',
        description:
          'Ten guesses to name the film of the day. Hindi, Tamil, Telugu, Malayalam, Kannada and English, each with its own puzzle every day.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#000000',
        background_color: '#000000',
        categories: ['games', 'entertainment', 'trivia'],
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            // Android crops launcher icons to whatever shape the launcher
            // likes, so this one is full-bleed with the mark well inside.
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The bundle carries the whole film library, which is comfortably over
        // Workbox's 2MB default and would otherwise be silently left out of the
        // precache — the one file the app cannot start without.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Posters and stills. They never change under a given URL — TMDB
            // hashes the filename — so they can be served from cache first and
            // stay available offline once seen.
            urlPattern: /^https:\/\/image\.tmdb\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tmdb-images',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  /*
   * There used to be an `esbuild: { charset: 'ascii' }` here, to escape every
   * non-ASCII character in the output — the dataset and UI carry Devanagari,
   * Tamil, Telugu, Malayalam and Kannada, and a bundle served as Latin-1 dies
   * at module load.
   *
   * Vite 8 transforms with oxc instead of esbuild and ignored the option,
   * saying so only in a build warning nobody was reading: the output has
   * carried ~94,000 raw non-ASCII bytes since that upgrade. OxcOptions has no
   * equivalent, so the guarantee is gone and pretending otherwise in a comment
   * is worse than not having it.
   *
   * What actually holds the line now: the entry is `<script type="module">`,
   * and the HTML spec decodes module scripts as UTF-8 regardless of what the
   * server claims, so a mislabelled Content-Type can no longer break it. The
   * <meta charset="UTF-8"> in index.html covers the document itself. If the
   * bundle ever needs to be loaded as a classic script, this has to be
   * revisited.
   */
})
