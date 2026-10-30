/**
 * Avvisi del viaggio mandati dal server (anche ad app chiusa), chiamato ogni ~10 minuti da GitHub Actions.
 * Cosa manda:
 *  - il programma (30 minuti prima dei momenti importanti) e i promemoria di voli e prenotazioni;
 *  - un nuovo ritrovo o punto fisso;
 *  - "ho perso il gruppo".
 * Rispetta le scelte di ognuno ("Cosa vuoi ricevere") salvate sul documento del telefono, e non manda mai due volte
 * lo stesso avviso (collezione `pushLog`).
 *
 * Variabili: FIREBASE_SERVICE_ACCOUNT (segreto), SITE_URL, DRY_RUN=1 (solo elenco), NOW_ISO (per provare con un'altra data).
 * Si esegue dopo averlo compilato con esbuild (vedi .github/workflows/trip-push.yml).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { LOOKBACK_MS, planPushes, type LiveInfo, type MeetupInfo, type MemberInfo, type PushTokenDoc } from '../src/utils/tripPushPlan';
import { TRAVELER_SLOT_IDS, type TravelerSlotId } from '../src/shared/travelerProfile';

const env = process.env;
if (!env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('FIREBASE_SERVICE_ACCOUNT non impostato: nessun avviso inviato.');
  process.exit(0);
}
let serviceAccount: Record<string, unknown>;
try {
  serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('FIREBASE_SERVICE_ACCOUNT non è un JSON valido.');
  process.exit(1);
}

const now = env.NOW_ISO ? Date.parse(env.NOW_ISO) : Date.now();
const siteUrl = (env.SITE_URL || './').trim();
const dry = env.DRY_RUN === '1';

initializeApp({ credential: cert(serviceAccount as never) });
const db = getFirestore();

const slotOk = (v: unknown): v is TravelerSlotId => (TRAVELER_SLOT_IDS as readonly unknown[]).includes(v);

const tokens: PushTokenDoc[] = [];
for (const d of (await db.collection('pushTokens').get()).docs) {
  const token = d.get('token');
  const uid = d.get('uid');
  if (typeof token !== 'string' || !token || typeof uid !== 'string') continue;
  tokens.push({ id: d.id, uid, token, prefs: (d.get('prefs') as PushTokenDoc['prefs']) ?? {} });
}

const members = new Map<string, MemberInfo>();
for (const d of (await db.collection('members').get()).docs) {
  const slot = d.get('travelerId');
  if (slotOk(slot)) members.set(d.id, { slot, name: String(d.get('firstName') || d.get('displayName') || 'Qualcuno') });
}

const since = now - LOOKBACK_MS;
const meetups: MeetupInfo[] = (await db.collection('meetups').where('createdAt', '>', Timestamp.fromMillis(since)).get()).docs.map((d) => ({
  id: d.id,
  label: String(d.get('label') ?? ''),
  at: Number(d.get('at') ?? 0),
  createdBy: String(d.get('createdBy') ?? ''),
  createdAt: (d.get('createdAt') as Timestamp).toMillis(),
  fixed: d.get('fixed') === true
}));
const live: LiveInfo[] = (await db.collection('live').where('lost', '>', since).get()).docs.map((d) => ({ uid: d.id, lost: Number(d.get('lost')) }));

// Avvisi già mandati negli ultimi giorni
const logged = new Set<string>();
for (const d of (await db.collection('pushLog').where('at', '>', now - 3 * 86_400_000).get()).docs) logged.add(d.id);

const plan = planPushes({ now, tokens, members, meetups, live, logged });
console.log(`Telefoni: ${tokens.length} · avvisi da mandare: ${plan.length}`);
if (plan.length === 0) process.exit(0);

const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);
const messaging = getMessaging();
for (const p of plan) {
  const byToken = new Map(p.tokens.map((t) => [t.token, t]));
  console.log(`- ${p.key}: "${p.title}" — ${p.body} → ${byToken.size} telefoni`);
  if (dry) continue;
  const list = [...byToken.keys()];
  let sent = 0;
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500);
    const res = await messaging.sendEachForMulticast({
      tokens: chunk,
      data: { title: p.title, body: p.body, url: siteUrl, tag: p.tag },
      webpush: { headers: { TTL: '3600', Urgency: p.category === 'group' ? 'high' : 'normal' } }
    });
    sent += res.successCount;
    for (const [idx, r] of res.responses.entries()) {
      if (r.success) continue;
      const code = r.error?.code ?? 'unknown';
      console.warn(`  invio fallito (${code})`);
      if (DEAD.has(code)) await db.collection('pushTokens').doc(byToken.get(chunk[idx])!.id).delete().catch(() => undefined);
    }
  }
  await db.collection('pushLog').doc(p.key).set({ at: now, sent, total: list.length });
}
