/**
 * Chi deve ricevere un avviso della capsula del tempo in questo momento. Puro calcolo, senza Firebase:
 * lo usa scripts/capsule-push.mts.
 */
import { CLOSING_LOOKBACK_MS, MILESTONES, OPEN_LOOKBACK_MS, capsuleMessage, fireAt, reminderAt, type Milestone } from './capsule';
import type { PlannedPush, PushTokenDoc } from './tripPushPlan';

export function planCapsulePushes(input: {
  now: number;
  tokens: PushTokenDoc[];
  /** Per ogni traguardo, gli uid di chi ha risposto o ha scelto di saltare */
  answered: Map<number, Set<string>>;
  logged: Set<string>;
}): PlannedPush[] {
  const { now, tokens, answered, logged } = input;
  const wants = (t: PushTokenDoc) => t.prefs.activity === true;
  const due = (at: number, lookback: number) => at <= now && at > now - lookback;
  const out: PlannedPush[] = [];

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
  return out;
}
