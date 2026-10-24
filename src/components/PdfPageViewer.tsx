import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, Loader2, ZoomIn, ZoomOut } from 'lucide-react';

// Il PDF viene disegnato pagina per pagina su <canvas>: funziona su Android e iPhone,
// anche dentro l'app installata, senza scaricare il file e senza aprire nuove schede.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

interface PdfPageProps {
  pdf: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  cssWidth: number;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
  index: number;
}

const PdfPage: React.FC<PdfPageProps> = ({ pdf, pageNumber, cssWidth, registerRef, index }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cssWidth <= 0) return;
    let cancelled = false;
    let task: pdfjsLib.RenderTask | null = null;

    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: cssWidth / base.width });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        task = page.render({
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        await task.promise;
      } catch (err) {
        if (!(err instanceof Error && err.name === 'RenderingCancelledException')) {
          console.error('[PdfPageViewer] render failed', pageNumber, err);
        }
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [pdf, pageNumber, cssWidth]);

  return (
    <div
      ref={(el) => registerRef(index, el)}
      className="bg-white rounded-md shadow-lg shadow-black/40 overflow-hidden"
      style={{ width: cssWidth }}
    >
      <canvas ref={canvasRef} className="block" aria-label={`Pagina ${pageNumber}`} />
    </div>
  );
};

interface PdfPageViewerProps {
  url: string;
  /** Pagina da mostrare quando cambia (es. dal selettore degli argomenti). */
  targetPage?: number;
  className?: string;
}

export const PdfPageViewer: React.FC<PdfPageViewerProps> = ({ url, targetPage, className = '' }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [current, setCurrent] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Caricamento del documento
  useEffect(() => {
    setError(null);
    setPdf(null);
    const task = pdfjsLib.getDocument({ url });
    let cancelled = false;
    task.promise
      .then((doc) => {
        if (cancelled) return;
        setNumPages(doc.numPages);
        setPdf(doc);
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile mostrare il PDF. Puoi scaricarlo con il pulsante qui sopra.');
      });
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [url]);

  // Larghezza disponibile, aggiornata al ridimensionamento (rotazione del telefono compresa)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.max(0, containerWidth - 16) * zoom;

  const registerRef = useCallback((index: number, el: HTMLDivElement | null) => {
    pageRefs.current[index] = el;
  }, []);

  const goToPage = useCallback((n: number, smooth = true) => {
    const scroller = scrollRef.current;
    const target = pageRefs.current[n - 1];
    if (!scroller || !target) return;
    scroller.scrollTo({ top: target.offsetTop - 8, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Segue la pagina scelta dall'esterno
  useEffect(() => {
    if (!targetPage || !pdf) return;
    const id = window.setTimeout(() => goToPage(Math.min(targetPage, numPages), false), 50);
    return () => window.clearTimeout(id);
  }, [targetPage, pdf, numPages, goToPage]);

  // Aggiorna il contatore "pagina X di N" mentre si scorre
  const onScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const line = scroller.scrollTop + scroller.clientHeight * 0.3;
    let idx = 0;
    pageRefs.current.forEach((p, i) => {
      if (p && p.offsetTop <= line) idx = i;
    });
    setCurrent(idx + 1);
  };

  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div className={`flex flex-col h-full min-h-0 ${className}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-950 border-b border-slate-800 text-slate-300 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToPage(Math.max(1, current - 1))}
            disabled={current <= 1}
            aria-label="Pagina precedente"
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono min-w-[4.5rem] text-center tabular-nums">
            {numPages ? `${current} / ${numPages}` : '…'}
          </span>
          <button
            type="button"
            onClick={() => goToPage(Math.min(numPages, current + 1))}
            disabled={!numPages || current >= numPages}
            aria-label="Pagina successiva"
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Riduci zoom"
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            aria-label="Adatta alla larghezza"
            className="px-2 h-10 rounded-lg text-xs font-mono tabular-nums hover:bg-slate-800 transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Aumenta zoom"
            className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 min-h-0 overflow-auto overscroll-contain bg-slate-800/60"
      >
        {!pdf && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Caricamento PDF…
          </div>
        )}
        {error && (
          <div className="p-6 text-center text-sm text-slate-300">{error}</div>
        )}
        {pdf && (
          <div className="py-3" style={{ width: Math.max(containerWidth, pageWidth + 16) }}>
            <div className="flex flex-col items-center gap-3 px-2" style={{ width: pageWidth + 16, margin: '0 auto' }}>
              {pages.map((n, i) => (
                <PdfPage
                  key={`${url}-${n}`}
                  index={i}
                  pdf={pdf}
                  pageNumber={n}
                  cssWidth={pageWidth}
                  registerRef={registerRef}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
