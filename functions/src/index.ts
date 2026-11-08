/**
 * Avvisi in tempo reale (secondi, non minuti): scattano nel momento in cui qualcuno scrive su Firestore.
 *   live/{uid}      → "ha perso il gruppo" (emergenza) e "è a casa"
 *   meetups/{id}    → nuovo ritrovo o punto fisso
 *   expenses/{id}   → nuova spesa · gallery/{id} → nuova foto · places/{id} → nuovo luogo
 *
 * È la "corsia veloce": il controllo programmato di GitHub (scripts/trip-push.mts, ogni ~10 minuti) resta come rete di
 * sicurezza. I due usano le stesse chiavi anti-doppione (collezione `pushLog`) e gli stessi messaggi
 * (src/shared/pushEvents.ts), quindi nessuno riceve lo stesso avviso due volte.
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import { expenseMessage, homeMessage, lostMessage, meetupMessage, pdfMessage, photoMessage, placeMessage, pushUrl, type PushMessage } from '../../src/shared/pushEvents';

// La regione deve essere la stessa (o vicina) del database Firestore: si cambia con FUNCTIONS_REGION in functions/.env
const region = process.env.FUNCTIONS_REGION ?? 'europe-west1';
setGlobalOptions({ region, maxInstances: 5 });

initializeApp();
const db = getFirestore();
const siteUrl = (process.env.SITE_URL ?? './').trim();

const DEAD = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']);

async function nameOf(uid: string): Promise<string> {
  const snap = await db.collection('members').doc(uid).get();
  return String(snap.get('firstName') || snap.get('displayName') || 'Qualcuno');
}

/** Manda l'avviso a chi lo vuole (tranne l'autore), una volta sola. */
async function dispatch(m: PushMessage, authorUid: string): Promise<void> {
  // "create" fallisce se l'avviso esiste già (mandato dal controllo programmato o da un tentativo precedente)
  try {
    await db.collection('pushLog').doc(m.key).create({ at: Date.now(), via: 'function', sent: 0, total: 0 });
  } catch {
    logger.info('Avviso già mandato', { key: m.key });
    return;
  }
  const rows = (await db.collection('pushTokens').where(`prefs.${m.category}`, '==', true).get()).docs.filter((d) => d.get('uid') !== authorUid);
  const byToken = new Map(rows.map((d) => [String(d.get('token')), d.ref] as const));
  const tokens = [...byToken.keys()].filter(Boolean);
  if (tokens.length === 0) return;

  const critical = m.critical === true;
  let sent = 0;
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    const res = await getMessaging().sendEachForMulticast({
      tokens: chunk,
      data: { title: m.title, body: m.body, url: pushUrl(siteUrl, m.route), tag: m.key, critical: critical ? '1' : '0' },
      android: { priority: critical ? 'high' : 'normal' },
      webpush: { headers: { TTL: critical ? '1800' : '3600', Urgency: critical ? 'high' : 'normal' } }
    });
    sent += res.successCount;
    await Promise.all(
      res.responses.map(async (r, idx) => {
        if (!r.success && DEAD.has(r.error?.code ?? '')) await byToken.get(chunk[idx])?.delete().catch(() => undefined);
      })
    );
  }
  await db.collection('pushLog').doc(m.key).set({ at: Date.now(), via: 'function', sent, total: tokens.length });
  logger.info('Avviso inviato', { key: m.key, sent, total: tokens.length });
}

/** Chi è "perso" o "a casa" cambia nel documento live/{uid} */
export const onLiveChange = onDocumentWritten('live/{uid}', async (event) => {
  const after = event.data?.after.data();
  if (!after) return;
  const before = event.data?.before.data();
  const uid = event.params.uid;
  const lost = Number(after.lost);
  if (lost > 0 && lost !== Number(before?.lost)) {
    await dispatch(lostMessage(uid, lost, await nameOf(uid)), uid);
  }
  const at = Number(after.statusAt);
  if (after.status === 'home' && at > 0 && at !== Number(before?.statusAt)) {
    await dispatch(homeMessage(uid, at, await nameOf(uid)), uid);
  }
});

export const onMeetupCreated = onDocumentCreated('meetups/{id}', async (event) => {
  const d = event.data?.data();
  if (!d) return;
  await dispatch(meetupMessage(event.params.id, String(d.label ?? ''), Number(d.at ?? 0), d.fixed === true), String(d.createdBy ?? ''));
});

export const onExpenseCreated = onDocumentCreated('expenses/{id}', async (event) => {
  const d = event.data?.data();
  if (!d) return;
  const by = String(d.createdBy ?? '');
  await dispatch(expenseMessage(event.params.id, await nameOf(by), String(d.title ?? ''), Number(d.amountCents ?? 0)), by);
});

export const onPhotoCreated = onDocumentCreated('gallery/{id}', async (event) => {
  const d = event.data?.data();
  if (!d) return;
  const by = String(d.uploaderId ?? '');
  await dispatch(photoMessage(event.params.id, await nameOf(by), String(d.caption ?? ''), String(d.locationName ?? '')), by);
});

/** Nuovo PDF dell'itinerario: avviso in pochi secondi (il controllo programmato di GitHub arriva con ore di ritardo) */
export const onPdfUploaded = onDocumentWritten('appFiles/itineraryPdf', async (event) => {
  const after = event.data?.after.data();
  if (!after) return;
  const updatedAt = Number(after.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt === Number(event.data?.before.data()?.updatedAt)) return;
  await dispatch(pdfMessage(updatedAt, String(after.name ?? '')), '');
});

export const onPlaceCreated =onDocumentCreated('places/{id}', async (event) => {
  const d = event.data?.data();
  if (!d) return;
  const by = String(d.addedBy ?? '');
  await dispatch(placeMessage(event.params.id, await nameOf(by), String(d.name ?? '')), by);
});

