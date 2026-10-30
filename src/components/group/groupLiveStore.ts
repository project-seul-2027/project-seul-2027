import { useEffect, useState } from 'react';
import type { TravelerSlotId } from '../../shared/travelerProfile';
import { haversineMeters } from '../../data/metroRouter';
import { LOST_TTL_MS, type LiveDoc, type Meetup, type MeetupAnswer, type MeetupInput, type SharedPosition } from '../../shared/groupLive';
import {
  answerMeetup, createMeetup, deleteMeetup, friendlyGroupError, watchLive, watchMeetups, writeMyLive, type MyLiveState
} from '../../services/groupLiveService';

/**
 * Stato condiviso del gruppo (un solo ascolto di Firestore per tutta l'app) e "motore" della mia posizione.
 *
 * La posizione si invia solo mentre l'app è aperta, solo dopo che l'ho attivata e solo fino all'orario scelto.
 * Per non scaricare la batteria il motore lavora a gradini:
 *  - in movimento: watchPosition a precisione normale (Wi-Fi/celle); il GPS pieno solo nell'ora del ritrovo;
 *  - fermo da 4 minuti: si spegne il watch e si controlla una volta ogni 3 minuti;
 *  - batteria ≤ 20% (dove il browser la espone): sempre controlli ogni 5 minuti; ≤ 5%: la condivisione si ferma;
 *  - schermo spento o app in secondo piano: tutto sospeso, si riparte appena si riapre l'app;
 *  - vicino a casa per 10 minuti: la condivisione si ferma da sola.
 */

export type TrackMode = 'off' | 'moving' | 'still';

export interface GroupLiveState {
  live: LiveDoc[];
  meetups: Meetup[];
  ready: boolean;
  error: string | null;
  /** Sto condividendo la posizione fino a… (ms), oppure null */
  sharingUntil: number | null;
  /** Errore del GPS (permesso negato, ecc.) */
  gpsError: string | null;
  /** Sono a meno di 150 m dal mio alloggio e non ho ancora detto "Sono a casa" */
  nearHome: boolean;
  /** Ultima mia posizione nota (anche se non condivisa) */
  myPos: [number, number] | null;
  /** Come sta lavorando il GPS adesso */
  trackMode: TrackMode;
  /** Batteria bassa: controlli radi */
  batterySaver: boolean;
  /** GPS preciso attivo (solo intorno all'ora di un ritrovo) */
  precise: boolean;
  /** App in secondo piano: condivisione in pausa */
  paused: boolean;
  /** Avviso da mostrare (es. condivisione fermata da sola) */
  notice: string | null;
  /** Interruttore: se spento la posizione non si condivide mai */
  sharingAllowed: boolean;
}

const SHARE_KEY = 'seul2027:share:until';
const OFF_KEY = 'seul2027:share:off';

function readAllowed(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== '1';
  } catch {
    return true;
  }
}
const MIN_MOVE_M = 40;
const MIN_SEND_GAP_MS = 30_000;
const HEARTBEAT_MS = 150_000;
const NEAR_HOME_M = 150;
const NEAR_HOME_STOP_MS = 10 * 60_000;
const STILL_RADIUS_M = 50;
const STILL_AFTER_MS = 4 * 60_000;
const POLL_STILL_MS = 3 * 60_000;
const POLL_SAVER_MS = 5 * 60_000;
const CHECK_EVERY_MS = 60_000;
const SAVER_LEVEL = 0.2;
const STOP_LEVEL = 0.05;
/** Il GPS preciso serve solo per ritrovarsi: da mezz'ora prima a tre quarti d'ora dopo l'ora del ritrovo */
const PRECISE_BEFORE_MS = 30 * 60_000;
const PRECISE_AFTER_MS = 45 * 60_000;

let state: GroupLiveState = {
  live: [],
  meetups: [],
  ready: false,
  error: null,
  sharingUntil: null,
  gpsError: null,
  nearHome: false,
  myPos: null,
  trackMode: 'off',
  batterySaver: false,
  precise: false,
  paused: false,
  notice: null,
  sharingAllowed: readAllowed()
};
const listeners = new Set<(s: GroupLiveState) => void>();
let started = false;

function set(patch: Partial<GroupLiveState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

function start() {
  if (started) return;
  started = true;
  try {
    watchLive(
      (live) => {
        set({ live, ready: true, error: null });
        syncMineFromServer();
      },
      (error) => set({ error, ready: true })
    );
    watchMeetups(
      (meetups) => set({ meetups }),
      (error) => set({ error })
    );
  } catch (err) {
    set({ error: friendlyGroupError(err), ready: true });
  }
}

export function useGroupLive(): GroupLiveState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    start();
    setS(state);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

export function dismissNotice() {
  set({ notice: null });
}

/* ---------- Io ---------- */

interface Me {
  uid: string;
  slot: TravelerSlotId;
  homeName: string;
  home: [number, number] | null;
}
let me: Me | null = null;
let mine: MyLiveState = { status: null, statusAt: null, place: '', share: null, lost: null };
let mineLoaded = false;
let watchId: number | null = null;
let watchPrecise = false;
let lastSent: { lat: number; lng: number; at: number } | null = null;
let stopTimer: number | null = null;
let pollTimer: number | null = null;
let checkTimer: number | null = null;
/** Punto in cui sono fermo e da quando */
let anchor: { p: [number, number]; since: number } | null = null;
let nearHomeSince: number | null = null;
let lifecycleBound = false;

function syncMineFromServer() {
  if (!me || mineLoaded) return;
  const d = state.live.find((x) => x.uid === me!.uid);
  mineLoaded = true;
  if (d) mine = { status: d.status, statusAt: d.statusAt, place: d.place, share: d.share, lost: d.lost };
}

async function push() {
  if (!me) return;
  try {
    await writeMyLive(me.uid, me.slot, mine);
  } catch (err) {
    set({ error: friendlyGroupError(err) });
  }
}

export function configureMe(next: Me | null) {
  me = next;
  mineLoaded = false;
  syncMineFromServer();
}

/* --- Batteria (solo dove il browser la espone, es. Chrome su Android) --- */

interface BatteryLike extends EventTarget {
  level: number;
  charging: boolean;
}

function initBattery() {
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
  if (typeof nav.getBattery !== 'function') return;
  nav
    .getBattery()
    .then((b) => {
      const apply = () => {
        const low = !b.charging && b.level <= SAVER_LEVEL;
        if (low !== state.batterySaver) set({ batterySaver: low });
        if (!b.charging && b.level <= STOP_LEVEL && state.sharingUntil) {
          stopSharing();
          set({ notice: 'Batteria quasi scarica: ho fermato la condivisione della posizione. Puoi riattivarla quando ricarichi.' });
          return;
        }
        if (state.sharingUntil && state.trackMode !== 'off') applyMode(low || stillLongEnough(Date.now()));
      };
      apply();
      b.addEventListener('levelchange', apply);
      b.addEventListener('chargingchange', apply);
    })
    .catch(() => {
      /* nessuna informazione sulla batteria: si va avanti */
    });
}

/* --- Precisione: GPS pieno solo intorno a un ritrovo --- */

function needsPrecision(now = Date.now()): boolean {
  if (!me) return false;
  // Se ho perso il gruppo mi serve il GPS preciso, anche con la batteria bassa
  if (mine.lost && now - mine.lost < LOST_TTL_MS) return true;
  if (state.batterySaver) return false;
  return state.meetups.some((m) => !m.fixed && m.answers[me!.slot] !== 'no' && now > m.at - PRECISE_BEFORE_MS && now < m.at + PRECISE_AFTER_MS);
}

/* --- Watch e controlli periodici --- */

function clearPoll() {
  if (pollTimer !== null) window.clearTimeout(pollTimer);
  pollTimer = null;
}

function haltWatch() {
  if (watchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

/** Ferma tutto ciò che consuma (watch, controlli), senza toccare l'orario di fine condivisione */
function haltTracking() {
  haltWatch();
  clearPoll();
}

function stopWatch() {
  haltTracking();
  if (stopTimer !== null) window.clearTimeout(stopTimer);
  stopTimer = null;
  if (checkTimer !== null) window.clearInterval(checkTimer);
  checkTimer = null;
  anchor = null;
  nearHomeSince = null;
  set({ trackMode: 'off', precise: false, paused: false });
}

function stillLongEnough(now: number): boolean {
  return !!anchor && now - anchor.since >= STILL_AFTER_MS;
}

function schedulePoll() {
  clearPoll();
  pollTimer = window.setTimeout(pollOnce, state.batterySaver ? POLL_SAVER_MS : POLL_STILL_MS);
}

function pollOnce() {
  pollTimer = null;
  if (!state.sharingUntil || state.paused || typeof navigator === 'undefined' || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => {
      onPosition(p);
      if (state.trackMode === 'still' && pollTimer === null) schedulePoll();
    },
    (e) => {
      onGpsError(e);
      schedulePoll();
    },
    { enableHighAccuracy: false, maximumAge: 0, timeout: 20_000 }
  );
}

function startWatch() {
  if (watchId !== null) return;
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    set({ gpsError: 'Questo browser non dà la posizione.' });
    return;
  }
  watchPrecise = needsPrecision();
  watchId = navigator.geolocation.watchPosition(onPosition, onGpsError, {
    enableHighAccuracy: watchPrecise,
    maximumAge: watchPrecise ? 5_000 : 30_000,
    timeout: 30_000
  });
  set({ trackMode: 'moving', precise: watchPrecise });
}

/** Passa da "in movimento" (watch) a "fermo" (un controllo ogni tanto) e viceversa */
function applyMode(wantStill: boolean) {
  if (!state.sharingUntil || state.paused) return;
  const saver = state.batterySaver;
  if (wantStill || saver) {
    if (state.trackMode !== 'still') {
      haltWatch();
      set({ trackMode: 'still', precise: false });
      schedulePoll();
    }
  } else if (state.trackMode === 'still') {
    clearPoll();
    startWatch();
  } else if (state.trackMode === 'moving' && needsPrecision() !== watchPrecise) {
    // Entra o esce l'ora di un ritrovo: cambia la precisione richiesta
    haltWatch();
    startWatch();
  }
}

function onPosition(pos: GeolocationPosition) {
  const now = Date.now();
  const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
  const acc = pos.coords.accuracy ?? 0;

  // Fermo o in movimento? Il rumore del GPS (acc) non conta come spostamento
  if (!anchor || haversineMeters(anchor.p, p) > Math.max(STILL_RADIUS_M, Math.min(acc, 150))) anchor = { p, since: now };

  const near = !!me?.home && haversineMeters(p, me.home) < NEAR_HOME_M;
  const alreadyHome = mine.status === 'home' && !!mine.statusAt && now - mine.statusAt < 12 * 3_600_000;
  nearHomeSince = near ? (nearHomeSince ?? now) : null;
  set({ myPos: p, gpsError: null, nearHome: near && !alreadyHome });

  const until = state.sharingUntil;
  if (!until || until <= now) return;

  // Arrivato e rimasto a casa: inutile continuare a seguirlo
  if (near && !alreadyHome && nearHomeSince !== null && now - nearHomeSince >= NEAR_HOME_STOP_MS) {
    stopSharing();
    set({ notice: 'Sei rimasto vicino a casa: ho fermato la condivisione della posizione. Tocca "Sono a casa" per avvisare il gruppo.', nearHome: true });
    return;
  }

  // Mando la posizione solo se serve: spostamento vero, oppure un segnale di vita ogni tanto
  if (navigator.onLine !== false) {
    const sinceSent = lastSent ? now - lastSent.at : Infinity;
    const moved = lastSent ? haversineMeters([lastSent.lat, lastSent.lng], p) : Infinity;
    const due = !lastSent || (moved >= MIN_MOVE_M && sinceSent >= MIN_SEND_GAP_MS) || sinceSent >= HEARTBEAT_MS;
    if (due) {
      lastSent = { lat: p[0], lng: p[1], at: now };
      const share: SharedPosition = { lat: p[0], lng: p[1], acc, at: now, until };
      mine = { ...mine, share, status: 'out', statusAt: mine.status === 'out' ? mine.statusAt : now, place: '' };
      push();
    }
  }

  applyMode(stillLongEnough(now));
}

function onGpsError(err: GeolocationPositionError) {
  const msg =
    err.code === err.PERMISSION_DENIED
      ? 'Il telefono non dà il permesso per la posizione: attivalo nelle impostazioni del browser.'
      : 'Posizione non disponibile in questo momento.';
  set({ gpsError: msg });
}

/** Controllo ogni minuto: se sono fermo da un po' passo ai controlli radi anche se il watch tace */
function periodicCheck() {
  const now = Date.now();
  if (state.sharingUntil && state.sharingUntil <= now) return stopSharing();
  if (state.paused || !state.sharingUntil) return;
  applyMode(stillLongEnough(now));
}

/* --- Schermo spento / app in secondo piano --- */

function onVisibility() {
  if (!state.sharingUntil) return;
  if (document.hidden) {
    haltTracking();
    set({ paused: true });
    return;
  }
  if (state.sharingUntil <= Date.now()) return stopSharing();
  set({ paused: false });
  // Riparto con un controllo subito: se sono fermo, applyMode torna ai controlli radi
  haltTracking();
  startWatch();
}

function bindLifecycle() {
  if (lifecycleBound || typeof document === 'undefined') return;
  lifecycleBound = true;
  document.addEventListener('visibilitychange', onVisibility);
  initBattery();
}

/** Avvia (o prolunga) la condivisione fino a `until` */
export function startSharing(until: number) {
  if (!state.sharingAllowed) return;
  try {
    localStorage.setItem(SHARE_KEY, String(until));
  } catch {
    /* non essenziale */
  }
  bindLifecycle();
  haltTracking();
  lastSent = null;
  anchor = null;
  nearHomeSince = null;
  set({ sharingUntil: until, gpsError: null, notice: null, paused: typeof document !== 'undefined' && document.hidden });
  if (!state.paused) startWatch();
  if (stopTimer !== null) window.clearTimeout(stopTimer);
  stopTimer = window.setTimeout(() => stopSharing(), Math.min(until - Date.now(), 2 ** 31 - 1));
  if (checkTimer !== null) window.clearInterval(checkTimer);
  checkTimer = window.setInterval(periodicCheck, CHECK_EVERY_MS);
}

/** Ferma la condivisione e cancella la posizione dal gruppo */
export function stopSharing() {
  try {
    localStorage.removeItem(SHARE_KEY);
  } catch {
    /* non essenziale */
  }
  set({ sharingUntil: null });
  stopWatch();
  lastSent = null;
  if (mine.share) {
    mine = { ...mine, share: null };
    push();
  }
}

/** Riprende la condivisione dopo una ricarica della pagina, se non è scaduta */
export function resumeSharing() {
  if (!state.sharingAllowed) return;
  try {
    const v = Number(localStorage.getItem(SHARE_KEY));
    if (v && v > Date.now()) startSharing(v);
    else if (v) stopSharing();
  } catch {
    /* non essenziale */
  }
}

/** "Sono a casa": ferma anche la condivisione della posizione */
export function markHome() {
  if (!me) return;
  if (state.sharingUntil) {
    try {
      localStorage.removeItem(SHARE_KEY);
    } catch {
      /* non essenziale */
    }
    set({ sharingUntil: null });
    stopWatch();
  }
  mine = { status: 'home', statusAt: Date.now(), place: me.homeName, share: null, lost: null };
  set({ nearHome: false, notice: null });
  push();
}

export function markOut() {
  if (!me) return;
  mine = { ...mine, status: 'out', statusAt: Date.now(), place: '' };
  push();
}

/** Interruttore della privacy: spento = nessuna posizione condivisa, mai */
export function setSharingAllowed(allowed: boolean) {
  try {
    if (allowed) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, '1');
  } catch {
    /* non essenziale */
  }
  set({ sharingAllowed: allowed, notice: null });
  if (!allowed && state.sharingUntil) stopSharing();
}

/** "Ho perso il gruppo": avviso il gruppo e, se consentito, condivido la posizione precisa per 2 ore */
export function reportLost() {
  if (!me) return;
  const now = Date.now();
  mine = { ...mine, lost: now, status: 'out', statusAt: mine.status === 'out' && mine.statusAt ? mine.statusAt : now, place: '' };
  push();
  if (state.sharingAllowed) {
    const until = now + LOST_TTL_MS;
    if (!state.sharingUntil || state.sharingUntil < until) startSharing(until);
  }
}

/** "Li ho ritrovati" */
export function clearLost() {
  if (!me || !mine.lost) return;
  mine = { ...mine, lost: null };
  push();
}

/** Chiede una posizione una volta (per "ritrovo qui") */
export function currentPosition(): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Questo browser non dà la posizione.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      () => reject(new Error('Posizione non disponibile: scegli un luogo dall’elenco.')),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 }
    );
  });
}

/* ---------- Ritrovi ---------- */

export async function addMeetup(input: MeetupInput): Promise<void> {
  if (!me) throw new Error('Profilo non pronto');
  await createMeetup(me.uid, me.slot, input);
}

export async function answer(id: string, a: MeetupAnswer): Promise<void> {
  if (!me) return;
  try {
    await answerMeetup(id, me.slot, a);
  } catch (err) {
    set({ error: friendlyGroupError(err) });
  }
}

export async function removeMeetup(id: string): Promise<void> {
  try {
    await deleteMeetup(id);
  } catch (err) {
    set({ error: friendlyGroupError(err) });
  }
}
