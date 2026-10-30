import React, { useEffect, useMemo, useState } from 'react';
import { Car, Clock, Info, Ticket } from 'lucide-react';
import type { MetroRouteResult } from '../../data/metroRouter';
import { FALLBACK_RATES } from '../../services/currencyService';
import { nowOrSim, presentSlots, seoulDateIso } from '../../shared/tripPresence';
import { FARE_SOURCES, formatKrw, routeDeadline, routeFare, taxiEstimate } from '../../utils/routeCost';
import { formatCountdown } from '../../utils/tripClock';

const eur = (krw: number) =>
  (krw / FALLBACK_RATES.KRW).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: krw / FALLBACK_RATES.KRW < 10 ? 2 : 0 });

/** Sotto il percorso: quanto costa (a testa e per il gruppo), entro quando partire e il taxi se si perde la metro. */
export const RouteCostCard: React.FC<{ route: MetroRouteResult }> = ({ route }) => {
  const [now, setNow] = useState(nowOrSim);
  const [showInfo, setShowInfo] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowOrSim()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const fare = useMemo(() => routeFare(route), [route]);
  const deadline = useMemo(() => routeDeadline(route, now), [route, now]);
  const people = presentSlots(seoulDateIso(now)).length;
  if (!fare) return null;

  const left = deadline?.minutesLeft ?? Infinity;
  // Il taxi si mostra quando l'ultima metro è vicina o persa, con la tariffa di quell'ora
  const showTaxi = left < 90;
  const kst = new Date(now + 9 * 3_600_000);
  const taxi = taxiEstimate(route, kst.getUTCHours() * 60 + kst.getUTCMinutes());
  const tone =
    left < 0 ? 'border-rose-500/50 bg-rose-500/10 text-rose-100' : left < 30 ? 'border-amber-500/50 bg-amber-500/10 text-amber-100' : 'border-slate-800 bg-slate-950 text-slate-200';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 space-y-2" data-testid="route-cost">
      <div className="flex items-start gap-2.5">
        <Ticket className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] text-slate-400">Biglietto a testa {fare.exact ? '' : '(stima)'}</span>
            <span className="font-mono font-bold text-white text-sm tabular-nums" data-testid="route-fare">
              {formatKrw(fare.perPerson)} <span className="text-slate-500 font-normal text-[11px]">≈ {eur(fare.perPerson)}</span>
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-slate-500">In {people}, {fare.km.toLocaleString('it-IT', { maximumFractionDigits: 1 })} km</span>
            <span className="font-mono text-slate-300 tabular-nums">{formatKrw(fare.perPerson * people)} ≈ {eur(fare.perPerson * people)}</span>
          </div>
          {fare.climateCardOk && <p className="mt-0.5 text-[10.5px] text-emerald-300">Con la Climate Card è già pagato.</p>}
          {fare.notes.map((n) => (
            <p key={n} className="mt-0.5 text-[10.5px] text-slate-400 leading-snug">{n}</p>
          ))}
        </div>
      </div>

      {deadline && (
        <div className={`flex items-start gap-2.5 rounded-lg border px-2.5 py-2 ${tone}`} data-testid="route-deadline">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 text-[11px] leading-snug">
            {left < 0 ? (
              <span><strong>Ultima metro probabilmente persa</strong> (bisognava partire entro le {deadline.label}).</span>
            ) : (
              <span>
                Per prendere l’ultima corsa parti entro le <strong className="font-mono">{deadline.label}</strong>
                {left < 24 * 60 && <> · tra {formatCountdown(left * 60_000)}</>}
              </span>
            )}
            <span className="block text-[10.5px] opacity-70">
              Stima prudente ({deadline.weekend ? 'orari festivi' : 'orari feriali'}, linea {deadline.lineName}): controlla l’orario esatto della tua stazione su Naver Map.
            </span>
          </div>
        </div>
      )}

      {showTaxi && (
        <div className="flex items-start gap-2.5" data-testid="route-taxi">
          <Car className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1 text-[11px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-slate-400">Taxi {taxi.nightPct ? `(notte +${taxi.nightPct}%)` : ''}</span>
              <span className="font-mono text-white font-bold tabular-nums">
                {taxi.low.toLocaleString('it-IT')}–{formatKrw(taxi.high)}
              </span>
            </div>
            <p className="text-slate-500">
              ≈ {formatKrw(Math.round(taxi.high / Math.max(1, Math.min(4, people)) / 100) * 100)} a testa in {Math.min(4, people)} · stima su ~
              {taxi.roadKm.toLocaleString('it-IT', { maximumFractionDigits: 0 })} km di strada, senza traffico
            </p>
          </div>
        </div>
      )}

      <button type="button" onClick={() => setShowInfo((v) => !v)} className="text-[10.5px] text-slate-500 hover:text-slate-300 flex items-center gap-1">
        <Info className="w-3 h-3" /> Da dove vengono le cifre
      </button>
      {showInfo && (
        <div className="text-[10.5px] text-slate-400 leading-snug space-y-1">
          <p>Metro: 1.550 ₩ fino a 10 km, +100 ₩ ogni 5 km (oltre 50 km +100 ₩ ogni 8 km), con carta T-money. La distanza è misurata sui binari della mappa, quindi può differire di qualche centinaio di won.</p>
          <p>Taxi normale: 4.800 ₩ fino a 1,6 km, +100 ₩ ogni 131 m, +20% / +40% di notte. Il traffico aumenta il prezzo.</p>
          <ul className="space-y-0.5">
            {FARE_SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline text-cyan-300/80">{s.label}</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default RouteCostCard;
