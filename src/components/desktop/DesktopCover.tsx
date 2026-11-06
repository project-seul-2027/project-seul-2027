import { useEffect, useState } from 'react';
import { BrandIcon } from '../BrandIcon';
import HeroVideo from '../HeroVideo';

/** Schede d'ingresso della copertina: ciascuna apre una sezione dell'app. */
export type CoverTarget = 'today' | 'itinerary' | 'group' | 'wallet';

/** Formato di progetto del mockup "Copertina": 1440 × 900, scalato per riempire lo schermo. */
const FRAME_W = 1440;
const FRAME_H = 900;
const frameScale = () => Math.min(window.innerWidth / FRAME_W, window.innerHeight / FRAME_H);

const MONO = { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, letterSpacing: '.06em', color: '#94A3B8' } as const;
const DISP = { fontFamily: "'Outfit', sans-serif", fontWeight: 800, letterSpacing: '-.035em' } as const;
const BTN = {
  minHeight: 48, padding: '0 22px', borderRadius: 14, background: '#00C5E8', color: '#04202A', border: 0,
  fontWeight: 700, fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer',
} as const;
const GHOST = {
  minHeight: 48, padding: '0 20px', borderRadius: 14, background: 'transparent', color: '#F7F9FC',
  border: '1px solid rgba(247,249,252,.28)', fontWeight: 600, fontSize: 15, display: 'inline-flex',
  alignItems: 'center', gap: 10, cursor: 'pointer',
} as const;

const NAV: [CoverTarget, string][] = [['today', 'Oggi'], ['itinerary', 'Itinerario'], ['group', 'Gruppo'], ['wallet', 'Wallet']];

interface DesktopCoverProps {
  heroEnabled: boolean;
  onGoTo: (tab: CoverTarget) => void;
}

/** Copertina desktop (da 1024 px): video a schermo intero, velo di lettura e quattro porte. */
export function DesktopCover({ heroEnabled, onGoTo }: DesktopCoverProps) {
  const [scale, setScale] = useState(frameScale);
  useEffect(() => {
    const onResize = () => setScale(frameScale());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const link = { background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' } as const;

  return (
    <section data-testid="desktop-cover" className="fixed inset-0 z-[60] overflow-hidden bg-[#080D18]">
      {/* Il video del sito, a schermo intero */}
      <HeroVideo enabled={heroEnabled} overlay={false} className="-z-10" />
      {/* Velo di lettura: scurisce il fondo in basso e a sinistra, dove sta il testo */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg,rgba(8,13,24,.92) 0%,rgba(8,13,24,.55) 45%,rgba(8,13,24,.1) 100%),linear-gradient(0deg,rgba(8,13,24,.95) 0%,rgba(8,13,24,0) 40%)',
        }}
      />

      {/* Composizione del mockup, in proporzione 1440 × 900 */}
      <div
        style={{
          position: 'absolute', left: '50%', top: '50%', width: FRAME_W, height: FRAME_H,
          transform: `translate(-50%, -50%) scale(${scale})`, color: '#F7F9FC',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        <header style={{ position: 'absolute', left: 72, right: 72, top: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <BrandIcon className="w-9 h-9" />
            <span style={{ ...DISP, fontSize: 18 }}>Seul 2027</span>
          </div>
          <nav aria-label="Principale" style={{ display: 'flex', gap: 28, fontSize: 15, color: '#CBD5E1' }}>
            {NAV.map(([t, label]) => (
              <button key={t} type="button" style={link} onClick={() => onGoTo(t)}>{label}</button>
            ))}
          </nav>
          <button type="button" style={{ ...BTN, minHeight: 42, padding: '0 18px', fontSize: 14 }} onClick={() => onGoTo('today')}>
            Apri l'app
          </button>
        </header>

        <section style={{ position: 'absolute', left: 72, top: 250, width: 760 }}>
          <p style={{ ...MONO, margin: 0, color: '#00C5E8', letterSpacing: '.14em' }}>1–20 MARZO 2027 · ITALIA → CINA → SEUL</p>
          <h1 style={{ ...DISP, margin: '22px 0 0', fontSize: 132, lineHeight: 0.9 }}>
            Seul,<span style={{ display: 'block', marginTop: 40 }}>안녕하세요.</span>
          </h1>
          <p style={{ margin: '28px 0 0', maxWidth: 560, fontSize: 20, lineHeight: 1.5, color: '#CBD5E1' }}>
            Voli, treni, alloggi, spese e il punto d'incontro in un solo posto. Il gruppo è sempre a portata di mano, anche senza rete.
          </p>
          <div style={{ display: 'flex', gap: 14, marginTop: 40 }}>
            <button type="button" style={BTN} onClick={() => onGoTo('today')}>Entra nel viaggio →</button>
            <button type="button" style={GHOST} onClick={() => onGoTo('itinerary')}>Vedi l'itinerario</button>
          </div>
        </section>


        <p aria-hidden="true" style={{ ...MONO, position: 'absolute', right: 72, top: 118, fontSize: 11, margin: 0 }}>
          37.5665° N · 126.9780° E
        </p>
      </div>
    </section>
  );
}
