import React from 'react';
import { ArrowLeft, Footprints, LocateFixed } from 'lucide-react';
import type { MapLocation } from '../data/tripData';
import type { WalkRoute, WalkStep } from './walkRoute';
import { arrivalClock, formatMeters, formatMinutes, walkMinutes } from './geo';

/** Modalità Vai sul telefono: il riquadro in alto (meta, distanza che scende, arrivo, prossima svolta) e l'elenco delle svolte nel foglio. */
export interface WalkState {
  target: MapLocation;
  route: WalkRoute | null;
  loading: boolean;
  /** Metri ancora da fare e prossima svolta dalla posizione attuale; null senza GPS */
  remainingMeters: number | null;
  nextStep: WalkStep | null;
  offRoute: boolean;
  arrived: boolean;
  follow: boolean;
  gpsActive: boolean;
}

export const WalkTop: React.FC<{ w: WalkState; onExit: () => void; onEnableGps: () => void; onToggleFollow: () => void }> = ({ w, onExit, onEnableGps, onToggleFollow }) => {
  const meters = w.remainingMeters ?? w.route?.meters ?? null;
  const minutes = meters === null ? null : walkMinutes(meters * (w.route?.estimated ? 1.25 : 1));
  return (
    <div className="pointer-events-auto rounded-xl bg-[#152231] shadow-[0_2px_10px_rgba(0,0,0,0.35)] p-2 flex items-stretch gap-2" data-testid="walk-top">
      <button type="button" onClick={onExit} aria-label="Esci dalla navigazione" className="w-11 shrink-0 flex items-center justify-center text-[#eaf0f6] active:opacity-70">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0 py-1.5">
        <p className="text-[13px] text-[#97a5b9] truncate">
          <Footprints className="inline w-3.5 h-3.5 -mt-0.5 mr-1" aria-hidden="true" />
          A piedi fino a <span className="text-[#eaf0f6] font-medium">{w.target.italianName}</span>
        </p>
        {!w.gpsActive ? (
          <button type="button" onClick={onEnableGps} className="mt-1.5 h-10 px-3 rounded-xl bg-[#52d9e6] text-[#04242a] text-[14px] font-semibold inline-flex items-center gap-1.5 active:opacity-80" data-testid="walk-enable-gps">
            <LocateFixed className="w-4 h-4" /> Attiva la posizione per partire
          </button>
        ) : w.loading || !w.route ? (
          <p className="text-[15px] text-[#eaf0f6] mt-1">Calcolo il percorso…</p>
        ) : w.arrived ? (
          <p className="font-[Outfit] text-[24px] font-medium text-[#eaf0f6] leading-tight mt-0.5">Sei arrivato</p>
        ) : (
          <>
            <p className="flex items-baseline gap-2 flex-wrap mt-0.5">
              <span className="font-[Outfit] text-[26px] font-medium leading-none text-[#eaf0f6] tabular-nums">{formatMinutes(minutes ?? 0)}</span>
              <span className="text-[14px] text-[#97a5b9] tabular-nums">{formatMeters(meters ?? 0)} · arrivo {arrivalClock(minutes ?? 0)}</span>
            </p>
            <p className="text-[14px] text-[#eaf0f6] mt-1 truncate">
              {w.offRoute ? 'Sei fuori dal percorso: torna verso la linea' : w.nextStep ? w.nextStep.text : w.route.estimated ? 'Stima in linea d’aria, senza rete' : 'Segui la linea'}
            </p>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onToggleFollow}
        aria-pressed={w.follow}
        aria-label={w.follow ? 'La mappa ti segue' : 'Segui la mia posizione'}
        className={`w-11 shrink-0 flex items-center justify-center rounded-xl active:opacity-70 ${w.follow ? 'bg-[#52d9e6] text-[#04242a]' : 'text-[#eaf0f6]'}`}
      >
        <LocateFixed className="w-5 h-5" />
      </button>
    </div>
  );
};

export const WalkSteps: React.FC<{ w: WalkState }> = ({ w }) => {
  const r = w.route;
  if (!r) return <p className="px-5 py-4 text-[14px] text-[#97a5b9]">Il percorso arriva tra un attimo.</p>;
  if (r.estimated) {
    return (
      <div className="px-5 py-4 text-[14px] text-[#97a5b9] leading-relaxed">
        Senza rete non ho le strade: la linea sulla mappa è diretta e i minuti sono una stima. Con la rete il percorso segue le vie.
      </div>
    );
  }
  return (
    <ol className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-6" data-testid="walk-steps">
      {r.steps.map((s, i) => (
        <li key={i} className={`flex items-baseline gap-3 px-5 min-h-[52px] py-2 border-t border-[rgba(234,240,246,.11)] first:border-t-0 ${s === w.nextStep ? 'bg-[rgba(96,150,214,0.13)]' : ''}`}>
          <span className="text-[13px] text-[#97a5b9] tabular-nums w-14 shrink-0">{s.meters > 0 ? formatMeters(s.meters) : ''}</span>
          <span className="text-[15px] text-[#eaf0f6]">{s.text}</span>
        </li>
      ))}
    </ol>
  );
};
