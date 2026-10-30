import React, { useMemo } from 'react';
import { Footprints, Gauge, Shuffle } from 'lucide-react';
import { computeMetroRoute, type MetroRouteResult, type RoutePreference } from '../../data/metroRouter';
import type { MetroNetwork } from '../../data/seoulMetro';
import type { MapLocation } from '../../data/tripData';
import { setRoutePreference, useRoutePreference } from '../../data/routePreference';

const OPTIONS: { id: RoutePreference; label: string; icon: React.ElementType }[] = [
  { id: 'fast', label: 'Più veloce', icon: Gauge },
  { id: 'fewTransfers', label: 'Meno cambi', icon: Shuffle },
  { id: 'lessWalking', label: 'Meno cammino', icon: Footprints }
];

const signature = (r: MetroRouteResult) =>
  `${r.reachable}|${r.segments.map((s) => `${s.line.id}:${s.fromStationKey}:${s.toStationKey}`).join('>')}|${r.totalTransfers}|${r.totalWalkMeters}|${r.estimatedTotalMinutes}`;

/** Tre alternative di percorso: più veloce, meno cambi, meno camminata. I tempi sono stime dell'app. */
export const RouteAlternatives: React.FC<{
  network: MetroNetwork | null;
  origin: MapLocation;
  destination: MapLocation | undefined;
  excludeLineIds?: readonly string[];
}> = ({ network, origin, destination, excludeLineIds }) => {
  const pref = useRoutePreference();
  const results = useMemo(() => {
    if (!network || !destination) return null;
    return OPTIONS.map((o) => ({ ...o, route: computeMetroRoute(network, origin, destination, { excludeLineIds, preference: o.id }) }));
  }, [network, origin, destination, excludeLineIds]);

  if (!results || !results[0].route.reachable) return null;
  // Se le tre proposte coincidono non serve scegliere
  const same = new Set(results.map((r) => signature(r.route))).size === 1;

  return (
    <div className="space-y-1.5" data-testid="route-alternatives">
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Tipo di percorso">
        {results.map((r) => {
          const Icon = r.icon;
          const on = pref === r.id;
          const rt = r.route;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoutePreference(r.id)}
              aria-pressed={on}
              className={`rounded-xl border px-1.5 py-2 text-center ${on ? 'border-cyan-400 bg-cyan-500/15 text-white' : 'border-slate-800 bg-slate-950 text-slate-300'}`}
              data-testid={`route-pref-${r.id}`}
            >
              <span className="flex items-center justify-center gap-1 text-[10.5px] font-bold"><Icon className="w-3 h-3" /> {r.label}</span>
              <span className="block text-sm font-mono font-bold tabular-nums mt-0.5">{rt.estimatedTotalMinutes} min</span>
              <span className="block text-[10px] text-slate-400 leading-tight">
                {rt.totalTransfers === 0 ? 'diretto' : `${rt.totalTransfers} ${rt.totalTransfers === 1 ? 'cambio' : 'cambi'}`} · {rt.totalWalkMeters} m a piedi
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10.5px] text-slate-500 leading-snug">
        {same ? 'Qui le tre scelte coincidono. ' : ''}Tempi calcolati dall’app (circa 2 minuti a fermata, 4 a ogni cambio, 75 m al minuto a piedi): non sono gli orari reali dei treni.
      </p>
    </div>
  );
};

export default RouteAlternatives;
