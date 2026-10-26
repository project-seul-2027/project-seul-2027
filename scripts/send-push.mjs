/**
 * Manda una notifica push a tutti i telefoni che l'hanno attivata (collezione Firestore `pushTokens`).
 * Lo usano i workflow di GitHub: dopo ogni deploy (nuovo aggiornamento) o a mano (messaggio libero).
 *
 * Variabili d'ambiente:
 *   FIREBASE_SERVICE_ACCOUNT  JSON dell'account di servizio Firebase (segreto del repository)
 *   PUSH_TITLE, PUSH_BODY     testo della notifica (se mancano: avviso di nuova versione)
 *   SITE_URL                  indirizzo del sito (si apre toccando la notifica)
 *   EXPECT_BUILD              (facoltativa) commit appena pubblicato: si aspetta che sia online prima di avvisare
 *   PUSH_TAG                  (facoltativa) le notifiche con lo stesso tag si sostituiscono a vicenda
 *   DRY_RUN=1                 conta i destinatari senza mandare nulla
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
  console.error('FIREBASE_SERVICE_ACCOUNT non è un JSON valido: incolla nel segreto tutto il file scaricato da Firebase.');
  process.exit(1);
}

const siteUrl = (env.SITE_URL || './').trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Legge version.json dal sito pubblicato; se EXPECT_BUILD è impostato aspetta (max ~2 minuti) che sia quello nuovo */
async function liveVersion() {
  if (!/^https?:/.test(siteUrl)) return null;
  const expect = (env.EXPECT_BUILD || '').slice(0, 7);
  let last = null;
  for (let attempt = 0; attempt < (expect ? 12 : 1); attempt++) {
    try {
      const res = await fetch(`${siteUrl.replace(/\/?$/, '/')}version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        last = await res.json();
        if (!expect || last.build === expect) return last;
      }
    } catch {
      // il sito potrebbe non essere ancora raggiungibile: si riprova
    }
    if (expect) await sleep(10_000);
  }
  if (expect) console.warn(`La versione ${expect} non risulta ancora online: invio comunque l'avviso.`);
  return last;
}

let title = env.PUSH_TITLE?.trim();
let body = env.PUSH_BODY?.trim();
let tag = env.PUSH_TAG?.trim();
if (!title) {
  const live = await liveVersion();
  const subject = (env.COMMIT_MESSAGE || '').split('\n')[0].trim();
  title = live?.version ? `Nuovo aggiornamento · v${live.version}` : 'Nuovo aggiornamento';
  body = body || subject || "È disponibile una nuova versione dell'app: aprila per aggiornarla.";
  tag = tag || 'app-update';
}
tag = tag || `msg-${Date.now()}`;

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snapshot = await db.collection('pushTokens').where('prefs.updates', '==', true).get();
/** token → documenti che lo contengono (di solito uno) */
const byToken = new Map();
for (const docSnap of snapshot.docs) {
  const token = docSnap.get('token');
  if (typeof token !== 'string' || !token) continue;
  byToken.set(token, [...(byToken.get(token) ?? []), docSnap.ref]);
}
const tokens = [...byToken.keys()];
console.log(`Destinatari: ${tokens.length} · "${title}" — ${body}`);
if (tokens.length === 0 || env.DRY_RUN === '1') process.exit(0);

const DEAD = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);
const messaging = getMessaging();
let sent = 0;
let removed = 0;
for (let i = 0; i < tokens.length; i += 500) {
  const chunk = tokens.slice(i, i + 500);
  const result = await messaging.sendEachForMulticast({
    tokens: chunk,
    data: { title, body, url: siteUrl, tag },
    webpush: { headers: { TTL: '86400', Urgency: 'high' } }
  });
  sent += result.successCount;
  for (const [index, response] of result.responses.entries()) {
    if (response.success) continue;
    const code = response.error?.code ?? 'unknown';
    console.warn(`Invio fallito (${code}) per un telefono.`);
    if (DEAD.has(code)) {
      for (const ref of byToken.get(chunk[index]) ?? []) {
        await ref.delete();
        removed++;
      }
    }
  }
}
console.log(`Inviate: ${sent}/${tokens.length} · telefoni non più validi rimossi: ${removed}`);
