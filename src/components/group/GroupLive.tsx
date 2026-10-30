import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Home, MapPin, Navigation, Plus, Radio, Trash2, Users, X, CircleAlert, Clock, Check, Map as MapIcon, Loader2, LifeBuoy, Flag
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ACCOMMODATIONS, MAP_LOCATIONS } from '../../data/tripData';
import { haversineMeters } from '../../data/metroRouter';
import type { TravelerSlotId } from '../../shared/travelerProfile';
import { isSlot } from '../../types/expenses';
import { nowOrSim, presentSlots, seoulDateIso } from '../../shared/tripPresence';
import {
  ANSWER_LABEL, activeShare, endOfSeoulDay, fixedPoint, formatAgo, formatDistance, isHome, isLost, seoulClock, untilMorning, upcomingMeetups,
  STALE_POSITION_MS, type LiveDoc, type Meetup, type MeetupAnswer
} from '../../shared/groupLive';
import {
  addMeetup, answer, clearLost, configureMe, currentPosition, dismissNotice, markHome, markOut, removeMeetup, reportLost, resumeSharing,
  setSharingAllowed, startSharing, stopSharing, useGroupLive
} from './groupLiveStore';

/** La condivisione "per il ritrovo" finisce mezz'ora dopo l'ora fissata */
const MEETUP_SHARE_AFTER_MS = 30 * 60_000;

function shareModeText(g: { trackMode: string; batterySaver: boolean; precise: boolean; paused: boolean }): string {
  if (g.paused) return 'In pausa con lo schermo spento: riparte appena riapri l’app.';
  if (g.batterySaver) return 'Batteria bassa: controllo la posizione ogni 5 minuti.';
  if (g.trackMode === 'still') return 'Sei fermo: controllo la posizione solo ogni 3 minuti per risparmiare batteria.';
  if (g.precise) return 'È l’ora del ritrovo: uso il GPS preciso per trovarvi.';
  return 'Ti stai muovendo: aggiorno la posizione con poco consumo.';
}
import { formatCountdown } from '../../utils/tripClock';
import { notifyLocal } from '../../notify/feed';

function useTick(ms = 30_000) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return t;
}

function useMe() {
  const { user, travelers } = useAuth();
  const slot: TravelerSlotId | null = user && isSlot(user.travelerId) ? user.travelerId : null;
  const homeAcc = ACCOMMODATIONS.find((a) => a.id === user?.accommodationPreference) ?? ACCOMMODATIONS[2];
  const homeLoc = MAP_LOCATIONS.find((l) => l.id === homeAcc?.id);
  const bySlot = useMemo(() => Object.fromEntries(travelers.map((t) => [t.id, t])), [travelers]);
  return { user, slot, homeAcc, homeLoc, bySlot };
}

/* ---------- Motore: sempre montato nell'app ---------- */

/** Collega l'utente al gruppo, riprende la condivisione dopo una ricarica e mostra gli avvisi ad app aperta. */
export const GroupLiveEngine: React.FC = () => {
  const { user, slot, homeAcc, homeLoc, bySlot } = useMe();
  const { live, meetups } = useGroupLive();
  const [toast, setToast] = useState<string | null>(null);
  const since = useRef(Date.now());
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !slot) return configureMe(null);
    configureMe({ uid: user.id, slot, homeName: homeAcc?.name ?? 'Alloggio', home: homeAcc ? [homeAcc.lat, homeAcc.lng] : homeLoc ? [homeLoc.lat, homeLoc.lng] : null });
    resumeSharing();
  }, [user, slot, homeAcc, homeLoc]);

  // Avvisi solo per le novità arrivate mentre l'app è aperta
  useEffect(() => {
    for (const d of live) {
      if (d.uid === user?.id || d.status !== 'home' || !d.statusAt || d.statusAt < since.current) continue;
      const k = `home-${d.uid}-${d.statusAt}`;
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      setToast(`${bySlot[d.slot]?.name ?? 'Qualcuno'} è a casa`);
      void notifyLocal({ id: k, category: 'group', title: `${bySlot[d.slot]?.name ?? 'Qualcuno'} è a casa`, body: 'È arrivato all’alloggio.', toast: false });
    }
    for (const d of live) {
      if (d.uid === user?.id || !d.lost || d.lost < since.current) continue;
      const k = `lost-${d.uid}-${d.lost}`;
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      setToast(`${bySlot[d.slot]?.name ?? 'Qualcuno'} ha perso il gruppo!`);
      void notifyLocal({ id: k, category: 'group', title: `${bySlot[d.slot]?.name ?? 'Qualcuno'} ha perso il gruppo!`, body: 'Apri “Il gruppo adesso” per vedere dove si trova.', toast: false });
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* non essenziale */
      }
    }
    for (const m of meetups) {
      if (m.createdBy === user?.id || !m.createdAt || m.createdAt < since.current) continue;
      const k = `meet-${m.id}`;
      if (seen.current.has(k)) continue;
      seen.current.add(k);
      setToast(m.fixed ? `Punto fisso: ${m.label}` : `Nuovo ritrovo: ${m.label} alle ${seoulClock(m.at)}`);
      void notifyLocal({ id: k, category: 'group', title: m.fixed ? 'Nuovo punto fisso' : 'Nuovo ritrovo', body: m.fixed ? m.label : `${m.label} alle ${seoulClock(m.at)}`, toast: false });
    }
  }, [live, meetups, user, bySlot]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!toast) return null;
  return createPortal(
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[10002] px-4 py-2.5 rounded-2xl bg-cyan-400 text-slate-950 text-sm font-bold shadow-2xl max-w-[90vw] flex items-center gap-2"
      data-testid="group-toast"
    >
      <Users className="w-4 h-4" /> {toast}
    </div>,
    document.body
  );
};

/* ---------- Ritrovo: nuovo ---------- */

const MeetupSheet: React.FC<{ onClose: () => void; fixed?: boolean }> = ({ onClose, fixed = false }) => {
  const places = useMemo(() => {
    const seoul = MAP_LOCATIONS.filter((l) => l.city === 'Seul' || l.city === 'Dintorni / Gite');
    return [...seoul.filter((l) => l.category === 'alloggio'), ...seoul.filter((l) => l.category !== 'alloggio').sort((a, b) => a.italianName.localeCompare(b.italianName))];
  }, []);
  const defaultTime = () => {
    const t = Date.now() + 60 * 60_000;
    const kst = new Date(t + 9 * 3_600_000);
    const m = Math.ceil(kst.getUTCMinutes() / 15) * 15;
    const h = (kst.getUTCHours() + Math.floor(m / 60)) % 24;
    return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const [placeId, setPlaceId] = useState<string>('here');
  const [label, setLabel] = useState('');
  const [time, setTime] = useState(defaultTime);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const save = async () => {
    setError(null);
    const m = /^(\d{2}):(\d{2})$/.exec(fixed ? '00:00' : time);
    if (!m) return setError('Scegli l’ora.');
    // Oggi a Seul a quell'ora; se è già passata (di oltre un'ora), domani
    const now = Date.now();
    const day = seoulDateIso(now);
    let at = Date.parse(`${day}T${m[1]}:${m[2]}:00+09:00`);
    if (at < now - 60 * 60_000) at += 86_400_000;
    setBusy(true);
    try {
      let lat: number;
      let lng: number;
      let name = label.trim();
      let pid: string | null = null;
      if (placeId === 'here') {
        [lat, lng] = await currentPosition();
        if (!name) name = 'Qui (posizione condivisa)';
      } else {
        const p = MAP_LOCATIONS.find((l) => l.id === placeId)!;
        lat = p.lat;
        lng = p.lng;
        pid = p.id;
        if (!name) name = p.italianName || p.name;
      }
      await addMeetup({ label: name, placeId: pid, lat, lng, at: fixed ? endOfSeoulDay(now) : at, note, fixed });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Non sono riuscito a salvare il ritrovo.');
      setBusy(false);
    }
  };

  const input = 'w-full min-h-[46px] rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:outline-none px-3 text-sm text-white';
  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={fixed ? 'Punto fisso' : 'Nuovo ritrovo'} data-testid="meetup-sheet">
      <div className="w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800">
          <MapPin className="w-5 h-5 text-amber-300" />
          <p className="flex-1 text-sm font-bold text-white">{fixed ? 'Punto fisso: se ci perdiamo' : 'Fissa un ritrovo'}</p>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-4 py-4 space-y-3">
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Dove</span>
            <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={input} data-testid="meetup-place">
              <option value="here">Dove sono adesso (GPS)</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>{p.category === 'alloggio' ? '🏠 ' : ''}{p.italianName || p.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Punto preciso (facoltativo)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="es. Uscita 9 di Hongik Univ." className={input} data-testid="meetup-label" />
          </label>
          {fixed ? (
            <p className="text-[11px] text-slate-400 leading-snug">Vale fino a stanotte: se qualcuno perde il gruppo, il punto è sempre in vista nella scheda del gruppo.</p>
          ) : (
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Ora (Seul)</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${input} [color-scheme:dark] w-40`} data-testid="meetup-time" />
            </label>
          )}
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Nota (facoltativa)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="es. Davanti al minimarket GS25" className={input} />
          </label>
          {error && <p role="alert" className="text-xs text-amber-300 flex gap-1.5"><CircleAlert className="w-4 h-4 shrink-0" />{error}</p>}
        </div>
        <div className="px-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-200 text-sm font-semibold">Annulla</button>
          <button type="button" onClick={save} disabled={busy} className="min-h-[48px] rounded-2xl bg-amber-400 disabled:opacity-50 text-slate-950 text-sm font-bold flex items-center justify-center gap-2" data-testid="meetup-save">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {fixed ? 'Fissa il punto' : 'Avvisa il gruppo'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ---------- Ritrovo: scheda ---------- */

const MeetupCard: React.FC<{
  m: Meetup;
  now: number;
  mySlot: TravelerSlotId | null;
  myUid: string;
  bySlot: Record<string, { name: string; color: string }>;
  slots: TravelerSlotId[];
  onRoute?: (placeId: string) => void;
}> = ({ m, now, mySlot, myUid, bySlot, slots, onRoute }) => {
  const mine = mySlot ? m.answers[mySlot] : undefined;
  const left = m.at - now;
  const past = left < 0;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3" data-testid="meetup-card">
      <div className="flex items-start gap-2.5">
        <MapPin className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white leading-tight">{m.label}</p>
          <p className="text-xs text-amber-100 flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3.5 h-3.5" /> {seoulClock(m.at)} · {past ? `${formatCountdown(-left)} fa` : `tra ${formatCountdown(left)}`}
          </p>
          {m.note && <p className="text-[11px] text-amber-50/80 mt-1">{m.note}</p>}
        </div>
        {(m.createdBy === myUid || past) && (
          <button type="button" onClick={() => removeMeetup(m.id)} className="min-h-[40px] min-w-[40px] rounded-lg text-amber-200/70 hover:text-rose-200 flex items-center justify-center" aria-label="Elimina il ritrovo">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {slots.map((s) => {
          const a = m.answers[s];
          return (
            <span key={s} className={`text-[10.5px] font-semibold rounded-full px-2 py-0.5 flex items-center gap-1 ${a === 'ok' ? 'bg-emerald-500/20 text-emerald-200' : a === 'late' ? 'bg-amber-400/25 text-amber-100' : a === 'no' ? 'bg-rose-500/20 text-rose-200 line-through' : 'bg-slate-800/80 text-slate-400'}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bySlot[s]?.color }} />
              {s === mySlot ? 'Tu' : bySlot[s]?.name ?? s}
              {a ? ` · ${ANSWER_LABEL[a].toLowerCase()}` : ''}
            </span>
          );
        })}
      </div>
      {mySlot && !past && (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5" role="group" aria-label="La tua risposta">
          {(['ok', 'late', 'no'] as MeetupAnswer[]).map((a) => (
            <button key={a} type="button" onClick={() => answer(m.id, a)} aria-pressed={mine === a} className={`min-h-[40px] rounded-xl text-xs font-bold ${mine === a ? 'bg-amber-400 text-slate-950' : 'bg-slate-900/70 text-slate-200'}`} data-testid={`meetup-answer-${a}`}>
              {ANSWER_LABEL[a]}
            </button>
          ))}
        </div>
      )}
      <div className="mt-2 flex gap-1.5">
        {m.placeId && onRoute ? (
          <button type="button" onClick={() => onRoute(m.placeId!)} className="flex-1 min-h-[40px] rounded-xl bg-slate-900/80 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" /> Portami lì
          </button>
        ) : (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1 min-h-[40px] rounded-xl bg-slate-900/80 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5">
            <MapIcon className="w-3.5 h-3.5" /> Apri sulla mappa
          </a>
        )}
      </div>
    </div>
  );
};

/* ---------- Punto fisso: "se ci perdiamo ci vediamo qui" ---------- */

const FixedCard: React.FC<{ m: Meetup; myUid: string; onRoute?: (placeId: string) => void }> = ({ m, myUid, onRoute }) => (
  <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-3" data-testid="fixed-card">
    <div className="flex items-start gap-2.5">
      <Flag className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-cyan-300">Se ci perdiamo, ci vediamo qui</p>
        <p className="text-sm font-bold text-white leading-tight mt-0.5">{m.label}</p>
        {m.note && <p className="text-[11px] text-cyan-50/80 mt-1">{m.note}</p>}
      </div>
      {m.createdBy === myUid && (
        <button type="button" onClick={() => removeMeetup(m.id)} className="min-h-[40px] min-w-[40px] rounded-lg text-cyan-200/70 hover:text-rose-200 flex items-center justify-center" aria-label="Togli il punto fisso">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
    <div className="mt-2 flex gap-1.5">
      {m.placeId && onRoute ? (
        <button type="button" onClick={() => onRoute(m.placeId!)} className="flex-1 min-h-[40px] rounded-xl bg-slate-900/80 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5">
          <Navigation className="w-3.5 h-3.5" /> Portami lì
        </button>
      ) : (
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`} target="_blank" rel="noopener noreferrer" className="flex-1 min-h-[40px] rounded-xl bg-slate-900/80 text-slate-100 text-xs font-semibold flex items-center justify-center gap-1.5">
          <MapIcon className="w-3.5 h-3.5" /> Indicazioni
        </a>
      )}
    </div>
  </div>
);

/* ---------- Scheda "Il gruppo adesso" ---------- */

export const GroupLiveCard: React.FC<{ onRoute?: (placeId: string) => void; onShowMap?: () => void }> = ({ onRoute, onShowMap }) => {
  const { user, slot, homeAcc, bySlot } = useMe();
  const g = useGroupLive();
  const now = useTick();
  const [chooser, setChooser] = useState(false);
  const [sheet, setSheet] = useState<null | 'meetup' | 'fixed'>(null);
  const [lostConfirm, setLostConfirm] = useState(false);
  const [helpBusy, setHelpBusy] = useState<string | null>(null);
  const [helpError, setHelpError] = useState<string | null>(null);
  const today = seoulDateIso(nowOrSim());
  const slots = presentSlots(today);
  const byUidSlot = useMemo(() => Object.fromEntries(g.live.map((d) => [d.slot, d])) as Partial<Record<TravelerSlotId, LiveDoc>>, [g.live]);
  const myDoc = slot ? byUidSlot[slot] : undefined;
  const iAmHome = myDoc ? isHome(myDoc, now) : false;
  const meetups = upcomingMeetups(g.meetups, now).slice(0, 2);
  const fixed = fixedPoint(g.meetups, now);
  const iAmLost = myDoc ? isLost(myDoc, now) : false;
  const allowed = g.sharingAllowed;
  const myPos = g.myPos;

  const statusOf = (s: TravelerSlotId) => {
    const d = byUidSlot[s];
    if (!d) return { text: 'Nessuna notizia', tone: 'text-slate-500', share: null as null | { lat: number; lng: number }, lost: false };
    if (isLost(d, now)) {
      const sh = activeShare(d, now);
      const dist = sh && myPos && s !== slot ? ` · ${formatDistance(haversineMeters(myPos, [sh.lat, sh.lng]))} da te` : '';
      return { text: `Ha perso il gruppo · ${formatAgo(now - d.lost!)}${sh ? dist : ' · posizione non condivisa'}`, tone: 'text-rose-300 font-semibold', share: sh, lost: true };
    }
    if (isHome(d, now)) return { text: `A casa · ${seoulClock(d.statusAt!)}`, tone: 'text-emerald-300', share: null, lost: false };
    const sh = activeShare(d, now);
    if (sh) {
      const age = now - sh.at;
      const dist = myPos && s !== slot ? ` · ${formatDistance(haversineMeters(myPos, [sh.lat, sh.lng]))} da te` : '';
      return { text: `Posizione ${formatAgo(age)}${dist}`, tone: age > STALE_POSITION_MS ? 'text-slate-400' : 'text-cyan-300', share: sh, lost: false };
    }
    if (d.status === 'out' && d.statusAt && now - d.statusAt < 12 * 3_600_000) return { text: `Fuori · da ${seoulClock(d.statusAt)}`, tone: 'text-slate-300', share: null, lost: false };
    return { text: 'Nessuna notizia', tone: 'text-slate-500', share: null, lost: false };
  };

  const choose = (until: number) => {
    setChooser(false);
    startSharing(until);
  };

  // Il prossimo ritrovo a cui non ho detto di no: per condividere la posizione solo quando serve davvero
  const nextMeetup = slot
    ? upcomingMeetups(g.meetups, now).find((m) => m.answers[slot] !== 'no' && m.at + MEETUP_SHARE_AFTER_MS > now && m.at - now < 3 * 3_600_000)
    : undefined;
  const meetupUntil = nextMeetup ? Math.min(nextMeetup.at + MEETUP_SHARE_AFTER_MS, now + 12 * 3_600_000) : 0;
  const suggestShare = allowed && !!nextMeetup && !g.sharingUntil && !chooser && nextMeetup.at - now < 90 * 60_000;

  /** "Aspettalo qui": un ritrovo tra 10 minuti dove sono io adesso */
  const waitHere = async (uidSlot: TravelerSlotId) => {
    setHelpError(null);
    setHelpBusy(uidSlot);
    try {
      const [lat, lng] = await currentPosition();
      await addMeetup({ label: `Aspettiamo ${bySlot[uidSlot]?.name ?? 'chi manca'} qui`, placeId: null, lat, lng, at: Date.now() + 10 * 60_000, note: '', fixed: false });
    } catch (err) {
      setHelpError((err as Error).message || 'Non sono riuscito a fissare il punto.');
    } finally {
      setHelpBusy(null);
    }
  };

  if (!user || !slot) return null;
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5 space-y-3" data-testid="group-live">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white font-display flex items-center gap-2"><Users className="w-4 h-4 text-cyan-400" /> Il gruppo adesso</h3>
        {g.sharingUntil && (
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-cyan-500/20 text-cyan-200 flex items-center gap-1" data-testid="sharing-badge">
            <Radio className="w-3 h-3 animate-pulse" /> Condivisa fino {seoulClock(g.sharingUntil)}
          </span>
        )}
      </div>

      {g.error && <p className="text-[11px] text-amber-300 flex gap-1.5" role="alert"><CircleAlert className="w-3.5 h-3.5 shrink-0" />{g.error}</p>}

      <ul className="space-y-1.5">
        {slots.map((s) => {
          const st = statusOf(s);
          const t = bySlot[s];
          return (
            <li key={s} className={`flex items-center gap-2.5 min-h-[40px] ${st.lost ? 'rounded-xl border border-rose-500/50 bg-rose-500/10 px-2 py-1.5' : ''}`} data-testid={st.lost ? 'group-row-lost' : 'group-row'}>
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: t?.color ?? '#475569' }}>
                {(s === slot ? 'Tu' : t?.name ?? '?').slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{s === slot ? 'Tu' : t?.name ?? s}</p>
                <p className={`text-[11px] truncate ${st.tone}`}>{st.text}</p>
              </div>
              {st.lost && s !== slot && (
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => waitHere(s)} disabled={helpBusy === s} className="min-h-[36px] px-2.5 rounded-lg bg-rose-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 disabled:opacity-60" data-testid="wait-here">
                    {helpBusy === s ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />} Aspettalo qui
                  </button>
                  {st.share && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${st.share.lat},${st.share.lng}&travelmode=walking`} target="_blank" rel="noopener noreferrer" className="min-h-[32px] px-2.5 rounded-lg bg-slate-800 text-rose-100 text-[11px] font-semibold flex items-center gap-1" data-testid="go-to-lost">
                      <Navigation className="w-3.5 h-3.5" /> Vai da lui
                    </a>
                  )}
                </div>
              )}
              {!st.lost && st.share && s !== slot && onShowMap && (
                <button type="button" onClick={onShowMap} className="min-h-[36px] px-2.5 rounded-lg bg-slate-800 text-cyan-200 text-[11px] font-semibold flex items-center gap-1">
                  <MapIcon className="w-3.5 h-3.5" /> Mappa
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {helpError && <p className="text-[11px] text-amber-300" role="alert">{helpError}</p>}

      {g.nearHome && !iAmHome && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-100 flex items-center gap-2" data-testid="near-home">
          <Home className="w-4 h-4 shrink-0" /> Sei vicino a {homeAcc?.name ?? 'casa'}: sei arrivato?
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {iAmHome ? (
          <button type="button" onClick={() => markOut()} className="min-h-[48px] rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="mark-out">
            <Check className="w-4 h-4" /> A casa · esco
          </button>
        ) : (
          <button type="button" onClick={() => markHome()} className="min-h-[48px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold flex items-center justify-center gap-1.5" data-testid="mark-home">
            <Home className="w-4 h-4" /> Sono a casa
          </button>
        )}
        {g.sharingUntil ? (
          <button type="button" onClick={() => stopSharing()} className="min-h-[48px] rounded-2xl bg-slate-800 text-rose-200 text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="share-stop">
            <X className="w-4 h-4" /> Ferma posizione
          </button>
        ) : (
          <button type="button" onClick={() => setChooser((v) => !v)} disabled={!allowed} aria-expanded={chooser} className="min-h-[48px] rounded-2xl bg-slate-800 disabled:opacity-50 text-cyan-100 text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="share-open">
            <Radio className="w-4 h-4" /> {allowed ? 'Condividi posizione' : 'Posizione spenta'}
          </button>
        )}
      </div>

      {/* Ho perso il gruppo */}
      {iAmLost ? (
        <div className="rounded-2xl border border-rose-500/50 bg-rose-500/10 p-3 space-y-2" data-testid="lost-panel">
          <p className="text-sm font-bold text-rose-100 flex items-center gap-2"><LifeBuoy className="w-4 h-4" /> Il gruppo sa che li hai persi</p>
          <p className="text-[11px] text-rose-50/90 leading-snug">
            {g.sharingUntil ? 'Vedono la tua posizione precisa per 2 ore.' : 'La posizione è spenta: dì al gruppo dove sei, oppure raggiungi il punto fisso.'}
            {fixed ? '' : ' Nessun punto fisso è stato scelto per oggi.'}
          </p>
          {fixed && <FixedCard m={fixed} myUid={user.id} onRoute={onRoute} />}
          <button type="button" onClick={() => clearLost()} className="w-full min-h-[44px] rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold" data-testid="lost-clear">Li ho ritrovati</button>
        </div>
      ) : lostConfirm ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 space-y-2" data-testid="lost-confirm">
          <p className="text-xs text-rose-50 leading-snug">
            {allowed ? 'Avviso il gruppo e condivido la tua posizione precisa per 2 ore.' : 'Avviso il gruppo che li hai persi. La posizione resta spenta: nessuno la vedrà.'}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setLostConfirm(false)} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold">Annulla</button>
            <button type="button" onClick={() => { setLostConfirm(false); reportLost(); }} className="min-h-[44px] rounded-xl bg-rose-500 text-white text-sm font-bold" data-testid="lost-send">Avvisa il gruppo</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setLostConfirm(true)} className="w-full min-h-[48px] rounded-2xl border border-rose-500/50 bg-rose-500/10 text-rose-100 text-sm font-bold flex items-center justify-center gap-2" data-testid="lost-open">
          <LifeBuoy className="w-4 h-4" /> Ho perso il gruppo
        </button>
      )}

      {suggestShare && nextMeetup && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 flex items-center gap-2" data-testid="share-suggest">
          <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
          <p className="flex-1 text-[11px] text-amber-50 leading-snug">Ritrovo alle {seoulClock(nextMeetup.at)}: condividi la posizione solo fino alle {seoulClock(meetupUntil)}?</p>
          <button type="button" onClick={() => choose(meetupUntil)} className="min-h-[40px] px-3 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold" data-testid="share-for-meetup">Condividi</button>
        </div>
      )}

      {chooser && allowed && !g.sharingUntil && (
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-3" data-testid="share-chooser">
          <p className="text-xs text-slate-300">Per quanto? La vede solo il gruppo e si cancella quando la fermi. Si aggiorna solo con l’app aperta, e da fermo controllo solo ogni 3 minuti per non consumare batteria.</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {nextMeetup && (
              <button type="button" onClick={() => choose(meetupUntil)} className="col-span-2 min-h-[44px] rounded-xl bg-amber-400 text-slate-950 text-xs font-bold" data-testid="share-meetup">
                Solo per il ritrovo (fino alle {seoulClock(meetupUntil)})
              </button>
            )}
            <button type="button" onClick={() => choose(Date.now() + 3_600_000)} className="min-h-[44px] rounded-xl bg-slate-800 text-white text-xs font-semibold" data-testid="share-1h">1 ora</button>
            <button type="button" onClick={() => choose(Date.now() + 3 * 3_600_000)} className="min-h-[44px] rounded-xl bg-slate-800 text-white text-xs font-semibold">3 ore</button>
            <button type="button" onClick={() => choose(untilMorning(Date.now()))} className="col-span-2 min-h-[44px] rounded-xl bg-slate-800 text-white text-xs font-semibold">Fino a domattina</button>
          </div>
        </div>
      )}
      {g.sharingUntil && (
        <p className="text-[11px] text-slate-400 leading-snug" data-testid="share-mode" data-mode={g.paused ? 'paused' : g.batterySaver ? 'saver' : g.trackMode}>
          {shareModeText(g)}
        </p>
      )}
      {g.notice && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-100 flex items-start gap-2" role="status" data-testid="share-notice">
          <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{g.notice}</span>
          <button type="button" onClick={dismissNotice} className="min-h-[32px] min-w-[32px] flex items-center justify-center text-amber-200" aria-label="Chiudi l’avviso"><X className="w-4 h-4" /></button>
        </div>
      )}
      {g.gpsError && <p className="text-[11px] text-amber-300" role="alert">{g.gpsError}</p>}

      <div className="flex items-center gap-3 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-200">Posizione condivisibile</p>
          <p className="text-[11px] text-slate-500 leading-snug" data-testid="share-allowed-hint">
            {allowed ? 'Si attiva solo quando lo decidi tu.' : 'Spenta: nessuno vede dove sei, nemmeno se perdi il gruppo.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label="Posizione condivisibile"
          onClick={() => setSharingAllowed(!allowed)}
          className={`relative w-12 h-7 rounded-full shrink-0 transition-colors ${allowed ? 'bg-cyan-500' : 'bg-slate-700'}`}
          data-testid="share-allowed"
        >
          <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${allowed ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className="pt-1 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ritrovo</p>
        {fixed && !iAmLost && <FixedCard m={fixed} myUid={user.id} onRoute={onRoute} />}
        {meetups.map((m) => (
          <MeetupCard key={m.id} m={m} now={now} mySlot={slot} myUid={user.id} bySlot={bySlot} slots={slots} onRoute={onRoute} />
        ))}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setSheet('meetup')} className="min-h-[44px] rounded-2xl border border-dashed border-slate-700 hover:border-amber-400/60 text-slate-300 text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="meetup-new">
            <Plus className="w-4 h-4" /> Fissa un ritrovo
          </button>
          <button type="button" onClick={() => setSheet('fixed')} className="min-h-[44px] rounded-2xl border border-dashed border-slate-700 hover:border-cyan-400/60 text-slate-300 text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="fixed-new">
            <Flag className="w-4 h-4" /> {fixed ? 'Cambia punto fisso' : 'Punto fisso'}
          </button>
        </div>
      </div>
      {sheet && <MeetupSheet fixed={sheet === 'fixed'} onClose={() => setSheet(null)} />}
    </section>
  );
};
