/**
 * Decide chi deve ricevere quale notifica in questo momento. Puro calcolo, senza Firebase:
 * lo usa scripts/trip-push.mts (e si può provare da solo con dati finti).
 */
import { alertApplies, alertMessage, dueAlerts, isQuietHour, type AlertCategory, type TripAlert } from './tripAlerts';
import type { TravelerSlotId } from '../shared/travelerProfile';

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
}

export interface PlannedPush {
  /** Chiave per non rimandarla due volte (documento pushLog) */
  key: string;
  category: AlertCategory;
  title: string;
  body: string;
  tag: string;
  tokens: PushTokenDoc[];
}

const MIN = 60_000;
/** Un avviso resta valido così a lungo dopo l'orario previsto: copre i ritardi dei controlli programmati di GitHub */
export const LOOKBACK_MS = 25 * MIN;

const seoulClock = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

export function planPushes(input: {
  now: number;
  tokens: PushTokenDoc[];
  members: Map<string, MemberInfo>;
  meetups: MeetupInfo[];
  live: LiveInfo[];
  logged: Set<string>;
  alerts?: TripAlert[];
}): PlannedPush[] {
  const { now, tokens, members, meetups, live, logged } = input;
  const out: PlannedPush[] = [];
  const wants = (t: PushTokenDoc, c: AlertCategory) => t.prefs[c] === true;

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
    if (to.length) out.push({ key, category: a.category, title: msg.title, body: msg.body, tag: key, tokens: to });
  }

  for (const m of meetups) {
    const key = `m-${m.id}`;
    if (logged.has(key) || m.createdAt < now - LOOKBACK_MS || m.at < now - 2 * 3_600_000) continue;
    const to = tokens.filter((t) => wants(t, 'group') && t.uid !== m.createdBy);
    if (to.length) {
      out.push({
        key,
        category: 'group',
        title: m.fixed ? 'Nuovo punto fisso' : 'Nuovo ritrovo',
        body: m.fixed ? m.label : `${m.label} alle ${seoulClock(m.at)}`,
        tag: key,
        tokens: to
      });
    }
  }

  for (const l of live) {
    if (!l.lost || l.lost < now - LOOKBACK_MS) continue;
    const key = `l-${l.uid}-${l.lost}`;
    if (logged.has(key)) continue;
    const name = members.get(l.uid)?.name ?? 'Qualcuno';
    const to = tokens.filter((t) => wants(t, 'group') && t.uid !== l.uid);
    if (to.length) {
      out.push({ key, category: 'group', title: `${name} ha perso il gruppo!`, body: 'Apri l’app: “Il gruppo adesso” mostra dove si trova.', tag: key, tokens: to });
    }
  }
  return out;
}
