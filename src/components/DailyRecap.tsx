import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Check, ChevronRight, Wallet } from 'lucide-react';
import { watchExpenses } from '../services/expenseService';
import { galleryService } from '../services/galleryService';
import type { Expense } from '../types/expenses';
import type { PhotoDoc } from '../types/gallery';

interface DailyRecapProps {
  /** Numero del giorno dell'itinerario, usato anche dalle foto condivise. */
  dayNumber: number;
  /** Data ISO con il fuso della tappa, usata dalle spese. */
  dateIso: string;
  dateLabel: string;
  /** Tappe già superate nell'orario del programma. */
  completedStops: string[];
  onOpenExpenses: () => void;
  onOpenGallery: () => void;
  onOpenItinerary: () => void;
}

const money = (cents: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

/**
 * Riepilogo della giornata in corso. Le tappe derivano dall'orario del programma;
 * spese e foto sono invece i dati reali già inseriti dal gruppo.
 */
export const DailyRecap: React.FC<DailyRecapProps> = ({
  dayNumber,
  dateIso,
  dateLabel,
  completedStops,
  onOpenExpenses,
  onOpenGallery,
  onOpenItinerary
}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [photos, setPhotos] = useState<PhotoDoc[]>([]);

  useEffect(() => watchExpenses((snap) => setExpenses(snap.expenses), () => setExpenses([])), []);
  useEffect(() => galleryService.watchPhotos(100, setPhotos, () => setPhotos([])), []);

  const todayExpenses = useMemo(() => expenses.filter((expense) => expense.date === dateIso), [expenses, dateIso]);
  const totalCents = useMemo(() => todayExpenses.reduce((total, expense) => total + expense.amountCents, 0), [todayExpenses]);
  const todayPhotos = useMemo(() => photos.filter((photo) => photo.dayNumber === dayNumber), [photos, dayNumber]);
  const places = completedStops.slice(0, 3);
  const remaining = completedStops.length - places.length;

  return (
    <section className="rounded-2xl bg-[#0f1a26] px-4 py-4" aria-label={`Riepilogo di ${dateLabel}`} data-testid="daily-recap">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold tracking-[-0.02em] text-white">Com’è andata oggi</h3>
          <p className="mt-0.5 text-xs text-slate-400">{dateLabel}</p>
        </div>
        <button type="button" onClick={onOpenItinerary} className="inline-flex min-h-11 items-center gap-0.5 px-1 text-xs font-semibold text-[#52d9e6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d9e6]">
          Programma <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 border-t border-white/[0.08] pt-3">
        <div className="flex items-start gap-2.5">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#52d9e6]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">
              {completedStops.length === 0 ? 'La giornata è appena iniziata' : `${completedStops.length} ${completedStops.length === 1 ? 'tappa conclusa' : 'tappe concluse'}`}
            </p>
            {places.length > 0 && <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{places.join(' · ')}{remaining > 0 ? ` e altre ${remaining}` : ''}</p>}
          </div>
        </div>

        <div className="mt-3 divide-y divide-white/[0.08]">
          <button type="button" onClick={onOpenExpenses} className="flex min-h-12 w-full items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d9e6]">
            <Wallet className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="flex-1 text-sm text-slate-300">Spese registrate</span>
            <span className="text-sm font-semibold tabular-nums text-white">{money(totalCents)}</span>
            <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
          </button>
          <button type="button" onClick={onOpenGallery} className="flex min-h-12 w-full items-center gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d9e6]">
            <Camera className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="flex-1 text-sm text-slate-300">Foto condivise</span>
            <span className="text-sm font-semibold tabular-nums text-white">{todayPhotos.length}</span>
            <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default DailyRecap;
