/**
 * Changelog del sito: la cronologia dei commit su GitHub, con il numero di versione di ognuno.
 * Il file src/data/changelog.generated.json lo crea scripts/generate-changelog.mjs a ogni `npm run dev`
 * e `npm run build` (e quindi a ogni pubblicazione su GitHub Pages). Non va modificato a mano.
 */

export interface ChangelogEntry {
  /** Es. 1.1.22 */
  version: string;
  sha: string;
  short: string;
  /** Data ISO del commit */
  date: string;
  author: string;
  title: string;
  /** Voci elenco ricavate dal messaggio del commit */
  items: string[];
  /** Primo commit di una serie (x.y.0) */
  release: boolean;
  url: string;
}

export interface ChangelogData {
  repo: string;
  generatedAt: string;
  total: number;
  latest: string;
  /** Dal più recente al più vecchio */
  entries: ChangelogEntry[];
}

// glob: se il file non c'è (zip senza cronologia git) il sito funziona lo stesso e la pagina mostra un avviso
const files = import.meta.glob<ChangelogData>('./changelog.generated.json', { eager: true, import: 'default' });

export const CHANGELOG: ChangelogData | null = Object.values(files)[0] ?? null;

/** Versione di questa build (es. "1.1.22"), se la cronologia git era disponibile */
export const APP_VERSION: string | null = CHANGELOG?.entries[0]?.version ?? null;

export const REPO_URL: string = CHANGELOG?.repo ?? 'https://github.com/IamAxell/project-seul-2027';

/** "1.1.22" → "1.1" */
export function seriesOf(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}
