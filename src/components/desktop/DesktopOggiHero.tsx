import { useEffect, useState, type ReactNode } from 'react';
import HeroVideo, { HeroVideoToggle } from '../HeroVideo';
import { launchState, splitDuration } from '../../utils/launchClock';

export interface ProgramRow {
  time: string;
  title: string;
  sub: string;
}

/** Ora corrente: quella simulata con ?sim=, altrimenti l'orologio reale aggiornato ogni secondo. */
function useClock(simNow: number | null) {
  const [real, setReal] = useState(() => Date.now());
  useEffect(() => {
    if (simNow !== null) return;
    const id = window.setInterval(() => setReal(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [simNow]);
  return simNow ?? real;
}

const MONO = { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '.08em', color: '#94A3B8', textTransform: 'uppercase' } as const;
const DISP = { fontFamily: "'Outfit', sans-serif", fontWeight: 800, letterSpacing: '-.03em' } as const;
const RULE = '1px solid #1E2B40';

interface DesktopOggiHeroProps {
  heroEnabled: boolean;
  onToggleHero: () => void;
  onOpenItinerary: () => void;
  program: ProgramRow[];
  simNow: number | null;
  /** Saluto e orari, sulla stessa riga della scritta del ritrovo */
  greeting?: string;
  /** Scorciatoie, sotto il conto alla rovescia */
  shortcuts?: ReactNode;
}

/** Pagina Oggi, desktop: fascia video con sfumatura verso il fondo, countdown grande e programma del giorno. */
export function DesktopOggiHero({ heroEnabled, onToggleHero, onOpenItinerary, program, simNow, greeting, shortcuts }: DesktopOggiHeroProps) {
  const now = useClock(simNow);
  const L = launchState(now);
  const d = new Date(now);
  const dateLine = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).format(d);
  const dateCap = dateLine.charAt(0).toUpperCase() + dateLine.slice(1);
  const itTime = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(d);
  const krTime = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' }).format(d);
  const cnTime = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }).format(d);

  let units: { v: string; label: string; accent?: boolean }[] = [];
  if (L.kind === 'countdown') {
    const t = splitDuration(L.target - now);
    units = [
      ...(t.days > 0 ? [{ v: String(t.days), label: 'Giorni', accent: true  }] : []),
      { v: t.hh, label: 'Ore' },
      { v: t.mm, label: 'Minuti' },
      { v: t.ss, label: 'Secondi'},
    ];
  }

  return (
    <div data-testid="desktop-oggi-hero">
      <section className="relative isolate overflow-hidden bg-[#080D18]" style={{ height: 300 }}>
        <HeroVideo enabled={heroEnabled} overlay={false} className="-z-10" />
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg,#080D18 0%,rgba(8,13,24,.35) 55%,rgba(8,13,24,.2) 100%)' }}
        />
        <HeroVideoToggle enabled={heroEnabled} onToggle={onToggleHero} />
        <div style={{ position: 'absolute', left: 40, right: 40, bottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div>
            <p style={{ ...MONO, margin: 0, color: '#CBD5E1' }}>
              {dateCap} · Italia {itTime} · Pechino {cnTime} · Seul {krTime}
            </p>
            <h1 style={{ ...DISP, margin: '8px 0 0', fontSize: 56, lineHeight: 1 }}>Oggi</h1>
          </div>
        </div>
      </section>

      <section style={{ padding: '28px 40px', display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 40 }}>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, containerType: 'inline-size' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            {greeting && (
              <>
                <span style={{ ...MONO, margin: 0, color: '#CBD5E1' }}>{greeting}</span>
                <span aria-hidden style={{ width: 1, height: 12, background: '#1E2B40' }} />
              </>
            )}
            <p style={{ ...MONO, margin: 0, color: '#00C5E8' }}>{L.eyebrow}</p>
          </div>
          {L.kind === 'departing' ? (
            <p style={{ ...DISP, margin: '14px 0 0', fontSize: 'min(120px, 17cqw)', lineHeight: 0.95, color: '#00C5E8' }}>Si parte!</p>
          ) : L.kind === 'trip' ? (
            <p style={{ ...DISP, margin: '14px 0 0', fontSize: 'min(96px, 13cqw)', lineHeight: 0.95 }}>{L.title}</p>
          ) : (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-end', gap: '1.2cqw', ...DISP, fontVariantNumeric: 'tabular-nums' }}>
              {units.map((u, i) => (
                <div key={u.label} style={{ display: 'flex', alignItems: 'flex-end', gap: '1.2cqw' }}>
                  {i > 0 && <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: 'min(70px, 9cqw)', lineHeight: 0.9, color: '#1E2B40' }}>:</span>}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 'min(96px, 13.5cqw)', lineHeight: 0.9, color: u.accent ? '#00C5E8' : '#F7F9FC' }} aria-label={u.label}>{u.v}</span>
                    <span style={{ ...MONO, marginTop: 8 }}>{u.label.toLowerCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p style={{ margin: '18px 0 0', fontSize: 17, color: '#CBD5E1', maxWidth: 560 }}>
            {L.caption}
          </p>
          {shortcuts && <div style={{ marginTop: 28 }}>{shortcuts}</div>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <p style={{ ...DISP, margin: 0, fontSize: 22 }}>Programma</p>
            <button type="button" onClick={onOpenItinerary} style={{ background: 'none', border: 0, padding: 0, fontSize: 13, color: '#00C5E8', fontWeight: 600, cursor: 'pointer' }}>
              Tutto →
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            {program.length === 0 && <p style={{ margin: 0, fontSize: 15, color: '#CBD5E1' }}>Giornata libera: scegliete tra i luoghi salvati dal gruppo.</p>}
            {program.map((r, i) => (
              <div
                key={`${r.time}-${i}`}
                style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, padding: '16px 0', borderTop: RULE, ...(i === program.length - 1 ? { borderBottom: RULE } : {}) }}
              >
                <span style={{ ...DISP, fontSize: 16, color: '#60A5FA', fontVariantNumeric: 'tabular-nums' }}>{r.time}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.title}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 13, color: '#94A3B8' }}>{r.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
