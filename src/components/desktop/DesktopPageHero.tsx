import type { ReactNode } from 'react';
import HeroVideo, { HeroVideoToggle } from '../HeroVideo';

const MONO = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' } as const;
/** Un solo colore d'accento per tutte le pagine desktop. */
const ACCENT = '#22D3EE';
const DISP = { fontFamily: "'Outfit', sans-serif", fontWeight: 800, letterSpacing: '-.03em' } as const;

/** Etichetta mono, titolo e colore della famiglia di ogni pagina (dai mockup desktop). */
export const PAGE_HERO: Record<string, { label: string; title: string; color: string }> = {
  itinerary: { label: 'Viaggio · programma giorno per giorno', title: 'Itinerario', color: ACCENT },
  accommodations: { label: 'Viaggio · dove dormiamo', title: 'Alloggi', color: ACCENT },
  flights: { label: 'Viaggio · voli e scalo', title: 'Voli e scalo', color: ACCENT },
  map: { label: 'Viaggio · punti sulla mappa', title: 'Mappa', color: ACCENT },
  weather: { label: 'Viaggio · previsioni', title: 'Meteo', color: ACCENT },
  group: { label: 'Gruppo adesso · in condivisione', title: 'Dove siamo', color: ACCENT },
  expenses: { label: 'Gruppo · conti', title: 'Spese', color: ACCENT },
  gallery: { label: 'Gruppo · foto e video', title: 'Galleria', color: ACCENT },
  places: { label: 'Gruppo · posti preferiti', title: 'Luoghi', color: ACCENT },
  wallet: { label: 'Wallet · sempre pronti, anche offline', title: 'Biglietti', color: ACCENT },
  sos: { label: 'Strumenti · emergenze', title: 'SOS', color: ACCENT },
  show: { label: 'Strumenti · frasi utili', title: 'In coreano', color: ACCENT },
  guide: { label: 'Strumenti · consigli pratici', title: 'Guida', color: ACCENT },
  pdf: { label: 'Strumenti · documenti scaricabili', title: 'PDF', color: ACCENT },
  packing: { label: 'Preparazione · lista', title: 'Valigia', color: ACCENT },
  budget: { label: 'Preparazione · costi del viaggio', title: 'Preventivo', color: ACCENT },
  changelog: { label: 'Preparazione · cosa è cambiato', title: 'Novità', color: ACCENT },
};

interface DesktopPageHeroProps {
  tab: string;
  heroEnabled: boolean;
  onToggleHero: () => void;
  /** Pulsanti a destra del titolo (opzionale) */
  actions?: ReactNode;
}

/** Fascia video di tutte le pagine desktop: stessa sfumatura e stessa posizione del titolo di "Oggi". */
export function DesktopPageHero({ tab, heroEnabled, onToggleHero, actions }: DesktopPageHeroProps) {
  const meta = PAGE_HERO[tab];
  if (!meta) return null;
  return (
    <section className="relative isolate overflow-hidden bg-[#080D18]" style={{ height: 176 }} data-testid="desktop-page-hero">
      <HeroVideo enabled={heroEnabled} overlay={false} className="-z-10" />
      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,#080D18 0%,rgba(8,13,24,.35) 55%,rgba(8,13,24,.2) 100%)' }}
      />
      <HeroVideoToggle enabled={heroEnabled} onToggle={onToggleHero} />
      <div style={{ position: 'absolute', left: 40, right: 40, bottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ ...MONO, margin: 0, color: meta.color, textShadow: '0 1px 10px rgba(8,13,24,.9)' }}>{meta.label}</p>
          <h1 style={{ ...DISP, margin: '8px 0 0', fontSize: 44, lineHeight: 1, color: '#F7F9FC', textShadow: '0 2px 16px rgba(8,13,24,.7)' }}>{meta.title}</h1>
        </div>
        {actions}
      </div>
    </section>
  );
}
