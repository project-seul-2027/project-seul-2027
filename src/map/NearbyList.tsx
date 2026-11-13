import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed, Users } from 'lucide-react';
import type { MapLocation } from '../data/tripData';
import { categoryIconSvg } from '../components/map/categoryIcons';
import { CATEGORY_LABEL, mobileCategoryColor } from '../components/map/categoryStyle';
import { formatMeters, formatMinutes, walkMinutes } from './geo';
import type { LatLng } from '../data/seoulMetro';
import { searchNearbyNeeds, type NearbyNeed } from './mapSearchService';
import { resultToLocation } from './MapSearch';
import type { RemoteMapSearchHit } from '../shared/mapSearch';

const NEEDS: { id: NearbyNeed; label: string }[] = [
  { id: 'toilet', label: 'Bagno' },
  { id: 'pharmacy', label: 'Farmacia' },
  { id: 'convenience', label: 'Minimarket' },
  { id: 'atm', label: 'Bancomat' },
  { id: 'cafe', label: 'Caffè' }
];

type NeedState = { need: NearbyNeed; loading: boolean; hits: RemoteMapSearchHit[]; message: string | null };

/** Scheda "Vicino a me" del foglio: cosa abbiamo intorno in ordine di distanza, e chi del gruppo è vicino. */
export interface NearbyEntry {
  loc: MapLocation;
  meters: number;
  /** Luogo salvato dal gruppo (viola) o tappa */
  saved: boolean;
}

export interface NearbyFriend {
  name: string;
  color: string;
  meters: number;
  ago: string;
  lost: boolean;
}

interface Props {
  gpsActive: boolean;
  onLocate: () => void;
  entries: NearbyEntry[];
  friends: NearbyFriend[];
  onPick: (loc: MapLocation) => void;
  /** Posizione attuale, per cercare bagni, farmacie e simili intorno */
  here?: LatLng | null;
}

const row = 'w-full flex items-center gap-3 px-5 min-h-[60px] text-left border-t border-[rgba(234,240,246,.11)] first:border-t-0 active:bg-[rgba(234,240,246,.05)]';

export const NearbyList: React.FC<Props> = ({ gpsActive, onLocate, entries, friends, onPick, here = null }) => {
  const [needState, setNeedState] = useState<NeedState | null>(null);
  const runRef = useRef(0);
  useEffect(() => () => { runRef.current += 1; }, []);

  const pickNeed = async (need: NearbyNeed) => {
    if (needState?.need === need) {
      runRef.current += 1;
      setNeedState(null);
      return;
    }
    if (!here) return;
    const run = ++runRef.current;
    setNeedState({ need, loading: true, hits: [], message: null });
    try {
      const res = await searchNearbyNeeds(need, here[0], here[1]);
      if (run !== runRef.current) return;
      const message = res.providerConfigured === false
        ? 'La ricerca per bisogni non è ancora attiva: manca la chiave Kakao nel servizio.'
        : res.providerErrors?.length
          ? 'Il servizio di ricerca non risponde adesso. Riprova tra poco.'
          : res.hits.length === 0 ? 'Niente entro 800 m da qui.' : null;
      setNeedState({ need, loading: false, hits: res.hits, message });
    } catch {
      if (run === runRef.current) setNeedState({ need, loading: false, hits: [], message: 'Ricerca non disponibile adesso: serve internet e l’accesso.' });
    }
  };

  if (!gpsActive) {
    return (
      <div className="px-5 py-8 text-center space-y-4">
        <p className="text-[15px] text-[#97a5b9] leading-relaxed">Con la posizione attiva vedi qui tappe, luoghi salvati e amici in ordine di distanza, con i minuti a piedi.</p>
        <button type="button" onClick={onLocate} className="h-11 px-4 rounded-xl bg-[#52d9e6] text-[#04242a] text-[15px] font-semibold inline-flex items-center gap-1.5 active:opacity-80" data-testid="nearby-locate">
          <LocateFixed className="w-4 h-4" /> Attiva la posizione
        </button>
      </div>
    );
  }
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-6" data-testid="nearby-list">
      <div data-no-drag className="flex gap-2 overflow-x-auto scrollbar-none px-5 pt-3 pb-1 touch-pan-x" role="group" aria-label="Cerca vicino a te">
        {NEEDS.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => void pickNeed(n.id)}
            aria-pressed={needState?.need === n.id}
            data-testid={`need-${n.id}`}
            className={`h-11 px-4 rounded-xl text-[15px] whitespace-nowrap shrink-0 active:opacity-80 ${needState?.need === n.id ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-[rgba(96,150,214,0.13)] text-[#eaf0f6] font-medium'}`}
          >
            {n.label}
          </button>
        ))}
      </div>
      {needState ? (
        <div data-testid="need-results">
          {needState.loading && <p className="px-5 py-4 text-[14px] text-[#97a5b9]">Cerco intorno a te…</p>}
          {needState.message && <p className="px-5 py-4 text-[14px] text-[#fbbf24] leading-snug" role="status">{needState.message}</p>}
          {needState.hits.map((hit) => (
            <button key={hit.id} type="button" className={row} onClick={() => onPick(resultToLocation(hit))}>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-[#eaf0f6] truncate">{hit.title}</span>
                <span className="block text-[13px] text-[#97a5b9] truncate">{hit.address}</span>
              </span>
              {typeof hit.distance === 'number' && (
                <span className="text-right shrink-0">
                  <span className="block text-[15px] text-[#eaf0f6] tabular-nums">{formatMinutes(walkMinutes(hit.distance * 1.25))}</span>
                  <span className="block text-[12px] text-[#97a5b9] tabular-nums">{formatMeters(hit.distance)} a piedi</span>
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
      <>
      {friends.length > 0 && (
        <>
          <p className="px-5 pt-3 pb-1 text-[13px] text-[#97a5b9] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Gruppo
          </p>
          {friends.map((f) => (
            <div key={f.name} className={row}>
              <span aria-hidden="true" className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[12px] font-bold text-white" style={{ background: f.lost ? '#e11d48' : f.color }}>
                {f.lost ? '!' : f.name.slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] text-[#eaf0f6] truncate">{f.name}{f.lost ? ' · ha perso il gruppo' : ''}</span>
                <span className="block text-[13px] text-[#97a5b9]">{f.ago}</span>
              </span>
              <span className="text-[13px] text-[#97a5b9] tabular-nums shrink-0">{formatMeters(f.meters)}</span>
            </div>
          ))}
        </>
      )}
      {entries.map(({ loc, meters, saved }) => (
        <button key={loc.id} type="button" className={row} onClick={() => onPick(loc)}>
          <span
            aria-hidden="true"
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
            style={{ background: '#0d1824', boxShadow: `inset 0 0 0 2px ${saved ? '#7c3aed' : mobileCategoryColor(loc.category)}` }}
            dangerouslySetInnerHTML={{ __html: categoryIconSvg(loc.category, 16) }}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] text-[#eaf0f6] truncate">{loc.italianName}</span>
            <span className="block text-[13px] text-[#97a5b9] truncate">
              {saved ? 'Luogo salvato' : CATEGORY_LABEL[loc.category] ?? loc.category} · {loc.district}
            </span>
          </span>
          <span className="text-right shrink-0">
            <span className="block text-[15px] text-[#eaf0f6] tabular-nums">{formatMinutes(walkMinutes(meters * 1.25))}</span>
            <span className="block text-[12px] text-[#97a5b9] tabular-nums">{formatMeters(meters)} a piedi</span>
          </span>
        </button>
      ))}
      {entries.length === 0 && <p className="px-5 py-6 text-[14px] text-[#97a5b9]">Niente di nostro entro qualche chilometro da qui.</p>}
      </>
      )}
    </div>
  );
};
