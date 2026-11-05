import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react';
import { PdfPageViewer } from './PdfPageViewer';

export interface ViewerEntry {
  key: string;
  name: string;
  type: string;
  url: string;
}

/** Schermo intero su fondo bianco per far leggere codici a barre e QR; tiene lo schermo acceso. */
export const WalletViewer: React.FC<{ entries: ViewerEntry[]; start: number; onClose: () => void }> = ({ entries, start, onClose }) => {
  const [index, setIndex] = useState(Math.min(start, entries.length - 1));
  const [zoomed, setZoomed] = useState(false);
  const entry = entries[index];
  const isPdf = entry?.type === 'application/pdf';

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(entries.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    // Schermo sempre acceso finché il codice è aperto (dove il telefono lo permette)
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    const acquire = () => nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    acquire();
    const onVis = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => undefined);
    };
  }, [entries.length, onClose]);

  useEffect(() => setZoomed(false), [index]);

  if (!entry) return null;
  return (
    <div className="fixed inset-0 z-[900] bg-white text-slate-900 flex flex-col" role="dialog" aria-modal="true" aria-label={entry.name} data-testid="wallet-viewer">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-white" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
        <p className="flex-1 min-w-0 text-sm font-semibold truncate">{entry.name}</p>
        {!isPdf && (
          <button type="button" onClick={() => setZoomed((z) => !z)} className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 flex items-center justify-center" aria-label={zoomed ? 'Rimpicciolisci' : 'Ingrandisci'}>
            {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 relative bg-white">
        {isPdf ? (
          <PdfPageViewer url={entry.url} className="h-full" />
        ) : (
          // Margine bianco attorno al codice (zona di rispetto): nulla gli sta sopra
          <div className="absolute inset-0 overflow-auto flex p-6" style={{ touchAction: 'pan-x pan-y pinch-zoom' }}>
            <img
              src={entry.url}
              alt={entry.name}
              onClick={() => setZoomed((z) => !z)}
              className={`m-auto select-none ${zoomed ? 'max-w-none w-[220%]' : 'max-w-full max-h-full object-contain'}`}
              draggable={false}
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 border-t border-slate-200 bg-white" style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}>
        {entries.length > 1 ? (
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 disabled:opacity-30 flex items-center justify-center" aria-label="Precedente" data-testid="viewer-prev"><ChevronLeft className="w-5 h-5" /></button>
        ) : <span className="min-w-[44px]" />}
        <p className="flex-1 min-w-0 text-center text-[11px] text-slate-500 py-1.5">
          {entries.length > 1 ? `${index + 1} di ${entries.length} · ` : ''}Alza la luminosità dello schermo prima di far leggere il codice
        </p>
        {entries.length > 1 ? (
          <button type="button" disabled={index === entries.length - 1} onClick={() => setIndex(index + 1)} className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-100 disabled:opacity-30 flex items-center justify-center" aria-label="Successivo" data-testid="viewer-next"><ChevronRight className="w-5 h-5" /></button>
        ) : <span className="min-w-[44px]" />}
      </div>
    </div>
  );
};

export const Spinner: React.FC = () => <Loader2 className="w-5 h-5 animate-spin text-slate-400" />;
