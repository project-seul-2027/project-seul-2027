import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, CalendarClock, LifeBuoy, MapPin, Moon, Plane, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ACCOMMODATIONS, MAP_LOCATIONS } from '../data/tripData';
import { haversineMeters } from '../data/metroRouter';
import { isSlot } from '../types/expenses';
import type { TravelerSlotId } from '../shared/travelerProfile';
import { isLost, seoulClock, upcomingMeetups } from '../shared/groupLive';
import { useGroupLive } from './group/groupLiveStore';
import { PushToggle } from './PushToggle';
import { syncPushPrefs } from '../notifications';
import { readPrefs as readPrefsNow, usePrefs, writePrefs, type NotifyPrefs } from '../notify/prefs';
import { clearFeed, markFeedSeen, notifyLocal, onToast, useFeed, wasDelivered, type FeedItem } from '../notify/feed';
import {
  ALERT_CATEGORIES, ALL_ALERTS, alertApplies, alertMessage, dueAlerts, estimateTravelMinutes, isQuietHour, relativeIt, type AlertCategory
} from '../utils/tripAlerts';
import { nowOrSim } from '../shared/tripPresence';

const CAT_ICON: Record<AlertCategory, React.ElementType> = { schedule: CalendarClock, bookings: Plane, group: MapPin, updates: Bell };

function useMyContext() {
  const { user } = useAuth();
  const slot: TravelerSlotId | null = user && isSlot(user.travelerId) ? user.travelerId : null;
  const homeAcc = ACCOMMODATIONS.find((a) => a.id === user?.accommodationPreference) ?? ACCOMMODATIONS[2];
  const homeLoc = MAP_LOCATIONS.find((l) => l.id === homeAcc?.id);
  return { user, slot, home: (homeLoc ? [homeLoc.lat, homeLoc.lng] : null) as [number, number] | null };
}

/** Per quanto tempo prima del ritrovo bisogna partire, dalla posizione attuale o da casa */
function departureFor(m: { lat: number; lng: number; at: number }, origin: [number, number] | null) {
  if (!origin) return null;
  const dist = haversineMeters(origin, [m.lat, m.lng]);
  const travel = estimateTravelMinutes(dist);
  return { travel, dist, leaveAt: m.at - (travel + 5) * 60_000 };
}

/* ---------- Motore: sempre montato ---------- */

export const TripNotifierEngine: React.FC = () => {
  const { slot, home } = useMyContext();
  const g = useGroupLive();
  const [toast, setToast] = useState<FeedItem | null>(null);
  const latest = useRef({ g, slot, home });
  latest.current = { g, slot, home };

  useEffect(() => onToast(setToast), []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const check = () => {
      const { g: gl, slot: me, home: h } = latest.current;
      if (!me) return;
      const now = nowOrSim();
      const prefs = readPrefsNow();
      for (const a of dueAlerts(now)) {
        if (!alertApplies(a, me) || wasDelivered(a.id)) continue;
        if (a.category === 'schedule' && prefs.quiet && isQuietHour(now)) continue;
        const msg = alertMessage(a, now);
        void notifyLocal({ id: a.id, category: a.category, title: msg.title, body: msg.body });
      }
      // Ora di partire per un ritrovo
      for (const m of upcomingMeetups(gl.meetups, now)) {
        if (m.answers[me] === 'no' || m.at < now) continue;
        const dep = departureFor(m, gl.myPos ?? h);
        if (!dep || now < dep.leaveAt) continue;
        void notifyLocal({
          id: `dep-${m.id}`,
          category: 'group',
          title: 'È ora di partire per il ritrovo',
          body: `${m.label} alle ${seoulClock(m.at)} · circa ${dep.travel} min da dove sei (stima)`
        });
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    const onVis = () => !document.hidden && check();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  if (!toast) return null;
  const Icon = CAT_ICON[toast.category];
  return createPortal(
    <div role="status" className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[10003] w-[min(92vw,26rem)] px-4 py-3 rounded-2xl bg-slate-100 text-slate-950 shadow-2xl flex items-start gap-3" data-testid="notify-toast">
      <Icon className="w-5 h-5 shrink-0 mt-0.5 text-cyan-700" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">{toast.title}</p>
        <p className="text-xs text-slate-700 mt-0.5 leading-snug">{toast.body}</p>
      </div>
      <button type="button" onClick={() => setToast(null)} className="min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-500" aria-label="Chiudi"><X className="w-4 h-4" /></button>
    </div>,
    document.body
  );
};


/* ---------- Campanella e pannello ---------- */

const Switch: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string; testId?: string }> = ({ on, onChange, label, testId }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${on ? 'bg-cyan-500' : 'bg-slate-700'}`} data-testid={testId}>
    <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
  </button>
);

const Panel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user, slot, home } = useMyContext();
  const g = useGroupLive();
  const prefs = usePrefs();
  const { feed } = useFeed();
  const [now, setNow] = useState(() => nowOrSim());

  useEffect(() => {
    markFeedSeen();
    const id = window.setInterval(() => setNow(nowOrSim()), 30_000);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearInterval(id);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const upcoming = useMemo(() => {
    const rows: { key: string; at: number; icon: React.ElementType; title: string; sub: string; tone?: string }[] = [];
    for (const a of ALL_ALERTS) {
      if (a.eventAt < now || a.eventAt > now + 36 * 3_600_000 || !alertApplies(a, slot ?? undefined)) continue;
      if (!prefs[a.category]) continue;
      rows.push({ key: a.id, at: a.eventAt, icon: CAT_ICON[a.category], title: a.category === 'schedule' ? a.what : a.title, sub: `${relativeIt(a.eventAt - now)} · avviso ${a.fireAt > now ? relativeIt(a.fireAt - now) : 'già mandato'}` });
    }
    for (const m of upcomingMeetups(g.meetups, now)) {
      if (m.at < now || (slot && m.answers[slot] === 'no')) continue;
      const dep = departureFor(m, g.myPos ?? home);
      rows.push({ key: `m-${m.id}`, at: m.at, icon: MapPin, title: `Ritrovo: ${m.label}`, sub: `alle ${seoulClock(m.at)}${dep ? ` · parti entro le ${seoulClock(dep.leaveAt)} (circa ${dep.travel} min)` : ''}`, tone: 'text-amber-200' });
    }
    return rows.sort((a, b) => a.at - b.at).slice(0, 5);
  }, [now, slot, prefs, g.meetups, g.myPos, home]);

  const lostNow = g.live.filter((d) => d.uid !== user?.id && isLost(d, now));

  const change = (patch: Partial<NotifyPrefs>) => {
    writePrefs(patch);
    if (user) void syncPushPrefs(user.id);
  };

  const test = () =>
    notifyLocal({ id: `test-${Date.now()}`, category: 'updates', title: 'Prova di notifica', body: 'Se la vedi, gli avvisi funzionano su questo telefono.' });

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-end sm:items-start sm:justify-end" role="dialog" aria-modal="true" aria-label="Notifiche" data-testid="notify-panel">
      <div className="w-full sm:w-[26rem] sm:mt-16 sm:mr-4 max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800">
          <BellRing className="w-5 h-5 text-cyan-300" />
          <p className="flex-1 text-sm font-bold text-white">Notifiche</p>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-4 py-4 space-y-5">
          {lostNow.map((d) => (
            <div key={d.uid} className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 text-sm text-rose-100 flex gap-2" data-testid="notify-lost">
              <LifeBuoy className="w-4 h-4 mt-0.5 shrink-0" /> Qualcuno ha perso il gruppo: guarda “Il gruppo adesso” nella scheda Oggi.
            </div>
          ))}

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">A breve</h3>
            {upcoming.length === 0 ? (
              <p className="text-xs text-slate-500">Niente in programma nelle prossime 36 ore.</p>
            ) : (
              <ul className="space-y-2" data-testid="notify-upcoming">
                {upcoming.map((r) => {
                  const Icon = r.icon;
                  return (
                    <li key={r.key} className="flex gap-2.5 items-start">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${r.tone ?? 'text-cyan-300'}`} />
                      <div className="min-w-0">
                        <p className="text-xs text-slate-100 leading-snug">{r.title}</p>
                        <p className="text-[11px] text-slate-500">{r.sub}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ricevute</h3>
              {feed.length > 0 && <button type="button" onClick={clearFeed} className="text-[11px] text-slate-400 flex items-center gap-1" data-testid="notify-clear"><Trash2 className="w-3 h-3" /> Svuota</button>}
            </div>
            {feed.length === 0 ? (
              <p className="text-xs text-slate-500">Ancora nessun avviso.</p>
            ) : (
              <ul className="space-y-2" data-testid="notify-feed">
                {feed.slice(0, 8).map((f) => {
                  const Icon = CAT_ICON[f.category];
                  return (
                    <li key={f.id} className="flex gap-2.5 items-start" data-testid="notify-feed-item">
                      <Icon className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-xs text-white font-semibold leading-snug">{f.title}</p>
                        <p className="text-[11px] text-slate-400 leading-snug">{f.body}</p>
                        <p className="text-[10px] text-slate-600">{seoulClock(f.at)} (ora di Seul)</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Cosa vuoi ricevere</h3>
            <ul className="space-y-3">
              {ALERT_CATEGORIES.map((c) => (
                <li key={c.id} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white font-semibold">{c.label}</p>
                    <p className="text-[11px] text-slate-500 leading-snug">{c.hint}</p>
                  </div>
                  <Switch on={prefs[c.id]} onChange={(v) => change({ [c.id]: v } as Partial<NotifyPrefs>)} label={c.label} testId={`notify-pref-${c.id}`} />
                </li>
              ))}
              <li className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-indigo-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-semibold">Niente avvisi di notte</p>
                  <p className="text-[11px] text-slate-500 leading-snug">Dalle 23 alle 7 (ora di Seul) tace il programma. Voli e prenotazioni arrivano comunque.</p>
                </div>
                <Switch on={prefs.quiet} onChange={(v) => change({ quiet: v })} label="Niente avvisi di notte" testId="notify-pref-quiet" />
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <PushToggle variant="sheet" />
            <p className="text-[11px] text-slate-500 leading-snug">
              Con l’app aperta o in secondo piano gli avvisi arrivano sempre. Ad app chiusa arrivano solo con le notifiche attive qui sopra e partono da un controllo del server ogni circa 10 minuti, quindi possono ritardare.
            </p>
            <button type="button" onClick={test} className="w-full min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold" data-testid="notify-test">Prova una notifica</button>
          </section>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const NotificationBell: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { unread } = useFeed();
  const { slot } = useMyContext();
  if (!slot) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative min-h-[40px] min-w-[40px] rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 flex items-center justify-center text-slate-300" aria-label={unread ? `Notifiche, ${unread} nuove` : 'Notifiche'} data-testid="notify-bell">
        <Bell className="w-4.5 h-4.5" />
        {unread > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center" data-testid="notify-unread">{unread}</span>}
      </button>
      {open && <Panel onClose={() => setOpen(false)} />}
    </>
  );
};

export default NotificationBell;
