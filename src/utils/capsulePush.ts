/**
 * Chi deve ricevere un avviso della capsula del tempo in questo momento. Puro calcolo, senza Firebase:
 * lo usa scripts/capsule-push.mts.
 */
import { CLOSING_LOOKBACK_MS, MILESTONES, OPEN_LOOKBACK_MS, capsuleMessage, closesAt, fireAt, isQuietRome, reminderAt, stateOf, type Milestone } from './capsule';
import { capsulePostMessage } from '../shared/pushEvents';
import type { PlannedPush, PushTokenDoc } from './tripPushPlan';

/** Una risposta vera (non un "salta") a un traguardo, con l'ora in cui è arrivata */
export interface CapsulePost {
  milestone: number;
  uid: string;
  at: number;
}

/** Un avviso "ha risposto" vale solo per qualche ora: dopo, chi non ha risposto riceve quello di chiusura */
const POST_LOOKBACK_MS = 6 * 3_600_000;

export function planCapsulePushes(input: {
  now: number;
  tokens: PushTokenDoc[];
  /** Per ogni traguardo, gli uid di chi ha risposto o ha scelto di saltare */
  answered: Map<number, Set<string>>;
  logged: Set<string>;
  /** Risposte arrivate di recente: a chi manca arriva "Nome ha risposto" (stessa chiave della funzione in tempo reale: mai due volte) */
  posts?: CapsulePost[];
  names?: Map<string, string>;
}): PlannedPush[] {
  const { now, tokens, answered, logged } = input;
  const wants = (t: PushTokenDoc) => t.prefs.activity === true;
  const due = (at: number, lookback: number) => at <= now && at > now - lookback;
  const out: PlannedPush[] = [];
  // Di notte non si manda nulla: il controllo del mattino recupera gli avvisi ancora validi
  if (isQuietRome(now)) return out;

  for (const m of MILESTONES as readonly Milestone[]) {
    for (const [kind, at, lookback] of [['open', fireAt(m), OPEN_LOOKBACK_MS], ['closing', reminderAt(m), CLOSING_LOOKBACK_MS]] as const) {
      if (!due(at, lookback)) continue;
      const msg = capsuleMessage(m, kind);
      if (logged.has(msg.key)) continue;
      // L'avviso di chiusura va solo a chi non ha ancora risposto
      const done = answered.get(m) ?? new Set<string>();
      const to = tokens.filter((t) => wants(t) && (kind === 'open' || !done.has(t.uid)));
      if (to.length) out.push({ key: msg.key, category: 'activity', title: msg.title, body: msg.body, tag: msg.key, route: 'capsula', critical: false, tokens: to });
    }
  }

  for (const post of input.posts ?? []) {
    const m = post.milestone as Milestone;
    if (!(MILESTONES as readonly number[]).includes(m) || stateOf(m, now) !== 'open' || post.at < now - POST_LOOKBACK_MS) continue;
    const msg = capsulePostMessage(post.milestone, post.uid, input.names?.get(post.uid) ?? 'Qualcuno');
    if (logged.has(msg.key)) continue;
    // Solo a chi non ha ancora risposto né saltato (l'autore ha risposto, quindi è già escluso)
    const done = answered.get(post.milestone) ?? new Set<string>();
    const to = tokens.filter((t) => wants(t) && !done.has(t.uid));
    if (to.length) out.push({ key: msg.key, category: 'activity', title: msg.title, body: msg.body, tag: msg.key, route: 'capsula', critical: false, tokens: to });
  }
  return out;
}
