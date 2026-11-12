/**
 * Compatta le uscite della metro di Seul scaricate da OpenStreetMap (Overpass) in src/data/seoulMetroExits.json.
 *
 * 1. Scarica (una volta, da un computer):
 *    curl -A "seul2027-map" -X POST https://lz4.overpass-api.de/api/interpreter \
 *      --data-urlencode 'data=[out:json][timeout:150];node["railway"="subway_entrance"](37.40,126.60,37.75,127.25);out;' -o exits.raw.json
 * 2. Compatta:  node scripts/metro-exits.mjs exits.raw.json
 *
 * Formato: [[lat, lng, "numero uscita"], ...] con 5 decimali (circa 1 m). Dati © contributori di OpenStreetMap (ODbL).
 */
import fs from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('Uso: node scripts/metro-exits.mjs <file-overpass.json>');
  process.exit(1);
}
const raw = JSON.parse(fs.readFileSync(input, 'utf8'));
const out = [];
for (const e of raw.elements ?? []) {
  if (e.type !== 'node' || typeof e.lat !== 'number' || typeof e.lon !== 'number') continue;
  const ref = String(e.tags?.ref ?? '').trim();
  // senza numero l'uscita non dice niente: si tiene solo se ha una sigla leggibile
  if (!/^[0-9A-Za-z\-]{1,5}$/.test(ref)) continue;
  out.push([Math.round(e.lat * 1e5) / 1e5, Math.round(e.lon * 1e5) / 1e5, ref]);
}
out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
fs.writeFileSync(new URL('../src/data/seoulMetroExits.json', import.meta.url), JSON.stringify(out));
console.log(`${out.length} uscite con numero su ${raw.elements?.length ?? 0}`);
