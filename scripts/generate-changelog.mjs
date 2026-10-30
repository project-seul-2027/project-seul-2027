#!/usr/bin/env node
/**
 * Genera src/data/changelog.generated.json dalla cronologia git: un commit = un aggiornamento con il suo
 * numero di versione. Viene eseguito in automatico da `npm run dev` e `npm run build` (vedi package.json)
 * e dalla pubblicazione su GitHub Pages, quindi la pagina Changelog si aggiorna a ogni push.
 *
 * COME SI NUMERANO LE VERSIONI
 *   - Si seguono i commit del ramo principale (git log --first-parent) dal più vecchio al più recente.
 *   - Dentro ogni "aggiornamento maggiore" (elenco RELEASES qui sotto) il numero finale sale di 1 a ogni
 *     commit, senza limite: 1.1.0, 1.1.1, ... 1.1.10, 1.1.20, 1.1.123 ...
 *   - Per aprire il prossimo aggiornamento maggiore (es. 2.0.0) basta scrivere in fondo al messaggio del commit
 *     una riga "Release: 2.0": quel commit diventa 2.0.0 e si riparte da 2.0.1, 2.0.2, ...
 *     (in alternativa si può aggiungere una riga a RELEASES con l'hash del commit che deve diventare x.y.0).
 *
 * Con un clone "shallow" (come quello di GitHub Actions) scarica da solo il resto della cronologia. Se non è
 * disponibile (copia scaricata come zip) lo script non fa fallire la build: lascia il file com'è e la pagina
 * mostra un avviso.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- CONFIGURAZIONE -------------------------------------------------------------------------------------
/** `from`: hash (anche corto) del commit che apre quella serie; null = dall'inizio del progetto. */
const RELEASES = [
  { from: null, series: '1.0' }, // 1.0.0, 1.0.1, 1.0.2 ...
  { from: '3a0f64a', series: '1.1' }, // 3a0f64a = 1.1.0, poi 1.1.1, 1.1.2 ...
  { from: 'b9ba4e7', series: '1.2' }
];
const FALLBACK_REPO = 'https://github.com/IamAxell/project-seul-2027';
// ---------------------------------------------------------------------------------------------------------

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outFile = path.join(root, 'src', 'data', 'changelog.generated.json');

const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

function skip(reason) {
  console.warn(`[changelog] ${reason}: la pagina Changelog resta com'è.`);
  process.exit(0);
}

function repoUrl() {
  try {
    let url = git('remote', 'get-url', 'origin').trim();
    url = url.replace(/^git@github\.com:/, 'https://github.com/').replace(/^ssh:\/\/git@github\.com\//, 'https://github.com/');
    url = url.replace(/^https:\/\/[^@/]+@/, 'https://').replace(/\.git$/, '').replace(/\/$/, '');
    return /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(url) ? url : FALLBACK_REPO;
  } catch {
    return FALLBACK_REPO;
  }
}

const TRAILER = /^((co-authored-by|claude-session|signed-off-by|generated with)\b|release:)/i;
const clean = (s) => s.replace(/^﻿/, '').replace(/\s+/g, ' ').trim();

/** Titolo e punti elenco: i messaggi con "titolo - voce - voce" (commit unificati) vengono separati */
function describe(subject, body) {
  let title = clean(subject);
  const items = [];
  const parts = title.split(/\s+-\s+/);
  if (parts.length >= 3 || /:\s+-\s+/.test(title)) {
    title = clean(parts[0]).replace(/:$/, '');
    for (const p of parts.slice(1)) if (clean(p)) items.push(clean(p));
  }
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line || TRAILER.test(line)) continue;
    const text = clean(line.replace(/^[-*•]\s+/, ''));
    if (text) items.push(text);
  }
  return { title, items };
}

let hashes;
try {
  if (git('rev-parse', '--is-shallow-repository').trim() === 'true') {
    // GitHub Actions clona solo l'ultimo commit: si scarica il resto della cronologia
    try {
      console.log('[changelog] Clone parziale: scarico la cronologia completa…');
      git('fetch', '--unshallow', '--quiet');
    } catch {
      skip('Clone incompleto e cronologia non scaricabile');
    }
  }
  hashes = git('rev-list', '--first-parent', '--reverse', 'HEAD').split('\n').filter(Boolean);
} catch {
  skip('Cronologia git non disponibile');
}
if (hashes.length === 0) skip('Nessun commit trovato');

const SEP_FIELD = '\x1f';
const SEP_RECORD = '\x1e';
const raw = git('log', '--first-parent', '--reverse', `--format=%H${SEP_FIELD}%aI${SEP_FIELD}%an${SEP_FIELD}%s${SEP_FIELD}%b${SEP_RECORD}`, 'HEAD');
const commits = raw.split(SEP_RECORD).map((r) => r.replace(/^\n+/, '')).filter(Boolean);

// Posizione di partenza di ogni serie (se un hash non esiste più, per esempio dopo una riscrittura della storia, la serie salta)
const starts = RELEASES.map((r) => {
  if (r.from === null) return { series: r.series, index: 0 };
  const index = hashes.findIndex((h) => h.startsWith(r.from));
  if (index === -1) console.warn(`[changelog] Commit ${r.from} (serie ${r.series}) non trovato nella cronologia: serie ignorata.`);
  return { series: r.series, index };
}).filter((s) => s.index !== -1);

// Si può aprire una nuova serie anche scrivendo nel messaggio del commit una riga "Release: 2.0": quel commit diventa 2.0.0
commits.forEach((rec, i) => {
  const [, , , subject = '', body = ''] = rec.split(SEP_FIELD);
  const m = `${subject}\n${body}`.match(/^release:\s*v?(\d+\.\d+)(?:\.0)?\s*$/im);
  if (m && !starts.some((s) => s.index === i)) starts.push({ series: m[1], index: i });
});
starts.sort((a, b) => a.index - b.index);

const repo = repoUrl();
const entries = commits.map((rec, i) => {
  const [sha, date, author, subject, body = ''] = rec.split(SEP_FIELD);
  let start = starts[0];
  for (const s of starts) if (s.index <= i) start = s;
  const patch = i - start.index;
  const { title, items } = describe(subject ?? '', body);
  return {
    version: `${start.series}.${patch}`,
    sha,
    short: sha.slice(0, 7),
    date,
    author: clean(author ?? ''),
    title,
    items,
    release: patch === 0,
    url: `${repo}/commit/${sha}`
  };
});

entries.reverse(); // dal più recente

const data = { repo, generatedAt: new Date().toISOString(), total: entries.length, latest: entries[0].version, entries };
mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`[changelog] ${entries.length} aggiornamenti, ultima versione ${data.latest}`);
