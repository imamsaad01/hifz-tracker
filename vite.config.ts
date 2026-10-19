import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
// Also ship PGlite's file bundle as assets/pglite-fs.wasm, for static hosts that refuse unknown types like .data.
const pgliteFsBundle = (): Plugin => ({
  name: 'pglite-fs-bundle', apply: 'build',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'assets/pglite-fs.wasm', source: fs.readFileSync(path.resolve('node_modules/@electric-sql/pglite/dist/pglite.data')) }); },
});
// base './' so the same build works at a domain root (Vercel) or in a sub-folder; routing uses #/ so no rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react(), pgliteFsBundle()],
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: { chunkSizeWarningLimit: 700 },
  test: { environment: 'node', testTimeout: 60000 },
} as never);
