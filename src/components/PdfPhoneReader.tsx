import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, ListOrdered, Maximize2, X } from 'lucide-react';
import { PdfPageViewer } from './PdfPageViewer';

export interface ReaderTopic {
  page: number;
  title: string;
  summary: string;
}

interface PdfPhoneReaderProps {
  url: string;
  title: string;
  subtitle: string;
  downloadName: string;
  topics: ReaderTopic[];
  onDocument?: (doc: any) => void;
  onFullscreen: () => void;
  /** Messaggi sotto il titolo (esito del caricamento, giorni cambiati) */
  notice?: React.ReactNode;
  /** Quello che sta sotto il lettore: dati utili, gestione del PDF */
  children?: React.ReactNode;
}

const iconButton =
  'flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--ms-fill)] text-[var(--ms-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ms-accent)]';

/**
 * Lettore del PDF per telefono: tutto quello che serve per muoversi tra le pagine sta nella prima schermata.
 * In alto la barra delle pagine (un segmento per pagina), poi titolo e frecce della pagina in vista,
 * con l'indice completo a portata di tocco; il resto dello spazio è del documento.
 */
export const PdfPhoneReader: React.FC<PdfPhoneReaderProps> = ({ url, title, subtitle, downloadName, topics, onDocument, onFullscreen, notice, children }) => {
  const [numPages, setNumPages] = useState(0);
  const [active, setActive] = useState(1);
  const [target, setTarget] = useState(1);
  const [jump, setJump] = useState(0);
  const [indexOpen, setIndexOpen] = useState(false);

  const total = numPages || topics.length;
  const topicOf = (page: number) => topics.find((t) => t.page === page);

  const goTo = useCallback(
    (page: number) => {
      const clamped = Math.max(1, total ? Math.min(total, page) : page);
      setTarget(clamped);
      setActive(clamped);
      setJump((j) => j + 1);
    },
    [total]
  );

  const current = topicOf(active);

  return (
    <div className="space-y-3" data-testid="pdf-phone">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 pt-0.5">
          <h2 className="font-[Outfit] text-[22px] font-medium leading-tight text-[var(--ms-text)]">{title}</h2>
          <p className="mt-0.5 truncate text-[13px] text-[var(--ms-mute)]">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a href={url} download={downloadName} aria-label="Scarica il PDF" className={iconButton}>
            <Download className="h-5 w-5" aria-hidden="true" />
          </a>
          <button type="button" onClick={onFullscreen} aria-label="Apri a schermo intero" className={iconButton}>
            <Maximize2 className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {notice}

      <section
        aria-label="Lettore PDF"
        className="flex flex-col overflow-hidden rounded-2xl bg-[rgba(96,150,214,0.06)]"
      >
        <PageScrubber total={total} active={active} valueText={(n) => `Pagina ${n} di ${total}${topicOf(n) ? `: ${topicOf(n)!.title}` : ''}`} onPick={goTo} />

        <div className="flex shrink-0 items-center gap-1 px-2 py-1">
          <button type="button" onClick={() => goTo(active - 1)} disabled={active <= 1} aria-label="Pagina precedente" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--ms-text)] disabled:opacity-30">
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setIndexOpen(true)}
            aria-haspopup="dialog"
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ms-accent)]"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] tabular-nums text-[var(--ms-mute)]">{total ? `Pagina ${active} di ${total}` : 'Pagine'}</span>
              <span className="block truncate text-[15px] font-medium text-[var(--ms-text)]">{current?.title ?? 'Apri l’indice'}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--ms-accent)]">
              <ListOrdered className="h-5 w-5" aria-hidden="true" /> Indice
            </span>
          </button>
          <button type="button" onClick={() => goTo(active + 1)} disabled={!total || active >= total} aria-label="Pagina successiva" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--ms-text)] disabled:opacity-30">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <PdfPageViewer
          variant="phone"
          fitPage
          url={url}
          targetPage={target}
          targetKey={jump}
          onPageChange={setActive}
          onDocument={(doc) => {
            setNumPages(doc.numPages);
            onDocument?.(doc);
          }}
        />
      </section>

      {children}

      {indexOpen && (
        <IndexSheet
          topics={topics}
          active={active}
          onPick={(page) => {
            goTo(page);
            setIndexOpen(false);
          }}
          onClose={() => setIndexOpen(false)}
        />
      )}
    </div>
  );
};

/**
 * Una barra con un segmento per pagina: si tocca un punto o si trascina il dito per scorrere il documento,
 * come nelle storie di Instagram. Non scorre di lato, quindi non nasconde pagine; i segmenti già letti restano accesi.
 * Per tastiera e screen reader è un cursore (frecce, Home, Fine) con il nome della pagina.
 */
const PageScrubber: React.FC<{ total: number; active: number; valueText: (page: number) => string; onPick: (page: number) => void }> = ({ total, active, valueText, onPick }) => {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const pageAt = (clientX: number) => {
    const box = track.current!.getBoundingClientRect();
    return Math.min(total, Math.max(1, Math.floor(((clientX - box.left) / box.width) * total) + 1));
  };
  const pick = (clientX: number) => {
    const page = pageAt(clientX);
    if (page !== active) onPick(page);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (step) onPick(Math.min(total, Math.max(1, active + step)));
    else if (e.key === 'Home') onPick(1);
    else if (e.key === 'End') onPick(total);
    else return;
    e.preventDefault();
  };

  if (total === 0) return <div className="mx-3 mt-2 h-14" aria-hidden="true" />;

  const pages = Array.from({ length: total }, (_, i) => i + 1);
  // Con molte pagine i numeri non starebbero uno accanto all'altro: restano il primo, l'ultimo, quello in vista e ogni quinto
  const labelled = (page: number) => total <= 20 || page === 1 || page === total || page === active || page % 5 === 0;
  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label="Pagina del PDF"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={active}
      aria-valuetext={valueText(active)}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && pick(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      className="mx-3 mt-2 flex h-14 shrink-0 touch-none flex-col justify-center gap-1.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ms-accent)]"
    >
      {/* Numeri e barre usano gli stessi colori: acceso = pagina in vista, tenue = già lette, grigio = da leggere */}
      <div className="flex gap-[3px]" aria-hidden="true">
        {pages.map((page) => (
          <span key={page} className={`flex-1 text-center text-[11px] leading-none tabular-nums ${page === active ? 'font-semibold text-[var(--ms-accent)]' : page < active ? 'text-[rgba(82,217,230,0.75)]' : 'text-[rgba(234,240,246,0.55)]'}`}>
            {labelled(page) ? page : ''}
          </span>
        ))}
      </div>
      <div className="flex h-2.5 items-center gap-[3px]" aria-hidden="true">
        {pages.map((page) => (
          <span
            key={page}
            className={`flex-1 rounded-full transition-[height,background-color] duration-150 ${
              page === active ? 'h-2.5 bg-[var(--ms-accent)]' : page < active ? 'h-1.5 bg-[rgba(82,217,230,0.4)]' : 'h-1.5 bg-[rgba(234,240,246,0.2)]'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/** Indice completo in un foglio dal basso: tutte le pagine con titolo e inizio del contenuto */
const IndexSheet: React.FC<{ topics: ReaderTopic[]; active: number; onPick: (page: number) => void; onClose: () => void }> = ({ topics, active, onPick, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="pdf-index-title" data-testid="pdf-index-sheet">
      <button type="button" aria-label="Chiudi l’indice" onClick={onClose} tabIndex={-1} className="motion-fade absolute inset-0 bg-black/60" />
      <div className="animate-sheet-up relative flex max-h-[85svh] w-full flex-col rounded-t-2xl bg-[#0a1119] pb-[env(safe-area-inset-bottom)]">
        <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4">
          <h3 id="pdf-index-title" className="font-[Outfit] text-[20px] font-medium text-[var(--ms-text)]">Indice del PDF</h3>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Chiudi" className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--ms-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ms-accent)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <ol data-motion="list" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
          {topics.map((t) => {
            const on = t.page === active;
            return (
              <li key={t.page}>
                <button
                  type="button"
                  onClick={() => onPick(t.page)}
                  aria-current={on ? 'page' : undefined}
                  className={`grid w-full grid-cols-[32px_minmax(0,1fr)] gap-2 rounded-xl px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ms-accent)] ${on ? 'bg-[var(--ms-fill)]' : ''}`}
                >
                  <span className={`pt-px font-[Outfit] text-[16px] tabular-nums ${on ? 'text-[var(--ms-accent)]' : 'text-[var(--ms-mute)]'}`}>{t.page}</span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium leading-snug text-[var(--ms-text)]">{t.title}</span>
                    {t.summary && <span className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--ms-mute)]">{t.summary}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>,
    document.body
  );
};

export default PdfPhoneReader;
