import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ExternalLink } from 'lucide-react';
import { formatAccommodationEur, type AccommodationOption } from '../../data/tripData';
import './mobile.css';

const PHOTO: Record<string, string> = {
  A: 'assets/alloggi/a.webp',
  B: 'assets/alloggi/b.webp',
  C: 'assets/alloggi/c.webp',
  D: 'assets/alloggi/d.webp'
};
const TONE: Record<string, string> = {
  A: '#52d9e6',
  B: '#a78bfa',
  C: '#f472b6',
  D: '#fbbf24'
};

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';
const HEADING_FONT: React.CSSProperties = { fontFamily: "'Outfit', system-ui, sans-serif" };
const eur = formatAccommodationEur;

interface Props {
  acc: AccommodationOption;
  mine: boolean;
  voters: { name: string; color: string }[];
  busy: boolean;
  priceEditor: React.ReactNode;
  onBack: () => void;
  onVote: () => void;
  onMap: () => void;
}

export const MobileAlloggioDetail: React.FC<Props> = ({
  acc,
  mine,
  voters,
  busy,
  priceEditor,
  onBack,
  onVote,
  onMap
}) => {
  const [transitOpen, setTransitOpen] = useState(false);

  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [acc.id]);

  return (
    <div className="pb-8 selection:bg-[#52d9e6]/25 selection:text-white" data-testid="mobile-alloggio-detail">
      {/* Foto dal primo pixel dello schermo con sfumatura verso #0a1119 */}
      <section
        className="relative isolate overflow-hidden -mx-5 -mt-5"
        style={{ minHeight: 'calc(360px + env(safe-area-inset-top))' }}
      >
        <img
          src={PHOTO[acc.code]}
          alt={`Foto dell'alloggio ${acc.code}, ${acc.district}`}
          className="alloggi-detail-hero absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(to bottom, rgba(10,17,25,0.72) 0%, rgba(10,17,25,0.34) 20%, rgba(10,17,25,0.14) 38%, rgba(10,17,25,0.58) 70%, rgba(10,17,25,0.95) 90%, #0a1119 100%)'
          }}
        />
        <div
          className="relative flex flex-col justify-between"
          style={{
            minHeight: 'calc(360px + env(safe-area-inset-top))',
            padding: 'calc(80px + env(safe-area-inset-top)) 20px 16px'
          }}
        >
          <button
            type="button"
            onClick={onBack}
            className={`alloggi-tap ms-link self-start ${FOCUS_RING}`}
            style={{
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              textShadow: '0 1px 10px rgba(4,10,16,.65)'
            }}
            data-testid="alloggio-back"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" /> Alloggi
          </button>

          <div className="alloggi-detail-body">
            <div className="flex items-baseline gap-3">
              <span
                className="text-[40px] font-normal leading-none tabular-nums"
                style={{ ...HEADING_FONT, color: TONE[acc.code] ?? '#52d9e6' }}
              >
                {acc.code}
              </span>
              <h2 className="text-[24px] font-medium leading-tight text-[#eaf0f6]" style={HEADING_FONT}>
                {acc.district}
              </h2>
            </div>
            <p className="mt-1.5 text-[14px] text-[#c3cfdd]">
              {acc.highlightBadge.replace(/\s*\(.*\)$/, '')} · {acc.adTitle.replace(/'/g, '')}
            </p>
          </div>
        </div>
      </section>

      <div className="alloggi-detail-body">
      {/* Quote chiave in primo piano (scala fissa, tabular-nums) */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-b border-[rgba(234,240,246,0.11)] pb-4 tabular-nums">
        <div className="min-w-0">
          <p className="text-[22px] font-medium leading-none text-[#eaf0f6] whitespace-nowrap" style={HEADING_FONT}>
            {eur(acc.other3Cost17Nights)}
          </p>
          <p className="mt-1.5 text-[12.5px] text-[#97a5b9]">Ognuno dei 3 (17n)</p>
        </div>
        <div className="min-w-0">
          <p className="text-[22px] font-medium leading-none text-[#eaf0f6] whitespace-nowrap" style={HEADING_FONT}>
            {eur(acc.pietroCost8Nights)}
          </p>
          <p className="mt-1.5 text-[12.5px] text-[#97a5b9]">Pietro (8n)</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[22px] font-medium leading-none text-[#eaf0f6] whitespace-nowrap" style={HEADING_FONT}>
            {eur(acc.totalEur17Nights)}
          </p>
          <p className="mt-1.5 text-[12.5px] text-[#97a5b9]">Totale ({eur(acc.nightlyRateEur)}/n)</p>
        </div>
      </div>

      {priceEditor && <div className="pt-2.5 text-[13px]">{priceEditor}</div>}

      {/* Azioni primarie */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button
          key={`vote-${mine ? 'on' : 'off'}`}
          type="button"
          onClick={onVote}
          disabled={busy}
          aria-pressed={mine}
          style={{
            borderRadius: 12,
            background: mine ? '#52d9e6' : 'var(--ms-fill)'
          }}
          className={`alloggi-tap${mine ? ' alloggi-vote-pop' : ''} min-h-12 px-4 text-[15px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60 ${FOCUS_RING} ${
            mine ? 'text-[#04242a]' : 'text-[#eaf0f6]'
          }`}
          data-testid="alloggio-vote"
        >
          {mine && <Check className="w-4 h-4" strokeWidth={2.8} />}
          {mine ? `Votato ${acc.code}` : `Vota ${acc.code}`}
        </button>

        <button
          type="button"
          onClick={onMap}
          style={{
            borderRadius: 12,
            background: mine ? 'var(--ms-fill)' : '#52d9e6'
          }}
          className={`alloggi-tap min-h-12 px-4 text-[15px] font-semibold ${FOCUS_RING} ${
            mine ? 'text-[#eaf0f6]' : 'text-[#04242a]'
          }`}
          data-testid="alloggio-map"
        >
          Vedi sulla mappa
        </button>

        <a
          href={acc.enkoUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ borderRadius: 12, background: 'var(--ms-fill)' }}
          className={`alloggi-tap col-span-2 min-h-12 px-4 text-[14.5px] font-semibold text-[#eaf0f6] flex items-center justify-center gap-2 ${FOCUS_RING}`}
          data-testid="alloggio-enko"
        >
          Apri annuncio su Enko Stay <ExternalLink className="w-4 h-4 text-[#52d9e6]" aria-hidden="true" />
        </a>
      </div>

      {voters.length > 0 && (
        <p className="mt-3 flex items-center gap-2 text-[13.5px] text-[#97a5b9]">
          <span className="flex items-center -space-x-1 shrink-0">
            {voters.map((v) => (
              <span
                key={v.name}
                style={{ backgroundColor: v.color, borderRadius: 999 }}
                className="w-2.5 h-2.5 ring-2 ring-[#0a1119]"
                aria-hidden="true"
              />
            ))}
          </span>
          <span>Votato da {voters.map((v) => v.name).join(', ')}</span>
        </p>
      )}

      {/* Scheda rapida in 3 righe */}
      <section className="mt-6 border-t border-[rgba(234,240,246,0.11)] divide-y divide-[rgba(234,240,246,0.11)]">
        <div className="py-3.5 grid grid-cols-[88px_1fr] gap-3 text-[14.5px]">
          <span className="text-[#97a5b9]">Spazi</span>
          <span className="text-[#eaf0f6] leading-snug">{acc.typeDescription}</span>
        </div>
        <div className="py-3.5 grid grid-cols-[88px_1fr] gap-3 text-[14.5px]">
          <span className="text-[#97a5b9]">Hongdae</span>
          <span className="text-[#eaf0f6] leading-snug">{acc.hongdaeTransit}</span>
        </div>
        <div className="py-3.5 grid grid-cols-[88px_1fr] gap-3 text-[14.5px]">
          <span className="text-[#97a5b9]">Verdetto</span>
          <span className="text-[#eaf0f6] leading-snug">{acc.importantNotes}</span>
        </div>
      </section>

      {/* Pro e contro immediati */}
      <section className="border-t border-[rgba(234,240,246,0.11)] py-5 space-y-5">
        <div className="space-y-2.5">
          <h3 className="text-[17px] font-medium text-[#eaf0f6]" style={HEADING_FONT}>
            Punti a favore
          </h3>
          <ul className="space-y-2">
            {acc.pro.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-[#eaf0f6]">
                <span className="text-[#52d9e6] font-semibold shrink-0 w-3" aria-hidden="true">+</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2.5 pt-2">
          <h3 className="text-[17px] font-medium text-[#eaf0f6]" style={HEADING_FONT}>
            Da mettere in conto
          </h3>
          <ul className="space-y-2">
            {acc.contro.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-[#c3cfdd]">
                <span className="text-[#f472b6] font-semibold shrink-0 w-3" aria-hidden="true">−</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Dettagli secondari (metro, aeroporto, dintorni, canone KRW) a comparsa */}
      <section className="border-t border-b border-[rgba(234,240,246,0.11)]">
        <button
          type="button"
          onClick={() => setTransitOpen((v) => !v)}
          aria-expanded={transitOpen}
          className={`w-full min-h-[56px] py-3 flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}
        >
          <div>
            <span className="block text-[16.5px] font-medium text-[#eaf0f6]" style={HEADING_FONT}>
              Metro, aeroporto e zona
            </span>
            <span className="block text-[13px] text-[#97a5b9]">Stazioni a piedi, collegamento Incheon e dintorni</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-[#97a5b9] shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
              transitOpen ? 'rotate-180 text-[#52d9e6]' : ''
            }`}
          />
        </button>

        <div
          className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
            transitOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <div className="pb-4 space-y-3 text-[14px] leading-relaxed text-[#c3cfdd]">
              <div>
                <span className="block text-[12.5px] font-semibold text-[#eaf0f6]">Stazioni a piedi</span>
                <p>{acc.metroWalk}</p>
              </div>
              <div>
                <span className="block text-[12.5px] font-semibold text-[#eaf0f6]">Da e per Incheon</span>
                <p>{acc.airportTransit}</p>
              </div>
              <div>
                <span className="block text-[12.5px] font-semibold text-[#eaf0f6]">Nei dintorni</span>
                <p>{acc.nearbyAttractions}</p>
              </div>
              <p className="text-[12.5px] text-[#97a5b9] tabular-nums pt-1">
                Canone mensile sull’annuncio: {acc.monthlyKrw.toLocaleString('it-IT')} ₩
              </p>
            </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
};

export default MobileAlloggioDetail;
