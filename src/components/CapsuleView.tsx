import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronDown, ChevronRight, Clock, Image as ImageIcon, Loader2, Lock, MessageCircle, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { requestOpenPage } from '../pageAddress';
import { isSlot } from '../types/expenses';
import { compressImage } from '../services/galleryService';
import { CameraCaptureModal } from './CameraCaptureModal';
import { addCapsuleComment, CAPSULE_COMMENT_MAX, CAPSULE_TEXT_MAX, friendlyCapsuleError, loadCapsuleImage, removeCapsule, removeCapsuleComment, saveCapsule, watchCapsule, watchCapsuleComments, type CapsuleComment, type CapsuleEntry } from '../services/capsuleService';
import { CapsulePhotoViewer } from './CapsulePhotoViewer';
import { MILESTONES, WINDOW_MS, activeClosesAt, defaultMilestone, fireAt, stateOf, type CapsuleState, type Milestone } from '../utils/capsule';

const HEADING: React.CSSProperties = { fontFamily: 'Outfit, system-ui, sans-serif' };
const MIN = 60_000;
const HOUR = 60 * MIN;

const romeDay = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ms));
const romeClock = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

const pad = (n: number) => String(n).padStart(2, '0');
/** "3 g 04 h", "5 h 12 min", "42 min" */
function countdown(ms: number): { big: string; unit: string; sub: string } {
  const total = Math.max(0, Math.floor(ms / MIN));
  const d = Math.floor(total / (24 * 60));
  const h = Math.floor((total % (24 * 60)) / 60);
  const m = total % 60;
  // Sotto i due giorni si contano le ore intere: "47 ore" è più chiaro di "1 giorno"
  if (d >= 2) return { big: `${d}`, unit: 'giorni', sub: `${pad(h)} h ${pad(m)} min` };
  if (total >= 60) return { big: `${Math.floor(total / 60)}`, unit: 'ore', sub: `${pad(m)} min` };
  return { big: `${m}`, unit: 'minuti', sub: '' };
}

/** Quanto è passato da un'apertura, in italiano: "7 min dopo", "3 h dopo" */
function afterOpen(ms: number): string {
  const min = Math.round(ms / MIN);
  if (min < 1) return 'appena aperta';
  if (min < 60) return `${min} min dopo`;
  return `${Math.round(min / 60)} h dopo`;
}

const label = (m: Milestone) => (m === 1 ? 'Ultimo giorno' : `${m} giorni`);
const stateWord: Record<CapsuleState, string> = { upcoming: 'non ancora aperto', open: 'aperto', closed: 'chiuso' };

const initials = (name: string) => name.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';

const Avatar: React.FC<{ src?: string; name: string; size?: number; state?: 'done' | 'pending' | 'skipped' | 'plain' }> = ({ src, name, size = 36, state = 'plain' }) => {
  const ring = state === 'done' ? 'ring-2 ring-[#52d9e6]' : state === 'skipped' ? 'ring-1 ring-slate-500' : 'ring-1 ring-white/10';
  const dim = state === 'pending' ? 'opacity-40 grayscale' : '';
  return src ? (
    <img src={src} alt="" referrerPolicy="no-referrer" width={size} height={size} className={`shrink-0 rounded-full object-cover ${ring} ${dim}`} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#152231] text-[11px] font-semibold text-slate-200 ${ring} ${dim}`}
      style={{ width: size, height: size }}
    >
      {initials(name)}
    </span>
  );
};

/** Il gruppo, in fila: chi ha risposto è acceso, chi manca è spento. Nessun nome, solo facce. */
const GroupStrip: React.FC<{ members: { id: string; name: string; avatar?: string }[]; answered: Map<string, 'done' | 'skipped'> }> = ({ members, answered }) => (
  <ul className="flex items-center" aria-label="Chi ha risposto">
    {members.map((m, i) => {
      const st = answered.get(m.id);
      return (
        <li key={m.id} className={i === 0 ? '' : '-ml-2'} title={st === 'done' ? `${m.name} ha risposto` : st === 'skipped' ? `${m.name} ha saltato` : `${m.name} non ha ancora risposto`}>
          <Avatar src={m.avatar} name={m.name} size={34} state={st ?? 'pending'} />
        </li>
      );
    })}
  </ul>
);

/** La linea dei traguardi: sei punti, quello aperto pulsa, quello con la tua risposta ha un segno. */
const Timeline: React.FC<{ now: number; selected: Milestone; answeredByMe: Set<number>; onPick: (m: Milestone) => void }> = ({ now, selected, answeredByMe, onPick }) => (
  <nav aria-label="Traguardi" className="px-1">
    <ol className="relative flex items-start justify-between">
      <span aria-hidden="true" className="absolute left-3 right-3 top-[15px] h-px bg-white/10" />
      {MILESTONES.map((m) => {
        const s = stateOf(m, now);
        const picked = m === selected;
        const mine = answeredByMe.has(m);
        return (
          <li key={m} className="relative z-10 flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPick(m)}
              aria-current={picked ? 'step' : undefined}
              aria-label={`${label(m)}, ${stateWord[s]}${mine ? ', hai risposto' : ''}`}
              className="flex min-h-11 min-w-11 items-center justify-center"
            >
              <span
                className={`relative flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 transition-colors ${
                  picked ? 'border-[#52d9e6] bg-[#52d9e6]' : s === 'closed' ? 'border-slate-500 bg-slate-500' : s === 'open' ? 'border-[#52d9e6] bg-[#0a1119]' : 'border-white/25 bg-[#0a1119]'
                }`}
              >
                {s === 'open' && <span aria-hidden="true" className="absolute inset-[-6px] animate-ping rounded-full border border-[#52d9e6]/60 motion-reduce:hidden" />}
                {mine && <Check className={`h-3 w-3 ${picked ? 'text-[#04242a]' : 'text-[#52d9e6]'}`} aria-hidden="true" strokeWidth={3} />}
              </span>
            </button>
            <span className={`text-[11px] font-semibold tabular-nums ${picked ? 'text-[#52d9e6]' : 'text-slate-400'}`}>{m === 1 ? '1 g' : `${m} g`}</span>
          </li>
        );
      })}
    </ol>
  </nav>
);

/** Anello che si svuota mentre la finestra di 48 ore si chiude */
const Ring: React.FC<{ fraction: number; children: React.ReactNode }> = ({ fraction, children }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative flex h-[136px] w-[136px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#52d9e6" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, fraction)))} className="motion-ring" style={{ ['--ring' as string]: c }} />
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
};

/** Cancella la propria risposta a un traguardo, dopo una conferma: si può riscrivere finché il traguardo è aperto */
const MyAnswer: React.FC<{ milestone: Milestone; uid: string; hint: string; onError: (m: string | null) => void }> = ({ milestone, uid, hint, onError }) => {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancel = async () => {
    setBusy(true);
    onError(null);
    try {
      await removeCapsule(milestone, uid);
    } catch (e) {
      onError(friendlyCapsuleError(e));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#0a1119] px-4 py-3 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between" data-testid="capsule-mine">
      <span>{hint}</span>
      {confirm ? (
        <span className="flex gap-2">
          <button type="button" onClick={cancel} disabled={busy} className="min-h-11 rounded-xl bg-rose-200 px-4 text-sm font-semibold text-[#2a0a0a] disabled:opacity-50">Sì, cancella</button>
          <button type="button" onClick={() => setConfirm(false)} className="min-h-11 rounded-xl px-4 text-sm text-slate-300">No</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold text-rose-200">Cancella la mia risposta</button>
      )}
    </div>
  );
};

export const CapsuleView: React.FC<{ onOpenRecap?: () => void }> = ({ onOpenRecap }) => {
  const { user, group } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [entries, setEntries] = useState<CapsuleEntry[]>([]);
  const [comments, setComments] = useState<CapsuleComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Milestone>(() => defaultMilestone(Date.now()));

  useEffect(() => watchCapsule(setEntries, setError), []);
  useEffect(() => watchCapsuleComments(setComments, setError), []);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const members = useMemo(() => {
    const list = group.map((g) => ({ id: g.id, name: g.displayName || g.firstName || 'Partecipante', avatar: g.avatarUrl || undefined }));
    return list.length ? list : [{ id: 'me', name: user?.displayName || 'Tu', avatar: user?.avatarUrl || undefined }];
  }, [group, user]);

  const state = stateOf(selected, now);
  const ofSelected = entries.filter((e) => e.milestone === selected);
  const mine = ofSelected.find((e) => e.uid === user?.id) ?? null;
  const answers = ofSelected.filter((e) => !e.skipped);
  const answeredByMe = new Set(MILESTONES.filter((m) => entries.some((e) => e.milestone === m && e.uid === user?.id && !e.skipped)));
  const answerState = new Map<string, 'done' | 'skipped'>(ofSelected.map((e) => [e.uid, e.skipped ? 'skipped' : 'done']));
  const revealed = state === 'closed' || (!!mine && !mine.skipped);
  const who = (uid: string) => members.find((m) => m.id === uid);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-10 lg:max-w-none" data-testid="capsule">
      <h1 className="sr-only" style={HEADING}>Capsula del tempo</h1>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => (onOpenRecap ? onOpenRecap() : requestOpenPage('recap'))}
          data-keep-style
          className="min-h-11 px-3.5 rounded-xl bg-[#101c29] hover:bg-[#152231] text-xs font-semibold text-[#52d9e6] inline-flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]"
        >
          Rileggi tutta la capsula
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <Timeline now={now} selected={selected} answeredByMe={answeredByMe} onPick={setSelected} />

      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}

      {mine && !mine.skipped && (state === 'upcoming' || state === 'open') && user && (
        <MyAnswer
          milestone={selected}
          uid={user.id}
          onError={setError}
          hint={state === 'upcoming' ? 'Hai una risposta salvata prima dell’apertura: non doveva essere possibile. Cancellala e riscrivila quando si apre.' : 'È la tua risposta: puoi cancellarla finché il traguardo è aperto.'}
        />
      )}

      {state === 'upcoming' && <UpcomingStage milestone={selected} now={now} members={members} answerState={answerState} />}

      {state === 'open' && !mine && (
        <Composer key={selected} milestone={selected} now={now} uid={user?.id ?? ''} travelerId={user?.travelerId} onError={setError} />
      )}

      {state === 'open' && mine?.skipped && (
        <section className="space-y-4 rounded-xl bg-[rgba(96,150,214,0.13)] px-5 py-6 text-center" data-testid="capsule-skipped">
          <p className="text-base font-semibold text-white" style={HEADING}>Oggi passi.</p>
          <p className="text-sm text-slate-300">Puoi ancora rispondere fino a {romeDay(activeClosesAt(selected, now))} alle {romeClock(activeClosesAt(selected, now))}.</p>
          <button
            type="button"
            onClick={() => user && removeCapsule(selected, user.id).catch((e) => setError(friendlyCapsuleError(e)))}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#52d9e6] px-5 text-sm font-semibold text-[#04242a]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Rispondi adesso
          </button>
        </section>
      )}

      {revealed && (
        <Feed milestone={selected} now={now} state={state} answers={answers} comments={comments} currentUserId={user?.id ?? ''} who={who} members={members} answerState={answerState} mine={mine} />
      )}

      {state !== 'upcoming' && !revealed && (
        <section className="space-y-3 rounded-xl bg-[rgba(96,150,214,0.13)] px-4 py-5" data-testid="capsule-locked">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Lock className="h-4 w-4 text-[#52d9e6]" aria-hidden="true" /> Le risposte sono chiuse per ora
          </div>
          <p className="text-sm text-slate-300">
            {answers.length === 0 ? 'Nessuno ha ancora risposto.' : `${answers.length} ${answers.length === 1 ? 'risposta è' : 'risposte sono'} già arrivate.`} Rispondi tu e le vedi subito.
          </p>
          <GroupStrip members={members} answered={answerState} />
        </section>
      )}
    </div>
  );
};

/** Prima del traguardo: il conto alla rovescia è il protagonista, poi il gruppo in fila */
const UpcomingStage: React.FC<{ milestone: Milestone; now: number; members: { id: string; name: string; avatar?: string }[]; answerState: Map<string, 'done' | 'skipped'> }> = ({ milestone, now, members, answerState }) => {
  const left = countdown(fireAt(milestone) - now);
  return (
    <section className="overflow-hidden rounded-xl bg-[rgba(96,150,214,0.13)] px-5 py-6" data-testid={`capsule-${milestone}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#52d9e6]">{label(milestone)} alla partenza</p>
      <div className="mt-4 flex items-center gap-5">
        <Ring fraction={1 - (fireAt(milestone) - now) / (30 * 24 * HOUR)}>
          <p className="text-[44px] font-semibold leading-none tabular-nums text-white" style={HEADING}>{left.big}</p>
          <p className="text-[12px] font-medium text-slate-200">{left.unit}</p>
          {left.sub && <p className="mt-0.5 text-[11px] tabular-nums text-slate-400">{left.sub}</p>}
        </Ring>
        <div className="min-w-0 space-y-2">
          <p className="text-base font-semibold text-white" style={HEADING}>Si apre {romeDay(fireAt(milestone))}</p>
          <p className="text-sm text-slate-300">Alle {romeClock(fireAt(milestone))} ti arriva una notifica: cosa stai facendo adesso?</p>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-4">
        <GroupStrip members={members} answered={answerState} />
        <p className="text-right text-xs text-slate-400">Apertura, poi 48 ore per rispondere</p>
      </div>
    </section>
  );
};

/** La riga scritta si conserva sul telefono: se Android chiude l'app mentre si usa la fotocamera di sistema, non si perde */
const draftKey = (m: Milestone) => `seul2027:capsule:draft:${m}`;
const readDraft = (m: Milestone): string => {
  try {
    return localStorage.getItem(draftKey(m)) ?? '';
  } catch {
    return '';
  }
};
const writeDraft = (m: Milestone, text: string): void => {
  try {
    if (text) localStorage.setItem(draftKey(m), text);
    else localStorage.removeItem(draftKey(m));
  } catch {
    /* archiviazione bloccata: nessuna bozza */
  }
};

/** Risposta: come uno scatto di BeReal, con il tempo che resta in cima */
const Composer: React.FC<{ milestone: Milestone; now: number; uid: string; travelerId: unknown; onError: (m: string | null) => void }> = ({ milestone, now, uid, travelerId, onError }) => {
  const [text, setText] = useState(() => readDraft(milestone));
  const [thumb, setThumb] = useState('');
  /** La stessa foto a qualità piena: si salva a parte e si mostra a schermo intero */
  const [full, setFull] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const libraryRef = useRef<HTMLInputElement>(null);
  const systemCameraRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const slot = isSlot(travelerId) ? travelerId : null;
  const ready = !!uid && !!slot && !busy && !preparing && (text.trim().length > 0 || thumb !== '');
  const left = activeClosesAt(milestone, now) - now;
  const fraction = left / WINDOW_MS;
  const cd = countdown(left);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    onError(null);
    setPreparing(true);
    try {
      const image = await compressImage(file);
      setThumb(image.thumb);
      setFull(image.full);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Non riesco a leggere questa foto.');
    } finally {
      setPreparing(false);
    }
  };

  const publish = async (input: { text: string; thumb?: string; full?: string } | { skipped: true }) => {
    if (!uid || !slot) {
      onError('Il tuo profilo non ha ancora un posto nel gruppo.');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await saveCapsule(uid, slot, milestone, input);
      writeDraft(milestone, '');
    } catch (e) {
      onError(friendlyCapsuleError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl bg-[rgba(96,150,214,0.13)] p-4" data-testid="capsule-composer">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#52d9e6]">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#52d9e6]" /> Aperta adesso
        </p>
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-300">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> chiude tra {cd.big} {cd.unit}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <Ring fraction={fraction}>
          <Camera className="mx-auto h-7 w-7 text-[#52d9e6]" aria-hidden="true" />
        </Ring>
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-snug text-white" style={HEADING}>Cosa stai facendo adesso?</p>
          <p className="mt-1 text-xs text-slate-400">Una foto al volo, una riga, o tutte e due.</p>
        </div>
      </div>

      {thumb ? (
        <div className="relative overflow-hidden rounded-xl">
          <img src={full || thumb} alt="Anteprima della tua foto" className="aspect-[4/5] w-full object-cover sm:aspect-[4/3]" />
          <button type="button" onClick={() => { setThumb(''); setFull(''); }} aria-label="Togli la foto" className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#04242a]/80 text-white">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-4 rounded-xl bg-[#0a1119] px-6 sm:aspect-[4/3]">
          {preparing ? <Loader2 className="h-8 w-8 animate-spin text-[#52d9e6]" aria-hidden="true" /> : <Camera className="h-8 w-8 text-[#52d9e6]" aria-hidden="true" />}
          <p className="text-sm font-semibold text-white">{preparing ? 'Preparo la foto…' : 'Aggiungi una foto'}</p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <button type="button" onClick={() => setCameraOpen(true)} disabled={preparing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#52d9e6] px-4 text-sm font-semibold text-[#04242a] disabled:opacity-50">
              <Camera className="h-4 w-4" aria-hidden="true" /> Scatta
            </button>
            <button type="button" onClick={() => libraryRef.current?.click()} disabled={preparing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[rgba(96,150,214,0.13)] px-4 text-sm font-semibold text-[#eaf0f6] disabled:opacity-50">
              <ImageIcon className="h-4 w-4" aria-hidden="true" /> Dalla galleria
            </button>
          </div>
        </div>
      )}
      {/* Dalla galleria: nessun "capture", così si apre la scelta delle foto già salvate */}
      <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {/* Fotocamera di sistema: solo se quella dell'app non parte */}
      <input ref={systemCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
      {cameraOpen && (
        <CameraCaptureModal
          onCapture={(file) => {
            setCameraOpen(false);
            void pick(file);
          }}
          onClose={() => setCameraOpen(false)}
          onPickLibrary={() => {
            setCameraOpen(false);
            libraryRef.current?.click();
          }}
          onUseSystemCamera={() => {
            setCameraOpen(false);
            systemCameraRef.current?.click();
          }}
        />
      )}

      <label className="block">
        <span className="sr-only">Una riga su cosa stai facendo</span>
        <textarea
          value={text}
          onChange={(e) => {
            const next = e.target.value.slice(0, CAPSULE_TEXT_MAX);
            setText(next);
            writeDraft(milestone, next);
          }}
          rows={2}
          placeholder="Scrivi una riga…"
          className="w-full resize-none rounded-xl bg-[#0a1119] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus-visible:shadow-[inset_0_0_0_1.5px_#52d9e6]"
        />
        <span className="mt-1 block text-right text-[11px] tabular-nums text-slate-500">{text.length}/{CAPSULE_TEXT_MAX}</span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => publish({ text, thumb: thumb || undefined, full: full || undefined })}
          disabled={!ready}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#52d9e6] px-4 text-sm font-semibold text-[#04242a] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          {busy ? 'Pubblico…' : 'Pubblica'}
        </button>
        <button type="button" onClick={() => publish({ skipped: true })} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm text-slate-300 disabled:opacity-40">
          Salta questa volta
        </button>
      </div>
    </section>
  );
};

/** Foto di una risposta nel feed: parte dalla miniatura, passa da sola alla foto nitida quando entra nello schermo, e si apre a schermo intero */
const FeedPhoto: React.FC<{ entry: CapsuleEntry; name: string; onOpen: () => void }> = ({ entry, name, onOpen }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [full, setFull] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let alive = true;
    const observer = new IntersectionObserver(
      ([hit]) => {
        if (!hit?.isIntersecting) return;
        observer.disconnect();
        loadCapsuleImage(entry.id)
          .then((image) => alive && image && setFull(image))
          .catch(() => undefined);
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [entry.id]);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label={`Apri la foto di ${name} a schermo intero`}
      className="block w-full cursor-zoom-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#52d9e6]"
    >
      <img src={full || entry.thumb} alt={`Foto di ${name}`} className="aspect-[4/5] w-full object-cover sm:aspect-[4/3]" loading="lazy" />
    </button>
  );
};

/** Dopo la risposta (o a traguardo chiuso): le risposte in un feed, dalla più veloce */
const Feed: React.FC<{
  milestone: Milestone;
  now: number;
  state: CapsuleState;
  answers: CapsuleEntry[];
  comments: CapsuleComment[];
  currentUserId: string;
  who: (uid: string) => { id: string; name: string; avatar?: string } | undefined;
  members: { id: string; name: string; avatar?: string }[];
  answerState: Map<string, 'done' | 'skipped'>;
  mine: CapsuleEntry | null;
}> = ({ milestone, now, state, answers, comments, currentUserId, who, members, answerState, mine }) => {
  const [viewing, setViewing] = useState<CapsuleEntry | null>(null);
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const sorted = [...answers].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  const waiting = members.filter((m) => !answerState.has(m.id));
  const open = state === 'open';
  return (
    <section className="space-y-4" data-testid="capsule-entries">
      {viewing && <CapsulePhotoViewer id={viewing.id} thumb={viewing.thumb} alt={`Foto di ${who(viewing.uid)?.name ?? 'un partecipante'}`} onClose={() => setViewing(null)} />}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#52d9e6]">{open ? 'Risposte del gruppo' : 'Traguardo chiuso'}</p>
          <p className="mt-1 text-lg font-semibold text-white" style={HEADING}>{answers.length} {answers.length === 1 ? 'risposta' : 'risposte'}</p>
          {open && mine && <p className="mt-1 text-xs text-slate-400">La tua risposta è già qui</p>}
        </div>
        {open && (
          <p className="shrink-0 rounded-full bg-[rgba(82,217,230,0.12)] px-2.5 py-1 text-right text-[11px] font-medium text-[#b8f4fa]">
            {closesIn(milestone, now)}
          </p>
        )}
      </div>

      {mine && !mine.skipped && open && (
        <p className="flex items-center gap-2 rounded-xl bg-[rgba(82,217,230,0.12)] px-4 py-3 text-sm text-[#b8f4fa]">
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="motion-draw" style={{ ['--len' as string]: 22 }} d="M5 12.5l4.5 4.5L19 7.5" /></svg> Hai risposto alle {romeClock(mine.createdAt ?? now)}: {afterOpen((mine.createdAt ?? now) - fireAt(milestone))}.
        </p>
      )}

      {sorted.length === 0 && <p className="text-sm text-slate-400">Nessuna risposta per questo traguardo.</p>}

      <ul className="space-y-4" data-motion="reveal">
        {sorted.map((e, i) => {
          const person = who(e.uid);
          const delta = (e.createdAt ?? fireAt(milestone)) - fireAt(milestone);
          const fast = delta >= 0 && delta < 10 * MIN;
          return (
            <li key={e.id} className="overflow-hidden rounded-2xl bg-[rgba(96,150,214,0.13)]" data-rank={i + 1}>
              <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 px-4 pb-2 pt-4">
                    <Avatar src={person?.avatar} name={person?.name ?? 'Qualcuno'} size={36} state="done" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{person?.name ?? 'Qualcuno'}</p>
                      <p className="text-[11px] text-slate-400">{e.createdAt ? romeClock(e.createdAt) : '--:--'} · {afterOpen(delta)}</p>
                    </div>
                    {fast && <span className="shrink-0 rounded-md bg-[#52d9e6] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#04242a]">Lampo</span>}
                  </div>
                  {e.thumb && <FeedPhoto entry={e} name={person?.name ?? 'un partecipante'} onOpen={() => setViewing(e)} />}
                  {e.text && (
                    <p className={`px-4 pb-5 pt-3 leading-relaxed text-slate-100 ${e.thumb ? 'text-sm' : 'text-xl font-medium text-white'}`} style={e.thumb ? undefined : HEADING}>{e.text}</p>
                  )}
                  {!e.text && <div className="h-3" aria-hidden="true" />}
                </div>
                <CapsuleComments
                  entry={e}
                  comments={comments.filter((comment) => comment.capsuleId === e.id)}
                  currentUserId={currentUserId}
                  who={who}
                  expanded={openComments.has(e.id)}
                  onToggle={() => setOpenComments((current) => {
                    const next = new Set(current);
                    if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                    return next;
                  })}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {open && waiting.length > 0 && (
        <section className="space-y-3 rounded-xl bg-[rgba(96,150,214,0.13)] px-4 py-4">
          <p className="text-sm font-semibold text-white">Ancora in attesa</p>
          <ul className="flex flex-wrap gap-3">
            {waiting.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-xs text-slate-300">
                <Avatar src={m.avatar} name={m.name} size={28} state="pending" /> {m.name.split(' ')[0]}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
};

const CapsuleComments: React.FC<{
  entry: CapsuleEntry;
  comments: CapsuleComment[];
  currentUserId: string;
  who: (uid: string) => { id: string; name: string; avatar?: string } | undefined;
  expanded: boolean;
  onToggle: () => void;
}> = ({ entry, comments, currentUserId, who, expanded, onToggle }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const canComment = !!currentUserId && currentUserId !== entry.uid;

  if (!canComment && comments.length === 0) return null;

  const submit = async () => {
    if (!canComment || !text.trim()) return;
    setSubmitting(true);
    setCommentError(null);
    try {
      await addCapsuleComment(entry.id, currentUserId, text);
      setText('');
    } catch (error) {
      setCommentError(friendlyCapsuleError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (commentId: string) => {
    setDeletingId(commentId);
    setCommentError(null);
    try {
      await removeCapsuleComment(commentId);
    } catch (error) {
      setCommentError(friendlyCapsuleError(error));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="border-t border-white/[0.08] px-4 py-2.5 lg:border-l lg:border-t-0 lg:px-4 lg:py-4" aria-label="Commenti">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex min-h-11 w-full items-center gap-2 text-left text-sm text-slate-300 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]"
      >
        <MessageCircle className="h-4 w-4 shrink-0 text-[#52d9e6]" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-200">{comments.length === 0 ? 'Commenta' : `${comments.length} ${comments.length === 1 ? 'commento' : 'commenti'}`}</span>
          {comments.length > 0 && <span className="mt-0.5 block truncate text-[11px] text-slate-500">Ultimo commento di {who(comments[comments.length - 1].authorId)?.name ?? 'qualcuno'}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="pt-2">
          {comments.length > 0 && (
            <ul className="space-y-3 border-t border-white/[0.08] pt-3">
              {comments.map((comment) => {
                const person = who(comment.authorId);
                return (
                  <li key={comment.id} className="flex gap-2 text-sm">
                    <Avatar src={person?.avatar} name={person?.name ?? 'Qualcuno'} size={25} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs font-semibold text-white">{person?.name ?? 'Qualcuno'}{comment.createdAt && <span className="ml-1.5 font-normal text-slate-500">{romeClock(comment.createdAt)}</span>}</p>
                        {comment.authorId === currentUserId && <button type="button" onClick={() => void remove(comment.id)} disabled={deletingId !== null} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d9e6] disabled:opacity-50" aria-label="Elimina il tuo commento">{deletingId === comment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}</button>}
                      </div>
                      <p className="mt-0.5 break-words text-sm text-slate-200">{comment.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {commentError && <p role="alert" className="mt-2 text-xs text-rose-200">{commentError}</p>}

          {canComment && <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="sr-only" htmlFor={`capsule-comment-${entry.id}`}>Commenta il contenuto di {who(entry.uid)?.name ?? 'un partecipante'}</label>
          <textarea
            id={`capsule-comment-${entry.id}`}
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, CAPSULE_COMMENT_MAX))}
            rows={1}
            placeholder="Scrivi un commento…"
            className="min-h-11 flex-1 resize-none rounded-xl bg-[#0a1119] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus-visible:shadow-[inset_0_0_0_1.5px_#52d9e6]"
          />
          <button type="submit" disabled={submitting || !text.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#52d9e6] text-[#04242a] transition-transform active:scale-95 disabled:opacity-40" aria-label="Invia commento">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          </button>
        </form>}
        </div>
      )}
    </section>
  );
};

function closesIn(milestone: Milestone, now: number): string {
  const left = countdown(activeClosesAt(milestone, now) - now);
  return `chiude tra ${left.big} ${left.unit}`;
}

export default CapsuleView;
