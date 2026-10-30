import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
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
  let outDir = '';
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
        // Elenco dei file dell'app: serve al pulsante "Scarica per l'offline" per salvarli tutti sul telefono.
        // Si legge dalla cartella di uscita a build finita, così contiene solo file che esistono davvero
        // (dall'elenco interno del bundler comparivano anche pezzi poi uniti ad altri e mai pubblicati: errore 404).
        name: 'emit-offline-manifest',
        enforce: 'post' as const,
        apply: 'build' as const,
        configResolved(config: { root: string; build: { outDir: string } }) {
          outDir = path.resolve(config.root, config.build.outDir);
        },
        closeBundle() {
          // Video, schermate di avvio e PDF restano fuori (il PDF lo aggiunge l'app con la sua versione)
          const skipDir = new Set(['splash']);
          const skipFile = /\.(mp4|webm|pdf|map)$|^(sw\.js|version\.json|offline-manifest\.json)$/i;
          const files: { url: string; bytes: number }[] = [];
          const walk = (rel: string) => {
            for (const name of readdirSync(path.join(outDir, rel))) {
              const relPath = rel ? `${rel}/${name}` : name;
              const st = statSync(path.join(outDir, relPath));
              if (st.isDirectory()) {
                if (!skipDir.has(name)) walk(relPath);
              } else if (!skipFile.test(name)) {
                files.push({ url: relPath, bytes: st.size });
              }
            }
          };
          walk('');
          writeFileSync(path.join(outDir, 'offline-manifest.json'), JSON.stringify({ build: BUILD_ID, files }));
        },
      },
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
