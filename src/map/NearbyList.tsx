import React from 'react';
import { LocateFixed, Users } from 'lucide-react';
import type { MapLocation } from '../data/tripData';
import { categoryIconSvg } from '../components/map/categoryIcons';
import { CATEGORY_LABEL, mobileCategoryColor } from '../components/map/categoryStyle';
import { formatMeters, formatMinutes, walkMinutes } from './geo';

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
}

const row = 'w-full flex items-center gap-3 px-5 min-h-[60px] text-left border-t border-[rgba(234,240,246,.11)] first:border-t-0 active:bg-[rgba(234,240,246,.05)]';

export const NearbyList: React.FC<Props> = ({ gpsActive, onLocate, entries, friends, onPick }) => {
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
    </div>
  );
};
