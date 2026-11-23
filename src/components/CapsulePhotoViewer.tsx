import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { loadCapsuleImage } from '../services/capsuleService';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;

interface View {
  scale: number;
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Foto della capsula a schermo intero: pizzica con due dita o usa la rotella per ingrandire, trascina per spostarti,
 * doppio tocco per passare da intera a ingrandita. Parte dalla miniatura e passa da sola alla foto a qualità piena.
 */
export const CapsulePhotoViewer: React.FC<{ id: string; thumb: string; alt: string; onClose: () => void }> = ({ id, thumb, alt, onClose }) => {
  const [src, setSrc] = useState(thumb);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; scale: number } | null>(null);
  const lastTap = useRef(0);
  const moved = useRef(false);

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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [onClose]);

  /** Tiene la foto dentro lo schermo: sposta solo quanto basta a non lasciare bordi vuoti */
  const fit = useCallback((next: View): View => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return next;
    const limitX = ((next.scale - 1) * box.width) / 2;
    const limitY = ((next.scale - 1) * box.height) / 2;
    return { scale: next.scale, x: clamp(next.x, -limitX, limitX), y: clamp(next.y, -limitY, limitY) };
  }, []);

  const zoomTo = (scale: number, animated = true) => {
    setAnimate(animated);
    setView((v) => fit({ scale: clamp(scale, MIN_SCALE, MAX_SCALE), x: scale <= MIN_SCALE ? 0 : v.x, y: scale <= MIN_SCALE ? 0 : v.y }));
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
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      moved.current = true;
      setView((v) => fit({ ...v, scale: clamp((gesture.current!.scale * dist) / gesture.current!.dist, MIN_SCALE, MAX_SCALE) }));
    } else if (pointers.current.size === 1 && view.scale > 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 0) moved.current = true;
      setView((v) => fit({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0 && !moved.current) {
      const now = Date.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        zoomTo(view.scale > 1 ? 1 : DOUBLE_TAP_SCALE);
        lastTap.current = 0;
      } else lastTap.current = now;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    setAnimate(false);
    setView((v) => fit({ ...v, scale: clamp(v.scale * Math.exp(-e.deltaY * 0.0015), MIN_SCALE, MAX_SCALE) }));
  };

  return createPortal(
    <div className="motion-fade fixed inset-0 z-[300] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label={alt} data-testid="capsule-viewer">
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate text-sm text-slate-300">{alt}</p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Chiudi la foto" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#52d9e6]">
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
          className="absolute inset-0 h-full w-full object-contain"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transition: animate ? 'transform 220ms var(--ease-out)' : 'none',
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
        <button type="button" onClick={() => zoomTo(view.scale - 0.75)} disabled={view.scale <= MIN_SCALE} aria-label="Riduci" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-30">
          <ZoomOut className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomTo(1)} aria-label="Foto intera" className="h-11 min-w-16 rounded-xl bg-white/10 px-3 text-sm tabular-nums text-white">
          {Math.round(view.scale * 100)}%
        </button>
        <button type="button" onClick={() => zoomTo(view.scale + 0.75)} disabled={view.scale >= MAX_SCALE} aria-label="Ingrandisci" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white disabled:opacity-30">
          <ZoomIn className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default CapsulePhotoViewer;
