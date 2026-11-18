/**
 * Avvisi della capsula del tempo mandati dal server, chiamato da GitHub Actions nei giorni dei traguardi
 * (vedi .github/workflows/capsule-push.yml). Cosa manda:
 *  - alle 18:00 italiane del traguardo (100, 50, 30, 14, 7, 1 giorni alla partenza): "cosa stai facendo adesso?";
 *  - a 46 ore dall'apertura: "la capsula chiude tra 2 ore", solo a chi non ha ancora risposto né saltato.
 * Rispetta "Novità del gruppo" in "Cosa vuoi ricevere" e non manda mai due volte lo stesso avviso (collezione `pushLog`).
 *
 * Variabili: FIREBASE_SERVICE_ACCOUNT (segreto), SITE_URL, DRY_RUN=1 (solo elenco), NOW_ISO (per provare con un'altra data).
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { planCapsulePushes } from '../src/utils/capsulePush';
import type { PushTokenDoc } from '../src/utils/tripPushPlan';
import { pushUrl } from '../src/shared/pushEvents';

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

const tokens: PushTokenDoc[] = [];
for (const d of (await db.collection('pushTokens').get()).docs) {
  const token = d.get('token');
  const uid = d.get('uid');
  if (typeof token !== 'string' || !token || typeof uid !== 'string') continue;
  tokens.push({ id: d.id, uid, token, prefs: (d.get('prefs') as PushTokenDoc['prefs']) ?? {} });
}

// Chi ha già risposto (o saltato), per ogni traguardo
const answered = new Map<number, Set<string>>();
for (const d of (await db.collection('capsule').select('milestone', 'uid').get()).docs) {
  const m = Number(d.get('milestone'));
  const uid = String(d.get('uid') ?? '');
  if (!answered.has(m)) answered.set(m, new Set());
  answered.get(m)!.add(uid);
}

const logged = new Set<string>();
for (const d of (await db.collection('pushLog').where('at', '>', now - 3 * 86_400_000).get()).docs) logged.add(d.id);

const plan = planCapsulePushes({ now, tokens, answered, logged });
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
      data: { title: p.title, body: p.body, url: pushUrl(siteUrl, p.route), tag: p.tag, critical: '0' },
      android: { priority: 'normal' },
      webpush: { headers: { TTL: '7200', Urgency: 'normal' } }
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
