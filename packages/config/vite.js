import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

/**
 * Base Vite config shared by the Owner and Operations apps.
 *  - `@/` → the app's own src/
 *  - `/api` is proxied to the backend in development (no CORS, same-origin photos)
 */
export function appConfig({ root, port, plugins = [] }) {
  const apiTarget = process.env.VITE_API_PROXY ?? 'http://localhost:4000';
  return {
    plugins: [react(), tailwindcss(), ...plugins],
    resolve: {
      alias: { '@': path.resolve(root, 'src') },
    },
    server: {
      port,
      strictPort: true,
      proxy: { '/api': { target: apiTarget, changeOrigin: true } },
    },
    preview: { port, proxy: { '/api': { target: apiTarget, changeOrigin: true } } },
    build: { sourcemap: false, chunkSizeWarningLimit: 900 },
  };
}

/**
 * Serves and emits the brand icons from packages/assets/brand/logo.svg, so they never go
 * out of sync with the logo:
 *  - /icon.svg    → the logo as-is (PWA / home-screen icon)
 *  - /favicon.svg → the logo, inverted when the browser is in dark mode so it stays
 *                   visible on a dark tab bar
 */
export function brandIcon() {
  const source = path.resolve(import.meta.dirname, '../assets/brand/logo.svg');
  const darkAware = (svg) =>
    svg.replace(/<svg([^>]*)>/, '<svg$1><style>@media (prefers-color-scheme: dark){:root{filter:invert(100%)}}</style>');
  const files = async () => {
    const { readFile } = await import('node:fs/promises');
    const logo = await readFile(source, 'utf8');
    return { 'icon.svg': logo, 'favicon.svg': darkAware(logo) };
  };
  return {
    name: 'feather-brand-icon',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = req.url?.split('?')[0].slice(1);
        if (name !== 'icon.svg' && name !== 'favicon.svg') return next();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-cache');
        res.end((await files())[name]);
      });
    },
    async generateBundle() {
      for (const [fileName, source] of Object.entries(await files())) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
