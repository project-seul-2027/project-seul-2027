import React, { useEffect } from 'react';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import type { AccommodationOption } from '../../data/tripData';
import './mobile.css';

const PHOTO: Record<string, string> = { A: 'assets/alloggi/a.webp', B: 'assets/alloggi/b.webp', C: 'assets/alloggi/c.webp', D: 'assets/alloggi/d.webp' };
const TONE: Record<string, string> = { A: '#52d9e6', B: '#a78bfa', C: '#f472b6', D: '#fbbf24' };
const eur = (n: number) => `${Math.round(n)} €`;

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

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="border-t border-[rgba(234,240,246,.11)] py-5">
    <h3 className="font-[Outfit] text-[19px] font-medium leading-tight text-[#eaf0f6] mb-2">{title}</h3>
    {children}
  </section>
);

const Bullets: React.FC<{ items: string[] }> = ({ items }) => (
  <ul className="space-y-2">
    {items.map((t, i) => (
      <li key={i} className="flex gap-3 text-[15px] leading-snug text-[#eaf0f6]">
        <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#97a5b9]" />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

/** Pagina di un singolo alloggio (telefono): foto, prezzo, voto, mappa e le informazioni che servono per scegliere. */
export const MobileAlloggioDetail: React.FC<Props> = ({ acc, mine, voters, busy, priceEditor, onBack, onVote, onMap }) => {
  useEffect(() => { window.scrollTo?.(0, 0); }, [acc.id]);
  return (
    <div className="animate-in fade-in duration-200" data-testid="mobile-alloggio-detail">
      {/* Foto dal primo pixel dello schermo, con sfumatura verso il blu della pagina (come il video di Oggi) */}
      <section className="relative isolate overflow-hidden -mx-5 -mt-5" style={{ minHeight: 'calc(400px + env(safe-area-inset-top))' }}>
        <img src={PHOTO[acc.code]} alt={`Foto dell'alloggio ${acc.code}, ${acc.district}`} className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{ background: 'linear-gradient(to bottom, rgba(10,17,25,0.72) 0%, rgba(10,17,25,0.38) 16%, rgba(10,17,25,0.12) 32%, rgba(10,17,25,0.3) 52%, rgba(10,17,25,0.72) 74%, rgba(10,17,25,0.95) 90%, #0a1119 100%)' }}
        />
        <div className="relative flex flex-col justify-between" style={{ minHeight: 'calc(400px + env(safe-area-inset-top))', padding: 'calc(84px + env(safe-area-inset-top)) 20px 18px' }}>
          <button type="button" onClick={onBack} className="ms-link self-start" style={{ padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4, textShadow: '0 1px 10px rgba(4,10,16,.6)' }} data-testid="alloggio-back">
            <ChevronLeft className="w-5 h-5" aria-hidden /> Alloggi
          </button>
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-[Outfit] text-[40px] font-normal leading-none" style={{ color: TONE[acc.code] }}>{acc.code}</span>
              <h2 className="font-[Outfit] text-[24px] font-medium leading-tight text-[#eaf0f6]">{acc.district}</h2>
            </div>
            <p className="mt-1 text-[14px] text-[#c3cfdd]">Annuncio Enko: {acc.adTitle.replace(/'/g, '')}</p>
            <p className="mt-2 text-[15px] text-[#eaf0f6]">{acc.highlightBadge.replace(/\s*\(.*\)$/, '')}.</p>
          </div>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-3 gap-3 tabular-nums">
        {[
          { l: 'Totale 17 notti', v: acc.totalEur17Nights },
          { l: 'Pietro, 8 notti', v: acc.pietroCost8Nights },
          { l: 'Ognuno dei 3', v: acc.other3Cost17Nights }
        ].map((m) => (
          <div key={m.l}>
            <p className="font-[Outfit] text-[24px] font-medium leading-none text-[#eaf0f6]">{eur(m.v)}</p>
            <p className="mt-1 text-[13px] text-[#97a5b9]">{m.l}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[13px] text-[#97a5b9]">Circa {acc.nightlyRateEur} € a notte · canone mensile {acc.monthlyKrw.toLocaleString('it-IT')} ₩</p>
      <div className="text-[13px]">{priceEditor}</div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button type="button" onClick={onVote} disabled={busy} aria-pressed={mine} className="min-h-[48px] rounded-xl bg-[rgba(96,150,214,0.13)] text-[15px] font-semibold text-[#eaf0f6] disabled:opacity-60" data-testid="alloggio-vote">
          {mine ? 'Hai votato, ritira' : `Vota ${acc.code}`}
        </button>
        <button type="button" onClick={onMap} className="min-h-[48px] rounded-xl bg-[#52d9e6] text-[15px] font-semibold text-[#04242a]" data-testid="alloggio-map">
          Vedi sulla mappa
        </button>
        <a
          href={acc.enkoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="col-span-2 min-h-[48px] rounded-xl bg-[rgba(96,150,214,0.13)] text-[15px] font-semibold text-[#eaf0f6] flex items-center justify-center gap-2 active:opacity-70"
          data-testid="alloggio-enko"
        >
          Apri su Enko Stay <ExternalLink className="w-4 h-4 text-[#52d9e6]" aria-hidden="true" />
        </a>
      </div>
      {voters.length > 0 && (
        <p className="mt-3 text-[14px] text-[#97a5b9]">Votato da {voters.map((v) => v.name).join(', ')}.</p>
      )}

      <div className="mt-5">
        <Section title="Com'è">
          <p className="text-[15px] leading-relaxed text-[#eaf0f6]">{acc.typeDescription}</p>
        </Section>
        <Section title="Metro e stazioni">
          <p className="text-[15px] leading-relaxed text-[#eaf0f6]">{acc.metroWalk}</p>
          <p className="mt-2 text-[14px] text-[#97a5b9]">Verso Hongdae: {acc.hongdaeTransit}</p>
        </Section>
        <Section title="Dall'aeroporto">
          <p className="text-[15px] leading-relaxed text-[#eaf0f6]">{acc.airportTransit}</p>
        </Section>
        <Section title="Nei dintorni">
          <p className="text-[15px] leading-relaxed text-[#eaf0f6]">{acc.nearbyAttractions}</p>
        </Section>
        <Section title="Vantaggi"><Bullets items={acc.pro} /></Section>
        <Section title="Da tenere d'occhio"><Bullets items={acc.contro} /></Section>
        <Section title="In sintesi">
          <p className="text-[15px] leading-relaxed text-[#eaf0f6]">{acc.importantNotes}</p>
        </Section>
      </div>
    </div>
  );
};
