/**
 * Avvisa i telefoni (anche ad app chiusa) quando il Posto 1 carica un nuovo PDF dell'itinerario dal sito.
 * Lo esegue ogni ~5 minuti il workflow .github/workflows/pdf-push.yml: legge appFiles/itineraryPdf, e se il PDF è
 * nuovo e non è ancora stato annunciato manda la notifica a chi ha le notifiche attive e la voce "Aggiornamenti".
 * Non manda mai due volte lo stesso avviso (collezione `pushLog`, chiave `pdf-<updatedAt>`).
 *
 * Variabili: FIREBASE_SERVICE_ACCOUNT (segreto), SITE_URL, DRY_RUN=1 (conta i destinatari senza mandare nulla).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const env = process.env;
if (!env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('FIREBASE_SERVICE_ACCOUNT non impostato: nessuna notifica inviata.');
  process.exit(0);
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('FIREBASE_SERVICE_ACCOUNT non è un JSON valido.');
  process.exit(1);
}

/** Un PDF caricato da più di quest'ora non si annuncia più (evita avvisi vecchi al primo avvio). */
const MAX_AGE_MS = 60 * 60 * 1000;
const siteUrl = (env.SITE_URL || './').trim();
const dry = env.DRY_RUN === '1';
const now = Date.now();

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Solo i campi piccoli: il contenuto del PDF non serve per l'avviso
const snap = await db.collection('appFiles').select('updatedAt', 'name', 'size').get();
const file = snap.docs.find((d) => d.id === 'itineraryPdf');
const updatedAt = Number(file?.get('updatedAt'));
if (!file || !Number.isFinite(updatedAt)) {
  console.log('Nessun PDF caricato dal sito: niente da annunciare.');
  process.exit(0);
}

const key = `pdf-${updatedAt}`;
const logRef = db.collection('pushLog').doc(key);
if ((await logRef.get()).exists) {
  console.log(`PDF del ${new Date(updatedAt).toISOString()} già annunciato.`);
  process.exit(0);
}
if (now - updatedAt > MAX_AGE_MS) {
  console.log('PDF caricato da più di un\'ora e mai annunciato: lo segno come visto senza avvisare.');
  if (!dry) await logRef.set({ at: now, sent: 0, total: 0, skipped: 'old' });
  process.exit(0);
}

const title = 'Itinerario aggiornato';
const body = `È stato caricato un nuovo PDF (${String(file.get('name') || 'itinerario').slice(0, 60)}): aprilo per vedere le novità.`;
const url = `${siteUrl.replace(/\/?$/, '/')}?p=pdf`;

const snapshot = await db.collection('pushTokens').where('prefs.updates', '==', true).get();
const byToken = new Map();
for (const d of snapshot.docs) {
  const token = d.get('token');
  if (typeof token !== 'string' || !token) continue;
  byToken.set(token, [...(byToken.get(token) ?? []), d.ref]);
}
const tokens = [...byToken.keys()];
console.log(`Destinatari: ${tokens.length} · "${title}" — ${body}`);
if (dry) process.exit(0);

const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);
const messaging = getMessaging();
let sent = 0;
for (let i = 0; i < tokens.length; i += 500) {
  const chunk = tokens.slice(i, i + 500);
  const res = await messaging.sendEachForMulticast({
    tokens: chunk,
    data: { title, body, url, tag: 'itinerary-pdf' },
    webpush: { headers: { TTL: '86400', Urgency: 'high' } }
  });
  sent += res.successCount;
  for (const [idx, r] of res.responses.entries()) {
    if (r.success) continue;
    const code = r.error?.code ?? 'unknown';
    console.warn(`Invio fallito (${code}) per un telefono.`);
    if (DEAD.has(code)) for (const ref of byToken.get(chunk[idx]) ?? []) await ref.delete().catch(() => undefined);
  }
}
await logRef.set({ at: now, sent, total: tokens.length });
console.log(`Inviate: ${sent}/${tokens.length}`);
