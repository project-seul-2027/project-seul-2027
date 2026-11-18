import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Hourglass, ImagePlus, Loader2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isSlot } from '../types/expenses';
import { compressImage } from '../services/galleryService';
import { CAPSULE_TEXT_MAX, friendlyCapsuleError, removeCapsule, saveCapsule, watchCapsule, type CapsuleEntry } from '../services/capsuleService';
import { MILESTONES, closesAt, defaultMilestone, fireAt, stateOf, type Milestone } from '../utils/capsule';

const HEADING: React.CSSProperties = { fontFamily: 'Outfit, system-ui, sans-serif' };
const romeDay = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(ms));
const romeClock = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/** "tra 5 ore", "tra 2 giorni": per dire quanto manca all'apertura o alla chiusura */
function relative(ms: number): string {
  const h = Math.max(1, Math.round(ms / 3_600_000));
  return h < 36 ? `tra ${h} ${h === 1 ? 'ora' : 'ore'}` : `tra ${Math.round(h / 24)} giorni`;
}

const label = (m: Milestone) => (m === 1 ? 'Ultimo giorno' : `${m} giorni`);

const inputClass =
  'w-full rounded-xl bg-[#0a1119] px-3 py-2.5 text-sm text-white placeholder:text-slate-500 border border-white/10 focus:outline focus:outline-2 focus:outline-[#52d9e6]';

/**
 * Capsula del tempo: a 100, 50, 30, 14, 7 e 1 giorno dalla partenza tutti raccontano cosa stanno facendo (una foto o una riga).
 * Le risposte degli altri si vedono dopo aver risposto, o quando il traguardo si chiude.
 * È una scelta di gioco, non di sicurezza: le regole del database lasciano leggere a tutto il gruppo.
 */
export const CapsuleView: React.FC = () => {
  const { user, group } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  const [entries, setEntries] = useState<CapsuleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Milestone>(() => defaultMilestone(Date.now()));

  useEffect(() => watchCapsule(setEntries, setError), []);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const total = group.length || 4;
  const state = stateOf(selected, now);
  const mine = entries.find((e) => e.milestone === selected && e.uid === user?.id) ?? null;
  const ofMilestone = useMemo(() => entries.filter((e) => e.milestone === selected && !e.skipped), [entries, selected]);
  const answeredCount = ofMilestone.length;
  // Si vedono le risposte degli altri dopo aver risposto, oppure a traguardo chiuso
  const revealed = state === 'closed' || (!!mine && !mine.skipped);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-10 lg:max-w-none" data-testid="capsule">
      <header className="min-w-0">
        <h1 className="sr-only" style={HEADING}>Capsula del tempo</h1>
        <p className="text-sm text-slate-400">
          Prima della partenza vi chiedo sei volte cosa state facendo: una foto o una riga. Le risposte degli altri si vedono appena rispondi.
        </p>
      </header>

      <div role="radiogroup" aria-label="Traguardo" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        {MILESTONES.map((m) => {
          const s = stateOf(m, now);
          const picked = m === selected;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={picked}
              onClick={() => setSelected(m)}
              className={`min-h-11 shrink-0 rounded-xl px-3.5 text-sm ${picked ? 'bg-[#52d9e6] font-semibold text-[#04242a]' : 'bg-[rgba(96,150,214,0.13)] text-slate-200'}`}
            >
              {label(m)}
              <span className="sr-only"> ({s === 'open' ? 'aperto' : s === 'closed' ? 'chiuso' : 'non ancora aperto'})</span>
              {s === 'open' && !picked && <span aria-hidden="true" className="ml-1.5 inline-block h-2 w-2 rounded-full bg-[#52d9e6]" />}
            </button>
          );
        })}
      </div>

      {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}

      <section className="rounded-xl bg-[rgba(96,150,214,0.13)] px-4 py-4" data-testid={`capsule-${selected}`}>
        <h2 className="flex items-center gap-2 text-base font-semibold text-white" style={HEADING}>
          <Hourglass className="h-4 w-4 text-[#52d9e6]" aria-hidden="true" />
          {selected === 1 ? 'Domani si parte' : `${selected} giorni a Seul`}
        </h2>

        {state === 'upcoming' && (
          <p className="mt-3 text-sm text-slate-200">
            Si apre {romeDay(fireAt(selected))} alle {romeClock(fireAt(selected))} ({relative(fireAt(selected) - now)}). Ti arriva una notifica.
          </p>
        )}

        {state === 'open' && !mine && (
          <Composer key={selected} milestone={selected} closesIn={relative(closesAt(selected) - now)} uid={user?.id ?? ''} travelerId={user?.travelerId} onError={setError} />
        )}

        {state === 'open' && mine?.skipped && (
          <div className="mt-3 space-y-3 text-sm text-slate-200">
            <p>Hai saltato questa volta. Puoi ancora rispondere fino a {romeDay(closesAt(selected))} alle {romeClock(closesAt(selected))}.</p>
            <button
              type="button"
              onClick={() => user && removeCapsule(selected, user.id).catch((e) => setError(friendlyCapsuleError(e)))}
              className="inline-flex min-h-11 items-center rounded-xl bg-[#52d9e6] px-4 text-sm font-semibold text-[#04242a]"
            >
              Rispondi adesso
            </button>
          </div>
        )}

        {state === 'closed' && ofMilestone.length === 0 && <p className="mt-3 text-sm text-slate-400">Nessuno ha risposto a questo traguardo.</p>}
        {state === 'closed' && ofMilestone.length > 0 && <p className="mt-3 text-sm text-slate-400">Traguardo chiuso: ora si vedono tutte le risposte.</p>}

        {state !== 'upcoming' && (
          <p className="mt-3 text-xs text-slate-400" data-testid="capsule-progress">
            {answeredCount} su {total} {answeredCount === 1 ? 'ha risposto' : 'hanno risposto'}
            {state === 'open' && ` · chiude ${romeDay(closesAt(selected))} alle ${romeClock(closesAt(selected))}`}
          </p>
        )}
      </section>

      {state !== 'upcoming' && !revealed && (
        <p className="rounded-xl bg-[rgba(96,150,214,0.13)] px-4 py-4 text-sm text-slate-300" data-testid="capsule-locked">
          Le risposte degli altri compaiono qui appena rispondi, o quando il traguardo si chiude.
        </p>
      )}

      {revealed && ofMilestone.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2" data-testid="capsule-entries">
          {ofMilestone.map((e) => {
            const who = group.find((g) => g.id === e.uid);
            return (
              <li key={e.id} className="overflow-hidden rounded-xl bg-[rgba(96,150,214,0.13)]">
                {e.thumb && <img src={e.thumb} alt={`Foto di ${who?.displayName ?? 'un partecipante'}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />}
                <div className="space-y-1 px-4 py-3">
                  <p className="text-xs font-semibold text-[#52d9e6]">{who?.displayName ?? 'Qualcuno'}</p>
                  {e.text && <p className="whitespace-pre-line text-sm leading-relaxed text-slate-100">{e.text}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/** Foto e/o riga, "Pubblica" o "Salta questa volta" */
const Composer: React.FC<{ milestone: Milestone; closesIn: string; uid: string; travelerId: unknown; onError: (m: string | null) => void }> = ({ milestone, closesIn, uid, travelerId, onError }) => {
  const [text, setText] = useState('');
  const [thumb, setThumb] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const slot = isSlot(travelerId) ? travelerId : null;
  const ready = !!uid && !!slot && !busy && !preparing && (text.trim().length > 0 || thumb !== '');

  const pick = async (file: File | undefined) => {
    if (!file) return;
    onError(null);
    setPreparing(true);
    try {
      setThumb((await compressImage(file)).thumb);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Non riesco a leggere questa foto.');
    } finally {
      setPreparing(false);
    }
  };

  const publish = async (input: { text: string; thumb?: string } | { skipped: true }) => {
    if (!uid || !slot) {
      onError('Il tuo profilo non ha ancora un posto nel gruppo.');
      return;
    }
    setBusy(true);
    onError(null);
    try {
      await saveCapsule(uid, slot, milestone, input);
    } catch (e) {
      onError(friendlyCapsuleError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3" data-testid="capsule-composer">
      <p className="text-sm text-slate-200">Cosa stai facendo adesso? Puoi rispondere {closesIn.replace('tra', 'entro')}.</p>

      {thumb ? (
        <div className="relative">
          <img src={thumb} alt="Anteprima della tua foto" className="aspect-[4/3] w-full rounded-xl object-cover" />
          <button type="button" onClick={() => setThumb('')} aria-label="Togli la foto" className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-black/60 text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={preparing} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0a1119] px-4 text-sm font-semibold text-slate-100 disabled:opacity-50">
          {preparing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4 text-[#52d9e6]" aria-hidden="true" />}
          {preparing ? 'Preparo la foto…' : 'Aggiungi una foto'}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />

      <label className="block">
        <span className="sr-only">Una riga su cosa stai facendo</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, CAPSULE_TEXT_MAX))}
          rows={3}
          placeholder="Oppure scrivi una riga"
          className={inputClass}
        />
        <span className="mt-1 block text-right text-xs tabular-nums text-slate-500">{text.length}/{CAPSULE_TEXT_MAX}</span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => publish({ text, thumb: thumb || undefined })}
          disabled={!ready}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#52d9e6] px-4 text-sm font-semibold text-[#04242a] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
          {busy ? 'Pubblico…' : 'Pubblica'}
        </button>
        <button type="button" onClick={() => publish({ skipped: true })} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm text-slate-300 disabled:opacity-40">
          Salta questa volta
        </button>
      </div>
    </div>
  );
};

export default CapsuleView;
