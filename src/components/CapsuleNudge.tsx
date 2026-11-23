import React, { useEffect, useState } from 'react';
import { ChevronRight, Hourglass } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { watchCapsule, type CapsuleEntry } from '../services/capsuleService';
import { activeClosesAt, openMilestone } from '../utils/capsule';

const when = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

/** In "Oggi": un invito solo mentre un traguardo della capsula è aperto e non hai ancora risposto né saltato. */
export const CapsuleNudge: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CapsuleEntry[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => watchCapsule(setEntries, () => setEntries([])), []);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const m = openMilestone(now);
  if (m === null || entries === null || !user) return null;
  if (entries.some((e) => e.milestone === m && e.uid === user.id)) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="capsule-nudge"
      className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-[rgba(96,150,214,0.13)] px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d9e6]"
    >
      <Hourglass className="h-5 w-5 shrink-0 text-[#52d9e6]" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">{m === 1 ? 'Capsula dell’ultimo giorno' : `Capsula dei ${m} giorni`}</span>
        <span className="block text-xs text-slate-400">Cosa stai facendo adesso? Chiude {when(activeClosesAt(m, now))}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
    </button>
  );
};

export default CapsuleNudge;
