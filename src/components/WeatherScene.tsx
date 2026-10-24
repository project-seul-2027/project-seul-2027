import React, { useEffect, useId, useMemo, useRef } from 'react';

/**
 * Sfondo animato del meteo reale: sole o luna con stelle, nuvole che scorrono, nebbia,
 * pioggia (leggera → intensa), neve, grandine e fulmini. Pensato per stare dietro al contenuto
 * di una card (absolute, pointer-events-none, semitrasparente).
 */

export interface WeatherSceneProps {
  /** Codice WMO del meteo attuale */
  code: number;
  isDay: boolean;
  precipitationMm?: number;
  windKmH?: number;
  /** Riquadro stretto (telefono): sole/luna più al centro, dove c'era l'icona */
  compact?: boolean;
  className?: string;
}

type Precip = 'none' | 'drizzle' | 'rain' | 'snow' | 'hail';
type CloudTone = 'light' | 'grey' | 'dark' | 'storm';

interface SceneSpec {
  celestial: 'sun' | 'moon' | null;
  celestialDim: number;
  clouds: number;
  cloudTone: CloudTone;
  fog: boolean;
  precip: Precip;
  /** 0..1 */
  intensity: number;
  /** Con la grandine cade anche pioggia */
  rainAlso: boolean;
  lightning: boolean;
  stars: boolean;
}

export function describeScene(code: number, isDay: boolean, precipMm = 0): SceneSpec {
  const base: SceneSpec = {
    celestial: isDay ? 'sun' : 'moon',
    celestialDim: 1,
    clouds: 0,
    cloudTone: 'light',
    fog: false,
    precip: 'none',
    intensity: 0,
    rainAlso: false,
    lightning: false,
    stars: !isDay
  };
  const boost = (i: number) => Math.max(i, Math.min(1, precipMm / 6));
  const wet = (precip: Precip, intensity: number, clouds: number, tone: CloudTone): SceneSpec => ({
    ...base,
    celestial: null,
    stars: false,
    precip,
    intensity: boost(intensity),
    clouds,
    cloudTone: tone
  });

  switch (code) {
    case 0:
      return base;
    case 1:
      return { ...base, clouds: 1 };
    case 2:
      return { ...base, clouds: 3, celestialDim: 0.85 };
    case 3:
      return { ...base, celestial: null, stars: false, clouds: 5, cloudTone: 'grey' };
    case 45:
    case 48:
      return { ...base, fog: true, clouds: 2, celestialDim: 0.4, stars: false, cloudTone: 'grey' };
    case 51:
      return wet('drizzle', 0.25, 4, 'grey');
    case 53:
      return wet('drizzle', 0.45, 4, 'grey');
    case 55:
    case 56:
    case 57:
      return wet('drizzle', 0.65, 5, 'grey');
    case 61:
      return wet('rain', 0.3, 4, 'grey');
    case 63:
    case 66:
      return wet('rain', 0.6, 5, 'dark');
    case 65:
    case 67:
      return wet('rain', 1, 6, 'dark');
    case 80:
      return wet('rain', 0.4, 4, 'grey');
    case 81:
      return wet('rain', 0.7, 5, 'dark');
    case 82:
      return wet('rain', 1, 6, 'dark');
    case 71:
      return wet('snow', 0.3, 4, 'grey');
    case 77:
      return wet('snow', 0.35, 4, 'grey');
    case 73:
    case 85:
      return wet('snow', 0.6, 5, 'grey');
    case 75:
    case 86:
      return wet('snow', 1, 6, 'grey');
    case 95:
      return { ...wet('rain', 0.8, 6, 'storm'), lightning: true };
    case 96:
      return { ...wet('hail', 0.55, 6, 'storm'), lightning: true, rainAlso: true };
    case 99:
      return { ...wet('hail', 1, 6, 'storm'), lightning: true, rainAlso: true };
    default:
      return { ...base, clouds: 3, celestialDim: 0.85 };
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLOUD_COLORS: Record<CloudTone, { day: [string, string]; night: [string, string] }> = {
  light: { day: ['#f1f5f9', '#94a3b8'], night: ['#c7d2fe', '#475569'] },
  grey: { day: ['#cbd5e1', '#64748b'], night: ['#94a3b8', '#334155'] },
  dark: { day: ['#94a3b8', '#334155'], night: ['#64748b', '#1e293b'] },
  storm: { day: ['#8b7fc0', '#2a2250'], night: ['#6a5da3', '#1b1638'] }
};

const WX_CSS = `
.wx-scene{position:absolute;inset:0;overflow:hidden;pointer-events:none;border-radius:inherit;container-type:size}
.wx-cloud{position:absolute;left:0;width:var(--w);will-change:transform;transform:translate3d(calc(-1 * var(--w) - 12px),0,0);animation:wx-drift var(--dur) linear var(--delay) infinite}
.wx-cloud svg{display:block;width:100%;height:auto}
@keyframes wx-drift{from{transform:translate3d(calc(-1 * var(--w) - 12px),0,0)}to{transform:translate3d(100cqw,0,0)}}
.wx-celestial{position:absolute}
.wx-sun-glow{position:absolute;inset:-45%;border-radius:50%;background:radial-gradient(circle,rgba(253,224,71,.42) 0%,rgba(251,191,36,.16) 38%,transparent 66%);animation:wx-pulse 7s ease-in-out infinite}
.wx-sun-rays{position:absolute;inset:-35%;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(253,224,71,.2) 0deg 4deg,transparent 4deg 18deg);-webkit-mask-image:radial-gradient(circle,transparent 26%,#000 38%,transparent 68%);mask-image:radial-gradient(circle,transparent 26%,#000 38%,transparent 68%);animation:wx-spin 100s linear infinite}
.wx-sun-core{position:absolute;inset:24%;border-radius:50%;background:radial-gradient(circle at 36% 34%,#fffbe0,#fde047 45%,#f59e0b 100%);box-shadow:0 0 34px rgba(251,191,36,.55)}
.wx-moon-glow{position:absolute;inset:-50%;border-radius:50%;background:radial-gradient(circle,rgba(165,180,252,.34) 0%,rgba(129,140,248,.12) 40%,transparent 66%);animation:wx-pulse 8s ease-in-out infinite}
.wx-star{position:absolute;border-radius:50%;background:#e0e7ff;animation:wx-twinkle var(--d) ease-in-out var(--l) infinite}
.wx-fog{position:absolute;left:-25%;width:150%;border-radius:50%;background:linear-gradient(90deg,transparent,rgba(203,213,225,.26),transparent);filter:blur(10px);animation:wx-fog var(--d) ease-in-out infinite alternate}
.wx-flash{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at var(--x) -5%,rgba(237,223,255,.95),rgba(167,139,250,.28) 42%,transparent 72%);animation:wx-lightning var(--d) linear var(--l) infinite}
.wx-bolt{position:absolute;top:-2%;height:78%;width:13%;opacity:0;filter:drop-shadow(0 0 5px rgba(196,181,253,.95));animation:wx-bolt var(--d) linear var(--l) infinite}
@keyframes wx-pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.08);opacity:1}}
@keyframes wx-spin{to{transform:rotate(360deg)}}
@keyframes wx-twinkle{0%,100%{opacity:.15}50%{opacity:.95}}
@keyframes wx-fog{from{transform:translate3d(-7%,0,0)}to{transform:translate3d(7%,0,0)}}
@keyframes wx-lightning{0%,58%,100%{opacity:0}60%{opacity:.34}61.5%{opacity:.04}63%{opacity:.26}67%{opacity:0}}
@keyframes wx-bolt{0%,58%,100%{opacity:0}60%{opacity:.95}61.5%{opacity:0}63%{opacity:.8}66%{opacity:0}}
@media (prefers-reduced-motion:reduce){
  .wx-cloud{animation:none!important;transform:translate3d(var(--rest),0,0)}
  .wx-sun-glow,.wx-sun-rays,.wx-moon-glow,.wx-star,.wx-fog{animation:none!important}
  .wx-flash,.wx-bolt{animation:none!important;opacity:0}
}
`;

const CloudShape: React.FC<{ id: string; top: string; bottom: string; opacity: number }> = ({ id, top, bottom, opacity }) => (
  <svg viewBox="0 0 220 100" aria-hidden="true" style={{ opacity, filter: 'blur(1.2px)' }}>
    <defs>
      <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="92">
        <stop offset="0" stopColor={top} />
        <stop offset="1" stopColor={bottom} />
      </linearGradient>
    </defs>
    <g fill={`url(#${id})`}>
      <circle cx="62" cy="64" r="30" />
      <circle cx="102" cy="46" r="38" />
      <circle cx="146" cy="58" r="33" />
      <circle cx="184" cy="70" r="22" />
      <rect x="40" y="62" width="160" height="30" rx="15" />
    </g>
  </svg>
);

/** Particelle (pioggia, neve, grandine) su canvas, con densità e velocità legate all'intensità */
const PrecipCanvas: React.FC<{ spec: SceneSpec; windKmH: number }> = ({ spec, windKmH }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || spec.precip === 'none') return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const i = spec.intensity;
    const wind = Math.min(1, windKmH / 40);

    type P = { x: number; y: number; vx: number; vy: number; len: number; r: number; a: number; kind: 'rain' | 'snow' | 'hail'; ph: number; bounced: number };
    type Splash = { x: number; age: number; max: number };
    let w = 1;
    let h = 1;
    let parts: P[] = [];
    let splashes: Splash[] = [];
    let raf = 0;
    let last = 0;
    let onScreen = true;
    let tabVisible = !document.hidden;
    const rnd = mulberry32(1234);

    const makeRain = (drizzle: boolean, factor = 1): P => {
      const speed = (drizzle ? 260 : 520) + i * (drizzle ? 140 : 480) + rnd() * 120;
      const slant = 0.1 + wind * 0.32;
      return {
        x: rnd() * (w + 80) - 40,
        y: rnd() * h,
        vx: speed * Math.tan(slant),
        vy: speed,
        len: (drizzle ? 6 : 11) + i * (drizzle ? 6 : 14) + rnd() * 6,
        r: 0,
        a: (0.22 + i * 0.28 + rnd() * 0.18) * factor,
        kind: 'rain',
        ph: 0,
        bounced: 0
      };
    };
    const makeSnow = (): P => ({
      x: rnd() * w,
      y: rnd() * h,
      vx: 8 + wind * 60,
      vy: 22 + i * 48 + rnd() * 26,
      len: 0,
      r: 0.9 + rnd() * (1.2 + i * 1.6),
      a: 0.45 + rnd() * 0.4,
      kind: 'snow',
      ph: rnd() * Math.PI * 2,
      bounced: 0
    });
    const makeHail = (): P => ({
      x: rnd() * w,
      y: rnd() * h,
      vx: 90 + wind * 160,
      vy: 620 + i * 380 + rnd() * 160,
      len: 0,
      r: 1.4 + rnd() * (1.2 + i * 1.2),
      a: 0.85,
      kind: 'hail',
      ph: 0,
      bounced: 0
    });

    const build = () => {
      const area = w * h;
      parts = [];
      splashes = [];
      if (spec.precip === 'drizzle') {
        const n = Math.max(26, Math.min(160, Math.round(area * (0.0003 + 0.0006 * i))));
        for (let k = 0; k < n; k++) parts.push(makeRain(true));
      } else if (spec.precip === 'rain') {
        const n = Math.max(30, Math.min(340, Math.round(area * (0.00032 + 0.001 * i))));
        for (let k = 0; k < n; k++) parts.push(makeRain(false));
      } else if (spec.precip === 'snow') {
        const n = Math.max(28, Math.min(220, Math.round(area * (0.0003 + 0.0008 * i))));
        for (let k = 0; k < n; k++) parts.push(makeSnow());
      } else if (spec.precip === 'hail') {
        const nh = Math.max(18, Math.min(110, Math.round(area * (0.00012 + 0.0004 * i))));
        for (let k = 0; k < nh; k++) parts.push(makeHail());
        if (spec.rainAlso) {
          const nr = Math.max(26, Math.min(220, Math.round(area * (0.0003 + 0.0006 * i))));
          for (let k = 0; k < nr; k++) parts.push(makeRain(false, 0.8));
        }
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      for (const p of parts) {
        ctx.globalAlpha = p.a;
        if (p.kind === 'rain') {
          const sp = Math.hypot(p.vx, p.vy);
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = i > 0.6 ? 1.3 : 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx / sp) * p.len, p.y - (p.vy / sp) * p.len);
          ctx.stroke();
        } else if (p.kind === 'snow') {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#e0f2fe';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = p.a * 0.7;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.38, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // piccoli schizzi sul fondo con pioggia forte
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1;
      for (const s of splashes) {
        const t = s.age / s.max;
        ctx.globalAlpha = 0.35 * (1 - t);
        ctx.beginPath();
        ctx.ellipse(s.x, h - 1.5, 2 + t * 7, 0.8 + t * 1.6, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      for (const p of parts) {
        if (p.kind === 'snow') {
          p.ph += dt * (0.8 + p.r * 0.25);
          p.x += (p.vx + Math.sin(p.ph) * 18) * dt;
          p.y += p.vy * dt;
          if (p.y > h + 4) {
            p.y = -4;
            p.x = rnd() * w;
          }
          if (p.x > w + 6) p.x = -6;
        } else if (p.kind === 'hail') {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y >= h - p.r && p.bounced === 0) {
            p.bounced = 1;
            p.y = h - p.r;
            p.vy = -p.vy * 0.32;
          } else if (p.bounced === 1) {
            p.vy += 1800 * dt;
            p.a -= dt * 1.5;
            if (p.a <= 0 || (p.vy > 0 && p.y >= h - p.r)) {
              p.bounced = 0;
              p.a = 0.85;
              p.y = -4;
              p.x = rnd() * w;
              p.vy = 620 + i * 380 + rnd() * 160;
            }
          }
          if (p.x > w + 6) p.x = -6;
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.y > h) {
            if (i > 0.45 && spec.precip === 'rain' && splashes.length < 26 && rnd() < 0.18) {
              splashes.push({ x: p.x, age: 0, max: 0.35 });
            }
            p.y = -p.len;
            p.x = rnd() * (w + 80) - 40;
          }
          if (p.x > w + 40) p.x = -40;
        }
      }
      for (let k = splashes.length - 1; k >= 0; k--) {
        splashes[k].age += dt;
        if (splashes[k].age >= splashes[k].max) splashes.splice(k, 1);
      }
      draw();
    };

    const running = () => !reduceMotion && onScreen && tabVisible;
    const sync = () => {
      cancelAnimationFrame(raf);
      if (running()) {
        last = performance.now();
        raf = requestAnimationFrame(step);
      }
    };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      draw();
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((entries) => {
            onScreen = entries[0]?.isIntersecting ?? true;
            sync();
          })
        : null;
    io?.observe(canvas);
    const onVis = () => {
      tabVisible = !document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVis);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [spec.precip, spec.intensity, spec.rainAlso, windKmH]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full" aria-hidden="true" />;
};

export const WeatherScene: React.FC<WeatherSceneProps> = ({ code, isDay, precipitationMm = 0, windKmH = 0, compact = false, className = '' }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const spec = useMemo(() => describeScene(code, isDay, precipitationMm), [code, isDay, precipitationMm]);

  const clouds = useMemo(() => {
    const rnd = mulberry32(code * 31 + (isDay ? 1 : 2));
    const speed = 1 / (1 + windKmH / 22);
    const n = spec.clouds;
    return Array.from({ length: n }, (_, k) => {
      const widthPct = 46 + rnd() * 30;
      const dur = (95 + rnd() * 80) * speed * (spec.precip === 'none' ? 1 : 0.8);
      const denser = spec.cloudTone === 'light' ? 0.34 : spec.cloudTone === 'grey' ? 0.4 : 0.5;
      return {
        top: 1 + (k / Math.max(n, 1)) * 44 + rnd() * 10,
        widthPct,
        dur,
        delay: -rnd() * dur,
        rest: Math.round(rnd() * 70) - 10,
        opacity: denser + rnd() * 0.16
      };
    });
  }, [code, isDay, windKmH, spec.clouds, spec.cloudTone, spec.precip]);

  const stars = useMemo(() => {
    if (!spec.stars) return [];
    const rnd = mulberry32(99);
    const count = spec.clouds >= 3 ? 12 : 30;
    return Array.from({ length: count }, () => ({
      left: rnd() * 97,
      top: rnd() * 68,
      size: 1 + rnd() * 1.8,
      d: 2.6 + rnd() * 3.2,
      l: -rnd() * 5
    }));
  }, [spec.stars, spec.clouds]);

  const colors = CLOUD_COLORS[spec.cloudTone][isDay ? 'day' : 'night'];

  return (
    <div className={`wx-scene ${className}`} aria-hidden="true" data-weather-scene={`${code}-${isDay ? 'day' : 'night'}`}>
      <style>{WX_CSS}</style>

      {stars.map((s, k) => (
        <span key={k} className="wx-star" style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, ['--d' as string]: `${s.d}s`, ['--l' as string]: `${s.l}s` }} />
      ))}

      {spec.celestial === 'sun' && (
        <div className="wx-celestial" style={{ right: compact ? '4%' : '6%', top: compact ? '17%' : '5%', width: compact ? 'clamp(74px, 26%, 108px)' : 'clamp(84px, 22%, 190px)', aspectRatio: '1 / 1', opacity: spec.celestialDim }}>
          <div className="wx-sun-rays" />
          <div className="wx-sun-glow" />
          <div className="wx-sun-core" />
        </div>
      )}

      {spec.celestial === 'moon' && (
        <div className="wx-celestial" style={{ right: compact ? '6%' : '7%', top: compact ? '17%' : '5%', width: compact ? 'clamp(62px, 22%, 92px)' : 'clamp(70px, 17%, 150px)', aspectRatio: '1 / 1', opacity: spec.celestialDim }}>
          <div className="wx-moon-glow" />
          <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <defs>
              <radialGradient id={`${uid}-moon`} cx="35%" cy="35%" r="80%">
                <stop offset="0" stopColor="#f5f7ff" />
                <stop offset="1" stopColor="#a5b4fc" />
              </radialGradient>
              <mask id={`${uid}-cut`}>
                <rect width="100" height="100" fill="#fff" />
                <circle cx="64" cy="38" r="33" fill="#000" />
              </mask>
            </defs>
            <circle cx="46" cy="52" r="34" fill={`url(#${uid}-moon)`} mask={`url(#${uid}-cut)`} />
          </svg>
        </div>
      )}

      {spec.fog &&
        [22, 46, 68].map((top, k) => (
          <div key={top} className="wx-fog" style={{ top: `${top}%`, height: '26%', ['--d' as string]: `${24 + k * 7}s` }} />
        ))}

      {clouds.map((c, k) => (
        <div
          key={k}
          className="wx-cloud"
          style={{
            top: `${c.top}%`,
            ['--w' as string]: `min(${c.widthPct}cqw, ${compact ? 300 : 380}px)`,
            ['--dur' as string]: `${c.dur}s`,
            ['--delay' as string]: `${c.delay}s`,
            ['--rest' as string]: `${c.rest}cqw`
          }}
        >
          <CloudShape id={`${uid}-c${k}`} top={colors[0]} bottom={colors[1]} opacity={c.opacity} />
        </div>
      ))}

      {spec.precip !== 'none' && <PrecipCanvas spec={spec} windKmH={windKmH} />}

      {spec.lightning && (
        <>
          <div className="wx-flash" style={{ ['--x' as string]: '66%', ['--d' as string]: '9s', ['--l' as string]: '-3s' }} />
          <svg className="wx-bolt" viewBox="0 0 60 100" preserveAspectRatio="none" style={{ left: '60%', ['--d' as string]: '9s', ['--l' as string]: '-3s' }}>
            <polyline points="32,0 22,34 37,36 17,72 28,74 12,100" fill="none" stroke="#f5f3ff" strokeWidth="2.2" strokeLinejoin="round" />
          </svg>
          <div className="wx-flash" style={{ ['--x' as string]: '24%', ['--d' as string]: '13s', ['--l' as string]: '-8s', animationDuration: '13s' }} />
        </>
      )}
    </div>
  );
};
