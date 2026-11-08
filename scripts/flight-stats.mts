/**
 * Scarica da AeroDataBox gli ultimi voli operati dei voli del viaggio e ne calcola la puntualità (flightStats/{volo}).
 * L'app le legge soltanto: la chiave API resta qui, mai nel codice dell'app.
 *
 * Come funziona:
 * - lo storico per date accetta al massimo 7 giorni per chiamata: la prima volta si scaricano 4 finestre (~28 giorni),
 *   poi ogni giorno si rilegge solo l'ultima settimana e i voli nuovi si aggiungono a quelli già salvati;
 * - le statistiche si calcolano sui voli conclusi degli ultimi 30 giorni;
 * - se per un lato (partenza o arrivo) i voli sono troppo pochi si ripiega sulla statistica di 90 giorni dell'API.
 *
 * Variabili: RAPIDAPI_KEY e FIREBASE_SERVICE_ACCOUNT (segreti), DRY_RUN=1 (stampa senza salvare),
 * FORCE=1 (scarica anche se aggiornati da poco). Una chiamata costa circa 2 richieste del piano.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  KEEP_DAYS,
  TRACKED_FLIGHTS,
  mergeOps,
  normalizeLegEntry,
  opFromApi,
  pickEntry,
  recentSample,
  statsFromSamples,
  type FlightOp,
  type FlightStatsDoc,
} from '../src/shared/flightStats';

const env = process.env;
if (!env.RAPIDAPI_KEY) {
  console.log('RAPIDAPI_KEY non impostata: nessuna statistica aggiornata.');
  process.exit(0);
}
const dryRun = env.DRY_RUN === '1';
const MIN_AGE_MS = 20 * 3600 * 1000;
const WINDOW_DAYS = 7;
const BOOTSTRAP_WINDOWS = 4;
const HOST = 'aerodatabox.p.rapidapi.com';
const headers = { 'x-rapidapi-key': env.RAPIDAPI_KEY, 'x-rapidapi-host': HOST };

let db: ReturnType<typeof getFirestore> | null = null;
if (!dryRun) {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('FIREBASE_SERVICE_ACCOUNT non impostato: nessuna statistica salvata.');
    process.exit(0);
  }
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) as never) });
  db = getFirestore();
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T00:00`;
};

async function fetchWindow(flight: string, fromMs: number, toMs: number): Promise<FlightOp[]> {
  const url = `https://${HOST}/flights/number/${flight}/${fmtDay(fromMs)}/${fmtDay(toMs)}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`storico ${flight}: errore ${res.status}`);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) return [];
  return body.map((f) => opFromApi(f)).filter((o): o is FlightOp => o !== null);
}

let failures = 0;
const now = Date.now();
const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
for (const t of TRACKED_FLIGHTS) {
  try {
    let prev: FlightStatsDoc | null = null;
    if (db) {
      const snap = await db.collection('flightStats').doc(t.flight).get();
      prev = snap.exists ? (snap.data() as FlightStatsDoc) : null;
      if (prev && env.FORCE !== '1' && prev.ops && now - prev.fetchedAt < MIN_AGE_MS) {
        console.log(`${t.flight}: aggiornato da poco, salto.`);
        continue;
      }
    }
    const prevOps = prev?.ops ?? [];
    // Prima volta (o storia corta): si recuperano ~28 giorni; poi basta l'ultima settimana
    const covered = prevOps.some((o) => o.t < now - 20 * 86400000);
    const windows = covered ? 1 : BOOTSTRAP_WINDOWS;
    const fresh: FlightOp[] = [];
    for (let w = 0; w < windows; w++) {
      const to = today - w * WINDOW_DAYS * 86400000;
      fresh.push(...(await fetchWindow(t.flight, to - WINDOW_DAYS * 86400000, to)));
    }
    const ops = mergeOps(prevOps, fresh, now);
    const sample = recentSample(ops, now);

    let dep = statsFromSamples(t.depIcao, 0, sample.dep);
    let arr = statsFromSamples(t.arrIcao, 0, sample.arr);
    // Pochi voli recenti: ripiego sulla statistica di 90 giorni (una chiamata in più)
    if (!dep || !arr) {
      const res = await fetch(`https://${HOST}/flights/${t.flight}/delays`, { headers });
      if (res.ok) {
        const body = (await res.json()) as { origins?: Parameters<typeof pickEntry>[0]; destinations?: Parameters<typeof pickEntry>[0] };
        if (!dep) dep = normalizeLegEntry(pickEntry(body.origins, t.depIcao));
        if (!arr) arr = normalizeLegEntry(pickEntry(body.destinations, t.arrIcao));
      }
    }

    const doc: FlightStatsDoc = { flight: t.flight, fetchedAt: now, ops, total: sample.total, cancelled: sample.cancelled };
    if (dep) doc.dep = dep;
    if (arr) doc.arr = arr;
    console.log(
      `${t.flight}: ${ops.length} voli salvati (${KEEP_DAYS} giorni), recenti ${sample.total}, ` +
        `partenza ${dep ? `${dep.n} (${dep.source})` : 'senza dati'}, arrivo ${arr ? `${arr.n} (${arr.source})` : 'senza dati'}, cancellati ${sample.cancelled}`
    );
    if (dryRun) console.log(JSON.stringify({ ...doc, ops: `[${ops.length}]` }));
    else await db!.collection('flightStats').doc(t.flight).set(doc);
  } catch (err) {
    console.error(`${t.flight}:`, (err as Error).message);
    failures++;
  }
}
// Un errore su un volo non ferma gli altri, ma il lavoro risulta fallito perché si veda su GitHub
process.exitCode = failures > 0 ? 1 : 0;
