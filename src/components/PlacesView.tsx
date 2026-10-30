import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark, Check, CircleAlert, ExternalLink, Loader2, LocateFixed, Map as MapIcon, Navigation, Pencil, Plus, ThumbsDown, ThumbsUp, Trash2, X
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { MAP_LOCATIONS, getNaverMapSearchUrl } from '../data/tripData';
import { haversineMeters } from '../data/metroRouter';
import type { TravelerSlotId } from '../shared/travelerProfile';
import { isSlot } from '../types/expenses';
import {
  PLACE_CATEGORIES, PLACE_PRIORITIES, categoryOf, directionsUrl, isShortLink, parseSharedText, placeScore, priorityOf, sortPlaces,
  type PlaceCategory, type PlacePriority, type SharedPlace
} from '../shared/places';
import { activeShare, formatDistance } from '../shared/groupLive';
import { currentPosition, useGroupLive } from './group/groupLiveStore';
import { focusPlace, markVisited, removePlace, savePlace, updatePlace, usePlaces, vote } from './places/placesStore';

const NEAR_RADIUS_M = 1500;

type Mode = 'all' | 'todo' | 'near' | 'done';
const MODES: { id: Mode; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'todo', label: 'Da fare' },
  { id: 'near', label: 'Vicino a noi' },
  { id: 'done', label: 'Visitati' }
];

interface Shared {
  title: string;
  text: string;
  url: string;
}

/* ---------- Aggiunta / modifica ---------- */

const PlaceSheet: React.FC<{ onClose: () => void; shared?: Shared | null; place?: SharedPlace | null; myUid: string; mySlot: TravelerSlotId }> = ({
  onClose, shared, place, myUid, mySlot
}) => {
  const initial = useMemo(() => (shared ? parseSharedText([shared.text, shared.url].filter(Boolean).join('\n'), shared.title) : null), [shared]);
  const [paste, setPaste] = useState(shared ? [shared.title, shared.text, shared.url].filter(Boolean).join('\n') : '');
  const [name, setName] = useState(place?.name ?? initial?.name ?? '');
  const [link, setLink] = useState(place?.link ?? initial?.url ?? '');
  const [category, setCategory] = useState<PlaceCategory>(place?.category ?? 'food');
  const [priority, setPriority] = useState<PlacePriority>(place?.priority ?? 'nice');
  const [note, setNote] = useState(place?.note ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number; source: string } | null>(
    place ? { lat: place.lat, lng: place.lng, source: 'Posizione già salvata' } : initial?.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng, source: 'Trovata nel link' } : null
  );
  const [nearId, setNearId] = useState('');
  const [busy, setBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
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

  const seoulPlaces = useMemo(
    () => MAP_LOCATIONS.filter((l) => l.city === 'Seul' || l.city === 'Dintorni / Gite').sort((a, b) => a.italianName.localeCompare(b.italianName)),
    []
  );

  const onPaste = (v: string) => {
    setPaste(v);
    const p = parseSharedText(v);
    if (p.url) setLink(p.url);
    if (p.name && !name.trim()) setName(p.name);
    if (p.lat != null && p.lng != null) setCoords({ lat: p.lat, lng: p.lng, source: 'Trovata nel link' });
  };

  const useGps = async () => {
    setError(null);
    setGpsBusy(true);
    try {
      const [lat, lng] = await currentPosition();
      setCoords({ lat, lng, source: 'La tua posizione adesso' });
      setNearId('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGpsBusy(false);
    }
  };

  const pickNear = (id: string) => {
    setNearId(id);
    const p = MAP_LOCATIONS.find((l) => l.id === id);
    if (p) setCoords({ lat: p.lat, lng: p.lng, source: `Vicino a ${p.italianName || p.name} (approssimata)` });
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Scrivi il nome del posto.');
    if (!coords) return setError('Manca la posizione: usa il GPS, incolla un link con le coordinate o scegli un luogo vicino.');
    if (link.trim() && !/^https?:\/\//i.test(link.trim())) return setError('Il link deve iniziare con http:// o https://.');
    setBusy(true);
    try {
      const input = { name, category, priority, lat: coords.lat, lng: coords.lng, link, note };
      if (place) await updatePlace(place.id, input);
      else await savePlace(myUid, mySlot, input);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Non sono riuscito a salvare il posto.');
      setBusy(false);
    }
  };

  const input = 'w-full min-h-[46px] rounded-xl bg-slate-950 border border-slate-700 focus:border-violet-400 focus:outline-none px-3 text-sm text-white';
  const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';
  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={place ? 'Modifica il posto' : 'Nuovo posto'} data-testid="place-sheet">
      <div className="w-full sm:max-w-md max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800">
          <Bookmark className="w-5 h-5 text-violet-300" />
          <p className="flex-1 text-sm font-bold text-white">{place ? 'Modifica il posto' : 'Salva un posto per il gruppo'}</p>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-4 py-4 space-y-3.5">
          {!place && (
            <label className="block">
              <span className={label}>Incolla un link o un testo (facoltativo)</span>
              <textarea value={paste} onChange={(e) => onPaste(e.target.value)} rows={2} placeholder="Link di Naver, Google Maps, Instagram…" className={`${input} py-2.5 resize-none`} data-testid="place-paste" />
              {link && isShortLink(link) && <span className="block mt-1 text-[11px] text-slate-500">I link brevi non contengono la posizione: scegli sotto come indicarla.</span>}
            </label>
          )}
          <label className="block">
            <span className={label}>Nome</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="es. Ramen di Mangwon" className={input} data-testid="place-name" />
          </label>
          <div>
            <span className={label}>Che tipo di posto</span>
            <div className="flex flex-wrap gap-1.5">
              {PLACE_CATEGORIES.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategory(c.id)} aria-pressed={category === c.id} className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold ${category === c.id ? 'bg-violet-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`} data-testid={`place-cat-${c.id}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>Quanto ci tenete</span>
            <div className="grid grid-cols-3 gap-1.5">
              {PLACE_PRIORITIES.map((p) => (
                <button key={p.id} type="button" onClick={() => setPriority(p.id)} aria-pressed={priority === p.id} className={`min-h-[40px] rounded-xl text-[11.5px] font-semibold ${priority === p.id ? 'bg-violet-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`} data-testid={`place-pri-${p.id}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={label}>Dov’è</span>
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={useGps} disabled={gpsBusy} className="min-h-[44px] rounded-xl bg-slate-800 text-cyan-100 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60" data-testid="place-loc-gps">
                {gpsBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />} Sono qui adesso
              </button>
              <select value={nearId} onChange={(e) => pickNear(e.target.value)} className={input} aria-label="Scegli un luogo vicino" data-testid="place-loc-near">
                <option value="">Oppure: è vicino a…</option>
                {seoulPlaces.map((p) => <option key={p.id} value={p.id}>{p.italianName || p.name}</option>)}
              </select>
            </div>
            <p className={`mt-1.5 text-[11px] flex items-center gap-1.5 ${coords ? 'text-emerald-300' : 'text-slate-500'}`} data-testid="place-coords">
              {coords ? <><Check className="w-3.5 h-3.5" /> {coords.source}</> : 'Nessuna posizione scelta'}
            </p>
          </div>
          <label className="block">
            <span className={label}>Link (facoltativo)</span>
            <input value={link} onChange={(e) => setLink(e.target.value)} maxLength={500} inputMode="url" placeholder="https://…" className={input} data-testid="place-link" />
          </label>
          <label className="block">
            <span className={label}>Nota (facoltativa)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="es. Chiude alle 21, si paga solo in contanti" className={input} data-testid="place-note" />
          </label>
          {error && <p role="alert" className="text-xs text-amber-300 flex gap-1.5"><CircleAlert className="w-4 h-4 shrink-0" />{error}</p>}
        </div>
        <div className="px-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-200 text-sm font-semibold">Annulla</button>
          <button type="button" onClick={save} disabled={busy} className="min-h-[48px] rounded-2xl bg-violet-400 disabled:opacity-50 text-slate-950 text-sm font-bold flex items-center justify-center gap-2" data-testid="place-save">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {place ? 'Salva' : 'Aggiungi'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ---------- Schermata ---------- */

export const PlacesView: React.FC<{ onShowMap: () => void }> = ({ onShowMap }) => {
  const { user, travelers } = useAuth();
  const slot: TravelerSlotId | null = user && isSlot(user.travelerId) ? user.travelerId : null;
  const bySlot = useMemo(() => Object.fromEntries(travelers.map((t) => [t.id, t])), [travelers]);
  const { places, ready, error } = usePlaces();
  const g = useGroupLive();
  const [mode, setMode] = useState<Mode>('all');
  const [cat, setCat] = useState<PlaceCategory | 'all'>('all');
  const [sheet, setSheet] = useState<{ place?: SharedPlace | null; shared?: Shared | null } | null>(null);
  const [gps, setGps] = useState<[number, number] | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  // Apertura dal menù "Condividi" del telefono (Android) o da ?add=1
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const title = p.get('title') ?? '';
    const text = p.get('text') ?? '';
    const url = p.get('url') ?? '';
    if (!(title || text || url || p.get('add') === '1')) return;
    setSheet({ shared: title || text || url ? { title, text, url } : null });
    for (const k of ['title', 'text', 'url', 'add']) p.delete(k);
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  }, []);

  // Punti di riferimento per "vicino a noi": la mia posizione e quella degli amici che la condividono
  const refs = useMemo(() => {
    const list: { label: string; p: [number, number] }[] = [];
    const mine = g.myPos ?? gps;
    if (mine) list.push({ label: 'te', p: mine });
    for (const d of g.live) {
      const sh = activeShare(d, now);
      if (sh && d.slot !== slot) list.push({ label: bySlot[d.slot]?.name ?? 'un amico', p: [sh.lat, sh.lng] });
    }
    return list;
  }, [g.myPos, g.live, gps, slot, bySlot, now]);

  const nearest = (pl: SharedPlace) => {
    let best: { label: string; m: number } | null = null;
    for (const r of refs) {
      const m = haversineMeters(r.p, [pl.lat, pl.lng]);
      if (!best || m < best.m) best = { label: r.label, m };
    }
    return best;
  };

  const list = useMemo(() => {
    let l = sortPlaces(places);
    if (cat !== 'all') l = l.filter((p) => p.category === cat);
    if (mode === 'todo') l = l.filter((p) => !p.visited);
    if (mode === 'done') l = l.filter((p) => p.visited);
    if (mode === 'near') {
      l = l
        .map((p) => ({ p, n: nearest(p) }))
        .filter((x) => x.n && x.n.m <= NEAR_RADIUS_M && !x.p.visited)
        .sort((a, b) => a.n!.m - b.n!.m)
        .map((x) => x.p);
    }
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, cat, mode, refs]);

  const locate = async () => {
    setGpsError(null);
    try {
      setGps(await currentPosition());
    } catch (err) {
      setGpsError((err as Error).message);
    }
  };

  const showOnMap = (id: string) => {
    focusPlace(id);
    onShowMap();
  };

  if (!user || !slot) return null;
  const chip = (active: boolean) => `shrink-0 min-h-[38px] px-3.5 rounded-full text-xs font-semibold border ${active ? 'bg-violet-400 text-slate-950 border-violet-300' : 'bg-slate-900 text-slate-300 border-slate-700'}`;
  return (
    <div className="space-y-4" data-testid="places-view">
      <header className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white font-display flex items-center gap-2"><Bookmark className="w-5 h-5 text-violet-300" /> Luoghi condivisi</h2>
          <p className="text-xs text-slate-400 mt-1 leading-snug">Posti scoperti per strada o su Instagram, fuori dall’itinerario. Compaiono in viola sulla mappa.</p>
        </div>
        <button type="button" onClick={() => setSheet({})} className="min-h-[44px] px-4 rounded-2xl bg-violet-400 text-slate-950 text-sm font-bold flex items-center gap-1.5 shrink-0" data-testid="place-add">
          <Plus className="w-4 h-4" /> Aggiungi
        </button>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Filtra per stato">
        {MODES.map((m) => (
          <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className={chip(mode === m.id)} data-testid={`place-filter-${m.id}`}>{m.label}</button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Filtra per tipo">
        <button type="button" onClick={() => setCat('all')} aria-pressed={cat === 'all'} className={chip(cat === 'all')}>Tutti i tipi</button>
        {PLACE_CATEGORIES.map((c) => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={chip(cat === c.id)} data-testid={`place-filter-cat-${c.id}`}>{c.emoji} {c.label}</button>
        ))}
      </div>

      {mode === 'near' && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300 space-y-2" data-testid="place-near-info">
          {refs.length === 0 ? (
            <>
              <p>Per vedere cosa c’è vicino serve la tua posizione (o quella di un amico che la condivide).</p>
              <button type="button" onClick={locate} className="min-h-[44px] px-4 rounded-xl bg-slate-800 text-cyan-100 font-semibold flex items-center gap-2"><LocateFixed className="w-4 h-4" /> Usa la mia posizione</button>
            </>
          ) : (
            <p>Entro {formatDistance(NEAR_RADIUS_M)} da: {refs.map((r) => r.label).join(', ')}.</p>
          )}
          {gpsError && <p className="text-amber-300" role="alert">{gpsError}</p>}
        </div>
      )}

      {error && <p className="text-xs text-amber-300 flex gap-1.5" role="alert"><CircleAlert className="w-4 h-4 shrink-0" />{error}</p>}
      {!ready && <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Carico i posti…</p>}
      {ready && list.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400" data-testid="places-empty">
          {places.length === 0 ? 'Nessun posto salvato. Trovato qualcosa di interessante? Aggiungilo!' : 'Nessun posto con questi filtri.'}
        </div>
      )}

      <ul className="space-y-3">
        {list.map((p) => {
          const c = categoryOf(p.category);
          const pr = priorityOf(p.priority);
          const mine = p.votes[slot];
          const ups = Object.entries(p.votes).filter(([, v]) => v === 'up');
          const downs = Object.entries(p.votes).filter(([, v]) => v === 'down');
          const n = nearest(p);
          const names = (arr: [string, string | undefined][]) => arr.map(([s]) => bySlot[s]?.name ?? s).join(', ');
          return (
            <li key={p.id} className={`rounded-2xl border p-3.5 ${p.visited ? 'border-slate-800 bg-slate-900/40 opacity-75' : 'border-violet-500/30 bg-violet-500/5'}`} data-testid="place-card">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: `${c.color}33` }}>{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white leading-tight">{p.name}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {c.label} · <span className={p.priority === 'must' ? 'text-violet-300 font-semibold' : ''}>{pr.label}</span> · di {p.addedBySlot === slot ? 'te' : bySlot[p.addedBySlot]?.name ?? 'un amico'}
                    {n && <> · <span className="text-cyan-300">a {formatDistance(n.m)} da {n.label}</span></>}
                  </p>
                  {p.note && <p className="text-xs text-slate-300 mt-1.5 leading-snug">{p.note}</p>}
                </div>
                {p.addedBy === user.id && (
                  <div className="flex shrink-0">
                    <button type="button" onClick={() => setSheet({ place: p })} className="min-h-[40px] min-w-[40px] rounded-lg text-slate-400 hover:text-white flex items-center justify-center" aria-label="Modifica"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => removePlace(p.id)} className="min-h-[40px] min-w-[40px] rounded-lg text-slate-400 hover:text-rose-300 flex items-center justify-center" aria-label="Elimina" data-testid="place-delete"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => vote(p.id, slot, mine === 'up' ? null : 'up')} aria-pressed={mine === 'up'} title={names(ups) || 'Nessun voto'} className={`min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${mine === 'up' ? 'bg-emerald-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`} data-testid="place-vote-up">
                  <ThumbsUp className="w-4 h-4" /> Ci sto · {ups.length}
                </button>
                <button type="button" onClick={() => vote(p.id, slot, mine === 'down' ? null : 'down')} aria-pressed={mine === 'down'} title={names(downs) || 'Nessun voto'} className={`min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${mine === 'down' ? 'bg-rose-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`} data-testid="place-vote-down">
                  <ThumbsDown className="w-4 h-4" /> Passo · {downs.length}
                </button>
              </div>
              {(ups.length > 0 || downs.length > 0) && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {ups.length > 0 && <>Ci stanno: {names(ups)}. </>}{downs.length > 0 && <>Passano: {names(downs)}.</>} Punteggio {placeScore(p) > 0 ? '+' : ''}{placeScore(p)}.
                </p>
              )}

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => showOnMap(p.id)} className="min-h-[38px] px-3 rounded-xl bg-slate-800 text-violet-200 text-xs font-semibold flex items-center gap-1.5" data-testid="place-on-map"><MapIcon className="w-3.5 h-3.5" /> Mappa</button>
                <a href={getNaverMapSearchUrl({ lat: p.lat, lng: p.lng, name: p.name })} target="_blank" rel="noopener noreferrer" className="min-h-[38px] px-3 rounded-xl bg-slate-800 text-emerald-200 text-xs font-semibold flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Naver</a>
                <a href={directionsUrl(p)} target="_blank" rel="noopener noreferrer" className="min-h-[38px] px-3 rounded-xl bg-slate-800 text-cyan-200 text-xs font-semibold flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5" /> Indicazioni</a>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="min-h-[38px] px-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Link</a>
                )}
                <button type="button" onClick={() => markVisited(p.id, !p.visited)} aria-pressed={p.visited} className={`min-h-[38px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${p.visited ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-800 text-slate-200'}`} data-testid="place-visited">
                  <Check className="w-3.5 h-3.5" /> {p.visited ? 'Visitato' : 'Segna visitato'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {sheet && <PlaceSheet onClose={() => setSheet(null)} shared={sheet.shared} place={sheet.place} myUid={user.id} mySlot={slot} />}
    </div>
  );
};

export default PlacesView;
