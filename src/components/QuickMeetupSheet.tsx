import React, { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Send, Share2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { isSlot } from '../types/expenses';
import { MAP_LOCATIONS, type MapLocation } from '../data/tripData';
import { createMeetup } from '../services/groupLiveService';
import { meetupText, metroSummary } from '../services/quickMeetup';
import { DEFAULT_HOME_ID, loadHomeId, seoulDateIso } from '../map/tripToday';

const QUICK_TIMES = [
  { label: 'Tra 15 min', minutes: 15 },
  { label: 'Tra 30 min', minutes: 30 },
  { label: 'Tra 1 ora', minutes: 60 }
] as const;

/** "HH:MM" di Seul di oggi, come millisecondi. NaN se non è un orario valido. */
const seoulClockToMs = (hhmm: string): number => {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return NaN;
  return Date.parse(`${seoulDateIso()}T${hhmm}:00+09:00`);
};

const inputClass =
  'min-h-11 w-full rounded-xl bg-[#0a1119] px-3 text-sm text-white placeholder:text-slate-500 border border-white/10 focus:outline focus:outline-2 focus:outline-[#52d9e6]';

/**
 * "Ritrovo al volo": scegli un luogo, un'ora, e il gruppo lo riceve con il percorso.
 * Il messaggio si condivide dal telefono (WhatsApp, chat, ecc.) con un tocco in più.
 */
export const QuickMeetupSheet: React.FC<{ stops: MapLocation[]; onClose: () => void }> = ({ stops, onClose }) => {
  const { user } = useAuth();
  // "Casa" è sempre una scelta, anche nei giorni senza tappe in Corea
  const home = MAP_LOCATIONS.find((l) => l.id === (loadHomeId() ?? DEFAULT_HOME_ID)) ?? null;
  const [placeId, setPlaceId] = useState<string | null>(stops[0]?.id ?? home?.id ?? null);
  const [query, setQuery] = useState('');
  const [clock, setClock] = useState('');
  const [pickedMinutes, setPickedMinutes] = useState<number | null>(30);
  const [at, setAt] = useState(() => Date.now() + 30 * 60_000);
  const [route, setRoute] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const place = MAP_LOCATIONS.find((l) => l.id === placeId) ?? null;
  // Le scelte: tappe del giorno, Casa e il luogo cercato (così si vede quale è selezionato)
  const picks = useMemo(() => {
    const list = [...stops];
    for (const extra of [home, place]) if (extra && !list.some((s) => s.id === extra.id)) list.push(extra);
    return list;
  }, [stops, home, place]);
  const timeOk = Number.isFinite(at) && at > Date.now();
  const canSend = !!place && timeOk && !busy && sentAt === null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return MAP_LOCATIONS.filter(
      (l) => (l.city === 'Seul' || l.city === 'Dintorni / Gite') && l.category !== 'alloggio' &&
        `${l.name} ${l.italianName} ${l.koreanName ?? ''}`.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query]);

  // Il percorso si calcola una volta per luogo; l'ora si legge al momento dell'invio
  useEffect(() => {
    let alive = true;
    setRoute('');
    if (place) metroSummary(loadHomeId() ?? DEFAULT_HOME_ID, place).then((text) => alive && setRoute(text));
    return () => {
      alive = false;
    };
  }, [place]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const text = place && timeOk ? meetupText(place, sentAt ?? at, route) : '';

  const send = async () => {
    if (!place || !timeOk || !user) return;
    if (!isSlot(user.travelerId)) {
      setError('Il tuo profilo non ha ancora un posto nel gruppo.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createMeetup(user.id, user.travelerId, { label: place.italianName, placeId: place.id, lat: place.lat, lng: place.lng, at, note: '' });
      setSentAt(at);
    } catch {
      setError('Non sono riuscito a creare il ritrovo. Controlla la connessione e riprova.');
    } finally {
      setBusy(false);
    }
  };

  // Va chiamato direttamente dal tocco: il browser non apre la condivisione dopo un'attesa
  const share = async () => {
    if (!text) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Ritrovo', text });
      } catch {
        /* condivisione annullata dall'utente */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError('Non riesco a copiare il messaggio. Selezionalo qui sotto e copialo a mano.');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="quick-meetup-title" data-testid="quick-meetup">
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl bg-[#0a1119] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="quick-meetup-title" className="text-xl font-semibold text-white" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>Ritrovo al volo</h2>
          <button type="button" onClick={onClose} aria-label="Chiudi" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-300 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {sentAt !== null ? (
          <div className="space-y-4" data-testid="quick-meetup-sent">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#52d9e6]"><Check className="h-4 w-4" /> Ritrovo creato per il gruppo</p>
            <p className="whitespace-pre-line rounded-xl bg-[rgba(96,150,214,0.13)] p-3 text-sm leading-relaxed text-slate-200">{text}</p>
            {copied && <p className="text-xs text-slate-400">Messaggio copiato: incollalo nella chat del gruppo.</p>}
            <button type="button" onClick={share} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#52d9e6] px-4 text-sm font-semibold text-[#04242a]">
              <Share2 className="h-4 w-4" /> Invia nella chat del gruppo
            </button>
          </div>
        ) : (
          <>
            <section className="space-y-2" aria-label="Dove">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dove</p>
              {picks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {picks.map((s) => (
                    <button key={s.id} type="button" aria-pressed={placeId === s.id} onClick={() => setPlaceId(s.id)} className={`min-h-11 rounded-xl px-3 text-sm ${placeId === s.id ? 'bg-[#52d9e6] font-semibold text-[#04242a]' : 'bg-[rgba(96,150,214,0.13)] text-slate-200'}`}>
                      {s.italianName}
                    </button>
                  ))}
                </div>
              )}
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un altro luogo" className={inputClass} aria-label="Cerca un altro luogo" />
              {results.length > 0 && (
                <ul className="divide-y divide-white/[0.08] rounded-xl bg-[rgba(96,150,214,0.13)]">
                  {results.map((l) => (
                    <li key={l.id}>
                      <button type="button" onClick={() => { setPlaceId(l.id); setQuery(''); }} className="flex min-h-11 w-full items-center px-3 text-left text-sm text-slate-100">
                        {l.italianName}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2" aria-label="Quando">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quando</p>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_TIMES.map((t) => (
                  <button key={t.minutes} type="button" aria-pressed={pickedMinutes === t.minutes} onClick={() => { setAt(Date.now() + t.minutes * 60_000); setClock(''); setPickedMinutes(t.minutes); }} className={`min-h-11 rounded-xl text-sm ${pickedMinutes === t.minutes ? 'bg-[#52d9e6] font-semibold text-[#04242a]' : 'bg-[rgba(96,150,214,0.13)] text-slate-200'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <span className="shrink-0">Oppure alle (ora di Seul)</span>
                <input type="time" value={clock} onChange={(e) => { setClock(e.target.value); setPickedMinutes(null); setAt(seoulClockToMs(e.target.value)); }} className={`${inputClass} max-w-[9rem]`} />
              </label>
              {!timeOk && <p className="text-xs text-amber-200">Scegli un orario futuro.</p>}
            </section>

            {place && timeOk && (
              <section className="space-y-2" aria-label="Anteprima del messaggio">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Messaggio per il gruppo</p>
                <p className="whitespace-pre-line rounded-xl bg-[rgba(96,150,214,0.13)] p-3 text-sm leading-relaxed text-slate-200">{text}</p>
              </section>
            )}

            {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}

            <button type="button" onClick={send} disabled={!canSend} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#52d9e6] px-4 text-sm font-semibold text-[#04242a] disabled:opacity-40">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? 'Invio in corso…' : 'Crea il ritrovo'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default QuickMeetupSheet;
