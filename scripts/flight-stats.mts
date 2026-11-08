/**
 * Scarica da AeroDataBox le statistiche di ritardo dei voli del viaggio e le salva in Firestore (flightStats/{volo}).
 * L'app le legge soltanto: la chiave API resta qui, mai nel codice dell'app.
 *
 * Variabili: RAPIDAPI_KEY e FIREBASE_SERVICE_ACCOUNT (segreti), DRY_RUN=1 (stampa senza salvare),
 * FORCE=1 (scarica anche se aggiornate da poco).
 * Costo: una chiamata per volo, che il piano conta come più richieste: per questo si aggiorna al massimo ogni ~40 ore.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { TRACKED_FLIGHTS, normalizeLegEntry, pickEntry, type FlightStatsDoc } from '../src/shared/flightStats';

const env = process.env;
if (!env.RAPIDAPI_KEY) {
  console.log('RAPIDAPI_KEY non impostata: nessuna statistica aggiornata.');
  process.exit(0);
}
const dryRun = env.DRY_RUN === '1';
const MIN_AGE_MS = 40 * 3600 * 1000;

let db: ReturnType<typeof getFirestore> | null = null;
if (!dryRun) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('FIREBASE_SERVICE_ACCOUNT non impostato: nessuna statistica salvata.');
    process.exit(0);
  }
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as never) });
  db = getFirestore();
}

let failures = 0;
for (const t of TRACKED_FLIGHTS) {
  try {
    if (db && env.FORCE !== '1') {
      const prev = await db.collection('flightStats').doc(t.flight).get();
      const at = prev.exists ? Number(prev.data()?.fetchedAt) : 0;
      if (at && Date.now() - at < MIN_AGE_MS) {
        console.log(`${t.flight}: aggiornato da poco, salto.`);
        continue;
      }
    }
    const res = await fetch(`https://aerodatabox.p.rapidapi.com/flights/${t.flight}/delays`, {
      headers: { 'x-rapidapi-key': env.RAPIDAPI_KEY, 'x-rapidapi-host': 'aerodatabox.p.rapidapi.com' },
    });
    const remaining = res.headers.get('x-ratelimit-requests-remaining');
    if (!res.ok) {
      console.error(`${t.flight}: errore ${res.status}`);
      failures++;
      continue;
    }
    const body = (await res.json()) as {
      origins?: Parameters<typeof pickEntry>[0];
      destinations?: Parameters<typeof pickEntry>[0];
    };
    const depRaw = pickEntry(body.origins, t.depIcao);
    const arrRaw = pickEntry(body.destinations, t.arrIcao);
    const doc: FlightStatsDoc = { flight: t.flight, fetchedAt: Date.now() };
    const dep = normalizeLegEntry(depRaw);
    const arr = normalizeLegEntry(arrRaw);
    if (dep) doc.dep = dep;
    if (arr) doc.arr = arr;
    const window = (depRaw ?? arrRaw) as { fromUtc?: string; toUtc?: string } | undefined;
    if (window?.fromUtc) doc.fromUtc = window.fromUtc;
    if (window?.toUtc) doc.toUtc = window.toUtc;
    console.log(`${t.flight}: partenza ${dep ? `${dep.n} voli` : 'senza dati'}, arrivo ${arr ? `${arr.n} voli` : 'senza dati'} (richieste rimaste: ${remaining ?? '?'})`);
    if (dryRun) console.log(JSON.stringify(doc));
    else await db!.collection('flightStats').doc(t.flight).set(doc);
  } catch (err) {
    console.error(`${t.flight}:`, (err as Error).message);
    failures++;
  }
}
// Un errore su un volo non ferma gli altri, ma il lavoro risulta fallito perché si veda su GitHub
process.exitCode = failures > 0 ? 1 : 0;
