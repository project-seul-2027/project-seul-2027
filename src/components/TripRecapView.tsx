import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Heart, Lock, MapPin } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ITINERARY_DAYS } from '../data/tripData';
import { useItineraryLive } from '../services/itineraryLiveService';
import { watchPlaces } from '../services/placesService';
import { galleryService } from '../services/galleryService';
import { watchExpenses } from '../services/expenseService';
import { watchCapsule, type CapsuleEntry } from '../services/capsuleService';
import { CapsulePhotoViewer } from './CapsulePhotoViewer';
import { MILESTONES, fireAt, stateOf, type Milestone } from '../utils/capsule';
import { locateNow } from '../utils/tripClock';
import type { SharedPlace } from '../shared/places';
import type { PhotoDoc } from '../types/gallery';
import type { Expense } from '../types/expenses';

type RecapTarget = 'itinerary' | 'places' | 'gallery' | 'expenses' | 'capsula';

interface TripRecapViewProps {
  onGoTo: (tab: RecapTarget) => void;
}

const HEADING: React.CSSProperties = { fontFamily: 'Outfit, system-ui, sans-serif' };
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';

const moneyEur = (cents: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(cents / 100);

const romeDate = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));

const milestoneTitle = (m: Milestone) => (m === 1 ? 'Vigilia della partenza (−1 giorno)' : `−${m} giorni alla partenza`);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

export const TripRecapView: React.FC<TripRecapViewProps> = ({ onGoTo }) => {
  const { user, group } = useAuth();
  const { byDay } = useItineraryLive();

  const [places, setPlaces] = useState<SharedPlace[]>([]);
  const [photos, setPhotos] = useState<PhotoDoc[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [capsuleEntries, setCapsuleEntries] = useState<CapsuleEntry[]>([]);
  const [viewerPhoto, setViewerPhoto] = useState<{ id: string; thumb: string; alt: string } | null>(null);

  const now = Date.now();
  const phase = useMemo(() => locateNow(now).phase, [now]);

  useEffect(() => watchPlaces(setPlaces, () => setPlaces([])), []);
  useEffect(() => galleryService.watchPhotos(200, setPhotos, () => setPhotos([])), []);
  useEffect(() => watchExpenses((snap) => setExpenses(snap.expenses), () => setExpenses([])), []);
  useEffect(() => watchCapsule(setCapsuleEntries, () => setCapsuleEntries([])), []);

  const members = useMemo(() => {
    const list = group.map((g) => ({
      id: g.id,
      slot: g.travelerId,
      name: g.displayName || g.firstName || 'Partecipante',
      avatar: g.avatarUrl || undefined
    }));
    return list.length
      ? list
      : [
          {
            id: user?.id ?? 'me',
            slot: user?.travelerId ?? 't1',
            name: user?.displayName || user?.firstName || 'Tu',
            avatar: user?.avatarUrl || undefined
          }
        ];
  }, [group, user]);

  const whoByUid = (uid: string) => members.find((m) => m.id === uid);

  const doneStopsCount = useMemo(() => {
    let count = 0;
    Object.values(byDay).forEach((d) => {
      Object.values(d.stopStates ?? {}).forEach((st) => {
        if (st === 'done') count += 1;
      });
    });
    return count;
  }, [byDay]);

  const dayDiary = useMemo(() => {
    return ITINERARY_DAYS.flatMap((d) => {
      const live = byDay[d.id];
      if (!live) return [];
      const hasNote = Boolean(live.note?.trim());
      const doneAdded = (live.addedStops ?? []).filter((a) => live.stopStates[`a_${a.id}`] !== 'skipped');
      if (!hasNote && doneAdded.length === 0) return [];
      return [
        {
          dayId: d.id,
          dateStr: d.dateStr.replace(' 2027', ''),
          title: d.title,
          note: live.note?.trim() ?? '',
          addedNames: doneAdded.map((a) => a.name)
        }
      ];
    });
  }, [byDay]);

  const visitedPlaces = useMemo(() => places.filter((p) => p.visited), [places]);

  const topPhotos = useMemo(() => {
    return [...photos]
      .sort((a, b) => b.likes.length - a.likes.length || b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [photos]);

  const totalSpentCents = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amountCents, 0),
    [expenses]
  );

  const capsuleTimeline = useMemo(() => {
    return MILESTONES.map((m) => {
      const st = stateOf(m, now);
      const ofM = capsuleEntries.filter((e) => e.milestone === m && !e.skipped);
      const answeredByMe = ofM.some((e) => e.uid === user?.id);
      const revealed = st === 'closed' || answeredByMe;
      return {
        milestone: m,
        state: st,
        revealed,
        openedAtMs: fireAt(m),
        entries: revealed ? ofM.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)) : []
      };
    });
  }, [capsuleEntries, now, user?.id]);

  const unlockedCapsuleCount = useMemo(
    () => capsuleTimeline.reduce((acc, m) => acc + m.entries.length, 0),
    [capsuleTimeline]
  );

  const hasTripActivity =
    phase !== 'before' || doneStopsCount > 0 || visitedPlaces.length > 0 || photos.length > 0 || totalSpentCents > 0;

  const heroTitle =
    phase === 'after'
      ? 'Com’è andata a Seul e Pechino'
      : phase === 'during'
        ? 'Il viaggio fin qui'
        : 'Prima di partire';

  const heroSub =
    phase === 'after'
      ? 'Tappe fatte, luoghi scoperti, scatti del gruppo e tutta la capsula del tempo.'
      : phase === 'during'
        ? 'Tappe, appunti, foto e spese si aggiornano man mano.'
        : 'Le risposte alla capsula del tempo, una dopo l’altra. Dal 1° marzo qui finiscono anche foto, tappe e conti.';

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 pb-10 lg:max-w-none" data-testid="trip-recap-view">
      {/* Testata editoriale aperta sul fondo della pagina */}
      <header className="space-y-4 border-b border-white/[0.08] pb-6">
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-medium text-slate-400">
            Seul e Pechino · 1–20 marzo 2027
          </p>
          <h2 className="mt-1.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-white" style={HEADING}>
            {heroTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">{heroSub}</p>
        </div>

        {/* Numeri essenziali: prima del viaggio mostra solo ciò che esiste già, senza zeri vuoti */}
        {hasTripActivity ? (
          <div className="pt-4 border-t border-white/[0.08] grid grid-cols-2 sm:grid-cols-4 gap-y-5 sm:gap-y-0 sm:divide-x sm:divide-white/[0.08]">
            <button
              type="button"
              onClick={() => onGoTo('itinerary')}
              className={`text-left sm:pr-5 group ${FOCUS_RING}`}
            >
              <span className="block text-3xl font-extrabold text-white tabular-nums" style={HEADING}>
                {doneStopsCount}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#52d9e6] transition-colors">
                Tappe fatte <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onGoTo('places')}
              className={`text-left sm:px-5 group ${FOCUS_RING}`}
            >
              <span className="block text-3xl font-extrabold text-white tabular-nums" style={HEADING}>
                {visitedPlaces.length}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#52d9e6] transition-colors">
                Luoghi visitati <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onGoTo('gallery')}
              className={`text-left sm:px-5 group ${FOCUS_RING}`}
            >
              <span className="block text-3xl font-extrabold text-white tabular-nums" style={HEADING}>
                {photos.length}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#52d9e6] transition-colors">
                Foto condivise <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onGoTo('expenses')}
              className={`text-left sm:pl-5 group ${FOCUS_RING}`}
            >
              <span className="block text-3xl font-extrabold text-white tabular-nums" style={HEADING}>
                {moneyEur(totalSpentCents)}
              </span>
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#52d9e6] transition-colors">
                Spesa di gruppo <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        ) : (
          <div className="pt-4 border-t border-white/[0.08] flex flex-wrap gap-x-8 gap-y-3">
            <button
              type="button"
              onClick={() => onGoTo('capsula')}
              className={`text-left group ${FOCUS_RING}`}
            >
              <span className="block text-2xl font-extrabold text-white tabular-nums" style={HEADING}>
                {unlockedCapsuleCount}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#52d9e6] transition-colors">
                {unlockedCapsuleCount === 1 ? 'Risposta nella capsula' : 'Risposte nella capsula'} <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onGoTo('places')}
              className={`text-left group ${FOCUS_RING}`}
            >
              <span className="block text-2xl font-extrabold text-white tabular-nums" style={HEADING}>
                {places.length}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#52d9e6] transition-colors">
                {places.length === 1 ? 'Posto salvato da vedere' : 'Posti salvati da vedere'} <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        )}
      </header>

      {/* Foto più amate */}
      {topPhotos.length > 0 && (
        <section data-keep-style className="rounded-2xl bg-[#101c29] border border-white/[0.08] p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white" style={HEADING}>
                Scatti più amati dal gruppo
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Le foto con più cuori nella galleria condivisa.</p>
            </div>
            <button
              type="button"
              onClick={() => onGoTo('gallery')}
              className={`min-h-11 px-2 inline-flex items-center gap-1 text-xs font-semibold text-[#52d9e6] ${FOCUS_RING}`}
            >
              Tutta la galleria <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {topPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => onGoTo('gallery')}
                data-keep-style
                className={`group relative aspect-[4/3] overflow-hidden rounded-xl bg-[#0a1119] text-left ${FOCUS_RING}`}
              >
                <img
                  src={photo.thumb}
                  alt={photo.caption || photo.locationName || 'Foto del viaggio'}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 bg-[#0a1119]/80 px-2.5 py-2 backdrop-blur-[2px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-white">
                      {photo.caption || photo.locationName || (photo.dayNumber !== undefined ? `Giorno ${photo.dayNumber + 1}` : 'Seul 2027')}
                    </span>
                    {photo.likes.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 tabular-nums shrink-0">
                        <Heart className="w-3 h-3 fill-current" /> {photo.likes.length}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Note di diario e luoghi scoperti */}
      {(dayDiary.length > 0 || visitedPlaces.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {dayDiary.length > 0 && (
            <section data-keep-style className="rounded-2xl bg-[#101c29] border border-white/[0.08] p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white" style={HEADING}>
                  Appunti dai giorni del viaggio
                </h3>
                <button
                  type="button"
                  onClick={() => onGoTo('itinerary')}
                  className={`min-h-11 px-2 text-xs font-semibold text-[#52d9e6] inline-flex items-center gap-0.5 ${FOCUS_RING}`}
                >
                  Itinerario <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <ul className="mt-3 divide-y divide-white/[0.08]">
                {dayDiary.map((d) => (
                  <li key={d.dayId} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-xs font-semibold text-[#52d9e6]">
                      {d.dateStr} · {d.title}
                    </p>
                    {d.note && <p className="mt-1 text-sm text-slate-200 leading-relaxed">{d.note}</p>}
                    {d.addedNames.length > 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        Aggiunte sul campo: <span className="text-slate-300">{d.addedNames.join(' · ')}</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {visitedPlaces.length > 0 && (
            <section data-keep-style className="rounded-2xl bg-[#101c29] border border-white/[0.08] p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white" style={HEADING}>
                  Luoghi scoperti e visitati
                </h3>
                <button
                  type="button"
                  onClick={() => onGoTo('places')}
                  className={`min-h-11 px-2 text-xs font-semibold text-[#52d9e6] inline-flex items-center gap-0.5 ${FOCUS_RING}`}
                >
                  Luoghi <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <ul className="mt-3 divide-y divide-white/[0.08]">
                {visitedPlaces.map((place) => (
                  <li key={place.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#52d9e6] shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">{place.name}</p>
                      {(place.note || place.address) && (
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug">{place.note || place.address}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Rilettura cronologica della Capsula del tempo */}
      <section data-keep-style className="rounded-2xl bg-[#101c29] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-slate-400">
              Verso la partenza · {unlockedCapsuleCount} {unlockedCapsuleCount === 1 ? 'risposta sbloccata' : 'risposte sbloccate'}
            </p>
            <h3 className="mt-1 text-xl font-bold text-white" style={HEADING}>
              Capsula del tempo
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onGoTo('capsula')}
            className={`min-h-11 px-2 self-start sm:self-auto inline-flex items-center gap-1 text-xs font-semibold text-[#52d9e6] ${FOCUS_RING}`}
          >
            Apri la capsula <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <ol className="mt-6 space-y-6">
          {capsuleTimeline.map((stage) => (
            <li key={stage.milestone} className="border-t border-white/[0.08] pt-5 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="text-base font-bold text-white" style={HEADING}>
                  {milestoneTitle(stage.milestone)}
                </h4>
                <span className="text-xs text-slate-400 tabular-nums">{romeDate(stage.openedAtMs)}</span>
              </div>

              {stage.state === 'upcoming' ? (
                <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 shrink-0" /> Si aprirà il {romeDate(stage.openedAtMs)} alle 18:00.
                </p>
              ) : !stage.revealed ? (
                <div data-keep-style className="mt-2.5 rounded-xl bg-[#0a1119] px-3.5 py-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-300 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-[#52d9e6] shrink-0" />
                    Traguardo aperto adesso: rispondi nella Capsula per sbloccare le risposte degli altri.
                  </span>
                  <button
                    type="button"
                    onClick={() => onGoTo('capsula')}
                    data-keep-style
                    className={`min-h-9 px-3 rounded-lg bg-[#52d9e6] text-[#04242a] text-xs font-semibold shrink-0 ${FOCUS_RING}`}
                  >
                    Rispondi
                  </button>
                </div>
              ) : stage.entries.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">Nessuna risposta salvata per questo traguardo.</p>
              ) : (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {stage.entries.map((entry) => {
                    const person = whoByUid(entry.uid);
                    const authorName = person?.name ?? 'Partecipante';
                    return (
                      <article
                        key={entry.id}
                        data-keep-style
                        className="rounded-xl bg-[#0a1119] border border-white/[0.06] p-3.5 flex gap-3"
                      >
                        {entry.thumb && (
                          <button
                            type="button"
                            onClick={() =>
                              setViewerPhoto({
                                id: entry.id,
                                thumb: entry.thumb,
                                alt: `Foto di ${authorName} (${milestoneTitle(stage.milestone)})`
                              })
                            }
                            data-keep-style
                            className={`w-20 h-20 rounded-lg overflow-hidden bg-[#152231] shrink-0 ${FOCUS_RING}`}
                            aria-label={`Ingrandisci foto di ${authorName}`}
                          >
                            <img src={entry.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {person?.avatar ? (
                              <img
                                src={person.avatar}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <span className="w-5 h-5 rounded-full bg-[#152231] text-[10px] font-semibold text-slate-200 inline-flex items-center justify-center shrink-0">
                                {initials(authorName)}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-white truncate">{authorName}</span>
                          </div>
                          {entry.text ? (
                            <p className="mt-1.5 text-sm text-slate-200 leading-relaxed break-words">{entry.text}</p>
                          ) : (
                            <p className="mt-1.5 text-xs text-slate-500">Solo foto</p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>

      {viewerPhoto && (
        <CapsulePhotoViewer
          id={viewerPhoto.id}
          thumb={viewerPhoto.thumb}
          alt={viewerPhoto.alt}
          onClose={() => setViewerPhoto(null)}
        />
      )}
    </div>
  );
};

export default TripRecapView;
