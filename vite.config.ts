import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue(), crx({ manifest })],
  server: {
    // Bind explicitly to IPv4 — Vite's default `localhost` resolves to `::1`
    // on macOS, which Chrome's extension fetch sometimes can't reach.
    host: '127.0.0.1',
    // CRXJS bakes the dev server URL into the loaded extension, so keep the
    // port stable across restarts (vs. silently falling back if 5173 is busy).
    port: 5173,
    strictPort: true,
  },
})
