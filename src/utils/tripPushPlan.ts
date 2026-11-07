/**
 * Decide chi deve ricevere quale notifica in questo momento. Puro calcolo, senza Firebase:
 * lo usa scripts/trip-push.mts (e si può provare da solo con dati finti).
 */
import { alertApplies, alertMessage, dueAlerts, isQuietHour, type AlertCategory, type TripAlert } from './tripAlerts';
import type { TravelerSlotId } from '../shared/travelerProfile';
import { expenseMessage, homeMessage, lostMessage, meetupMessage, photoMessage, placeMessage, type PushMessage, type PushRoute } from '../shared/pushEvents';

export interface PushTokenDoc {
  /** id del documento */
  id: string;
  uid: string;
  token: string;
  prefs: Partial<Record<AlertCategory | 'quiet', boolean>>;
}
export interface MemberInfo {
  slot: TravelerSlotId;
  name: string;
}
export interface MeetupInfo {
  id: string;
  label: string;
  at: number;
  createdBy: string;
  createdAt: number;
  fixed: boolean;
}
export interface LiveInfo {
  uid: string;
  lost: number | null;
  /** "sono a casa" e quando */
  home?: number | null;
}
/** Qualcosa aggiunto da un membro: spesa, foto o luogo */
export interface ActivityInfo {
  kind: 'expense' | 'photo' | 'place';
  id: string;
  /** uid di chi l'ha aggiunto */
  by: string;
  createdAt: number;
  /** spesa: titolo · foto: didascalia · luogo: nome */
  text: string;
  /** spesa: centesimi · foto: luogo */
  extra: number | string;
}

export interface PlannedPush {
  /** Chiave per non rimandarla due volte (documento pushLog) */
  key: string;
  category: AlertCategory;
  title: string;
  body: string;
  tag: string;
  route: PushRoute;
  critical: boolean;
  tokens: PushTokenDoc[];
}

const MIN = 60_000;
/** Un avviso resta valido così a lungo dopo l'orario previsto: copre i ritardi dei controlli programmati di GitHub */
export const LOOKBACK_MS = 25 * MIN;

export function planPushes(input: {
  now: number;
  tokens: PushTokenDoc[];
  members: Map<string, MemberInfo>;
  meetups: MeetupInfo[];
  live: LiveInfo[];
  activity?: ActivityInfo[];
  logged: Set<string>;
  alerts?: TripAlert[];
}): PlannedPush[] {
  const { now, tokens, members, meetups, live, logged } = input;
  const out: PlannedPush[] = [];
  const wants = (t: PushTokenDoc, c: AlertCategory) => t.prefs[c] === true;
  const nameOf = (uid: string) => members.get(uid)?.name ?? 'Qualcuno';
  /** Avviso per tutti quelli che lo vogliono, tranne chi l'ha generato */
  const toOthers = (m: PushMessage, author: string) => {
    if (logged.has(m.key)) return;
    const to = tokens.filter((t) => wants(t, m.category) && t.uid !== author);
    if (to.length) out.push({ key: m.key, category: m.category, title: m.title, body: m.body, tag: m.key, route: m.route, critical: m.critical === true, tokens: to });
  };

  for (const a of dueAlerts(now, LOOKBACK_MS, input.alerts)) {
    const key = `a-${a.id}`;
    if (logged.has(key)) continue;
    const msg = alertMessage(a, now);
    const to = tokens.filter((t) => {
      if (!wants(t, a.category)) return false;
      if (!alertApplies(a, members.get(t.uid)?.slot)) return false;
      if (a.category === 'schedule' && t.prefs.quiet !== false && isQuietHour(now)) return false;
      return true;
    });
    out.push(...(to.length ? [{ key, category: a.category, title: msg.title, body: msg.body, tag: key, route: (a.category === 'bookings' ? 'flights' : 'itinerary') as PushRoute, critical: false, tokens: to }] : []));
  }

  for (const m of meetups) {
    if (m.createdAt < now - LOOKBACK_MS || m.at < now - 2 * 3_600_000) continue;
    toOthers(meetupMessage(m.id, m.label, m.at, m.fixed), m.createdBy);
  }

  for (const l of live) {
    if (l.lost && l.lost >= now - LOOKBACK_MS) toOthers(lostMessage(l.uid, l.lost, nameOf(l.uid)), l.uid);
    if (l.home && l.home >= now - LOOKBACK_MS) toOthers(homeMessage(l.uid, l.home, nameOf(l.uid)), l.uid);
  }

  for (const x of input.activity ?? []) {
    if (x.createdAt < now - LOOKBACK_MS) continue;
    const name = nameOf(x.by);
    toOthers(
      x.kind === 'expense'
        ? expenseMessage(x.id, name, x.text, Number(x.extra))
        : x.kind === 'photo'
          ? photoMessage(x.id, name, x.text, String(x.extra))
          : placeMessage(x.id, name, x.text),
      x.by
    );
  }
  return out;
}
