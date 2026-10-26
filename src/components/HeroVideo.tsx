import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

/**
 * Sfondo dell'intestazione: timelapse di Seul a tutta larghezza.
 * - "cover" centrato: riempie da bordo a bordo a qualsiasi risoluzione, ritagliando in alto/basso
 * - il pulsante "Animazione" lo ferma e mostra un singolo fotogramma (scelta salvata sul dispositivo)
 * - parte fermo se il sistema ha "riduci movimento"
 * - si mette in pausa quando non è visibile o l'app è in secondo piano
 */

const BASE = import.meta.env.BASE_URL;
const SRC_WEBM = `${BASE}assets/hero/seoul-hero.webm`;
const SRC_MP4 = `${BASE}assets/hero/seoul-hero.mp4`;
const POSTER = `${BASE}assets/hero/seoul-hero-poster.jpg`;
const KEY = 'seul2027:hero-animation';

function initialEnabled(): boolean {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'off') return false;
    if (saved === 'on') return true;
  } catch {
    /* storage non disponibile */
  }
  return !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
}

export function useHeroAnimation() {
  const [enabled, setEnabled] = useState(initialEnabled);
  const toggle = useCallback(() => {
    setEnabled((v) => {
      try {
        localStorage.setItem(KEY, v ? 'off' : 'on');
      } catch {
        /* ignora */
      }
      return !v;
    });
  }, []);
  return { enabled, toggle };
}

export function HeroVideoToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!enabled}
      data-testid="hero-animation-toggle"
      title={enabled ? 'Togli animazione' : 'Attiva animazione'}
      className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-950/55 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 backdrop-blur transition-colors hover:bg-slate-900/80 sm:right-5 sm:top-4"
    >
      {enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      <span>{enabled ? 'Togli animazione' : 'Attiva animazione'}</span>
    </button>
  );
}

export default function HeroVideo({ enabled, className = '' }: { enabled: boolean; className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!enabled || !v) {
      setPlaying(false);
      return;
    }
    let visible = true;
    const sync = () => {
      if (visible && !document.hidden) v.play().catch(() => undefined);
      else v.pause();
    };
    const onPlaying = () => setPlaying(true);
    v.addEventListener('playing', onPlaying);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    io.observe(v);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      v.removeEventListener('playing', onPlaying);
      io.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [enabled]);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden bg-slate-950 ${className}`}>
      <img src={POSTER} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      {enabled && (
        <video
          ref={videoRef}
          poster={POSTER}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          disablePictureInPicture
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
            playing ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <source src={SRC_WEBM} type="video/webm" />
          <source src={SRC_MP4} type="video/mp4" />
        </video>
      )}
      {/* velo per leggere testo e riquadri sopra il video */}
      <div className="absolute inset-0 bg-slate-950/45" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/10 to-slate-950/45" />
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950/85 to-transparent" />
    </div>
  );
}
