import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { loadCapsuleImage } from '../services/capsuleService';

const MIN_SCALE = 1;
/** La foto salvata è di 1600 px: oltre ~4 volte uno schermo da telefono non c'è più dettaglio, e un livello più grande appesantisce la memoria */
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;
const BUTTON_STEP = 0.75;

interface View {
  scale: number;
  x: number;
  y: number;
}
interface Point {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * Foto della capsula a schermo intero. Lo zoom segue il punto toccato: pizzica con due dita, doppio tocco, rotella o pulsanti;
 * trascina per spostarti. Parte dalla miniatura e passa da sola alla foto nitida.
 * Il gesto "indietro" di Android chiude la foto invece dell'app.
 */
export const CapsulePhotoViewer: React.FC<{ id: string; thumb: string; alt: string; onClose: () => void }> = ({ id, thumb, alt, onClose }) => {
  const [src, setSrc] = useState(thumb);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const [gesturing, setGesturing] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const closeNow = useRef(onClose);
  closeNow.current = onClose;
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point; view: View } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);
  const settle = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    loadCapsuleImage(id)
      .then((full) => alive && full && setSrc(full))
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    closeRef.current?.focus();
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeNow.current();
    window.addEventListener('keydown', onKey);

    // Il gesto "indietro" chiude la foto: si aggiunge una voce alla cronologia e la si toglie quando la foto si chiude
    history.pushState({ capsuleViewer: true }, '');
    const onPop = () => closeNow.current();
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = overflow;
      opener?.focus?.();
      if (history.state?.capsuleViewer) history.back();
      window.clearTimeout(settle.current);
    };
  }, []);

  /** Tiene la foto dentro lo schermo: sposta solo quanto basta a non lasciare bordi vuoti */
  const fit = useCallback((next: View): View => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return next;
    const limitX = ((next.scale - 1) * box.width) / 2;
    const limitY = ((next.scale - 1) * box.height) / 2;
    return { scale: next.scale, x: clamp(next.x, -limitX, limitX), y: clamp(next.y, -limitY, limitY) };
  }, []);

  /** Nuovo ingrandimento mantenendo ferma sotto al dito (o al puntatore) la parte di foto che c'era prima */
  const zoomAround = useCallback(
    (base: View, scale: number, focus: Point | null): View => {
      const box = stage.current?.getBoundingClientRect();
      const next = clamp(scale, MIN_SCALE, MAX_SCALE);
      if (next <= MIN_SCALE) return { scale: 1, x: 0, y: 0 };
      if (!box || !focus) return fit({ ...base, scale: next });
      const px = focus.x - (box.left + box.width / 2);
      const py = focus.y - (box.top + box.height / 2);
      const ratio = next / base.scale;
      return fit({ scale: next, x: px - (px - base.x) * ratio, y: py - (py - base.y) * ratio });
    },
    [fit]
  );

  /** Finché si fa un gesto la foto si sposta come livello già pronto (leggero); a gesto finito torna a disegnarsi nitida */
  const touch = () => {
    setGesturing(true);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => setGesturing(false), 160);
  };

  const zoomButton = (scale: number) => {
    setAnimate(true);
    setView((v) => zoomAround(v, scale, null));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* il puntatore non è più attivo: si prosegue senza cattura */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    setAnimate(false);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: distance(a, b), mid: midpoint(a, b), view };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const start = pinch.current;
      const scale = clamp((start.view.scale * distance(a, b)) / start.dist, MIN_SCALE, MAX_SCALE);
      // Ingrandisce attorno al punto in cui erano le dita all'inizio e segue anche lo spostamento del centro
      const zoomed = zoomAround(start.view, scale, start.mid);
      const mid = midpoint(a, b);
      moved.current = true;
      touch();
      setView(scale > 1 ? fit({ ...zoomed, x: zoomed.x + (mid.x - start.mid.x), y: zoomed.y + (mid.y - start.mid.y) }) : zoomed);
    } else if (pointers.current.size === 1 && view.scale > 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) {
        moved.current = true;
        touch();
        setView((v) => fit({ ...v, x: v.x + dx, y: v.y + dy }));
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0 && !moved.current) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        // Doppio tocco: ingrandisce proprio dove hai toccato, o torna alla foto intera
        setAnimate(true);
        setView((v) => (v.scale > 1 ? zoomAround(v, 1, null) : zoomAround(v, DOUBLE_TAP_SCALE, { x: e.clientX, y: e.clientY })));
        lastTap.current = 0;
      } else lastTap.current = now;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    setAnimate(false);
    touch();
    setView((v) => zoomAround(v, v.scale * Math.exp(-e.deltaY * 0.0015), { x: e.clientX, y: e.clientY }));
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={alt} data-testid="capsule-viewer">
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate text-sm text-slate-300">{alt}</p>
        <button ref={closeRef} type="button" onClick={() => closeNow.current()} aria-label="Chiudi la foto" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d9e6]">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: animate ? 'transform 220ms var(--ease-out)' : 'none',
            willChange: gesturing ? 'transform' : 'auto',
            cursor: view.scale > 1 ? 'grab' : 'zoom-in'
          }}
        />
        {loading && (
          <span className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-black/70 px-3 py-1.5 text-xs text-slate-200" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Carico la foto nitida
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={() => zoomButton(view.scale - BUTTON_STEP)} disabled={view.scale <= MIN_SCALE} aria-label="Riduci" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-30">
          <ZoomOut className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomButton(1)} aria-label="Foto intera" className="h-11 min-w-16 rounded-xl bg-white/10 px-3 text-sm tabular-nums text-white">
          {Math.round(view.scale * 100)}%
        </button>
        <button type="button" onClick={() => zoomButton(view.scale + BUTTON_STEP)} disabled={view.scale >= MAX_SCALE} aria-label="Ingrandisci" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-30">
          <ZoomIn className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default CapsulePhotoViewer;
