import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

// Identificativo della versione: l'app lo confronta con version.json online per avvisare quando è uscito un aggiornamento
const BUILD_ID = (process.env.GITHUB_SHA ?? '').slice(0, 7) || `dev-${Date.now().toString(36)}`;

// Numero di versione (es. 1.1.22) creato da scripts/generate-changelog.mjs, se la cronologia git era disponibile
function appVersion(): string | undefined {
  try {
    const file = path.resolve(import.meta.dirname, 'src/data/changelog.generated.json');
    return (JSON.parse(readFileSync(file, 'utf8')) as { latest?: string }).latest;
  } catch {
    return undefined;
  }
}

export default defineConfig(() => {
  return {
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
    // Percorsi relativi: il sito funziona sia in locale sia su GitHub Pages (https://utente.github.io/nome-repo/)
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'emit-version-json',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID, version: appVersion() }) });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
