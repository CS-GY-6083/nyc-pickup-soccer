// Builds the clickable prototype (client/prototype) into ONE self-contained
// HTML file: dist-proto/index.html. Fonts, photos, data, CSS and JS are all
// inlined, so it opens offline with no network or CDN requests.
//
//   npm run proto:dev     live prototype on http://localhost:5174
//   npm run proto:build   dist-proto/index.html (single file)
//
// Styles are the app's own: the prototype imports src/index.css, so tokens,
// Tailwind theme names, fonts and the dark variant are identical.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));

// Tailwind scans for class names from Vite's root, which is the prototype
// folder here. Also scan the shared v2 components it renders. (In the app
// the root is client/, so they are scanned already.)
function scanSharedComponents() {
  return {
    name: 'proto:scan-v2-components',
    enforce: 'pre',
    transform(code, id) {
      if (id.split('?')[0].endsWith('/src/index.css')) {
        return { code: `${code}\n@source "./components/v2";\n`, map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  root: here('./prototype'),
  publicDir: false, // photos are imported (and inlined), not copied
  plugins: [scanSharedComponents(), react(), tailwindcss(), viteSingleFile({ removeViteModuleLoader: true })],
  resolve: {
    alias: { '@': here('./src') },
  },
  server: {
    port: 5174,
    fs: { allow: [here('.')] },
  },
  build: {
    outDir: here('./dist-proto'),
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 16000,
    reportCompressedSize: false,
  },
});
