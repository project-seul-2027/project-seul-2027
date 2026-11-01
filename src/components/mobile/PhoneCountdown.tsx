import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

/** Stesso traguardo del conto alla rovescia della versione desktop: 1 marzo 2027, ore 10:00 (Corea). */
const TARGET = new Date('2027-03-01T10:00:00+01:00').getTime();

/** Conto alla rovescia per il telefono: giorni, ore, minuti e secondi, aggiornato ogni secondo. */
export const PhoneCountdown: React.FC = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const diff = Math.max(0, TARGET - now);
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor(diff / 3_600_000) % 24;
  const minutes = Math.floor(diff / 60_000) % 60;
  const seconds = Math.floor(diff / 1000) % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  const cells = [
    { value: String(days), label: 'Giorni', tone: 'text-app-accent' },
    { value: pad(hours), label: 'Ore', tone: 'text-app-text' },
    { value: pad(minutes), label: 'Min', tone: 'text-app-text' },
    { value: pad(seconds), label: 'Sec', tone: 'text-app-text' }
  ];

  return (
    <div className="mt-1" role="group" aria-label={`Mancano ${days} giorni, ${hours} ore, ${minutes} minuti e ${seconds} secondi alla partenza`} data-testid="phone-countdown">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-app-muted">
        <Clock className="w-3.5 h-3.5 text-app-accent" aria-hidden />
        Conto alla rovescia Malpensa
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" aria-hidden>
        {cells.map((c) => (
          <div key={c.label} className="rounded-2xl border border-app-line bg-app-bg/70 py-2.5 text-center">
            <div className={`font-mono text-[26px] font-bold leading-none tabular-nums ${c.tone}`}>{c.value}</div>
            <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-app-muted">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
