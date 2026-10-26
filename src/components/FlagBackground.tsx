import { useEffect, useRef } from 'react';

/**
 * Sfondo animato: la bandiera della Corea del Sud (Taegukgi) come un grande telo
 * che sventola. Il telo è disegnato in WebGL: la bandiera viene dipinta una volta
 * su un canvas (proporzioni ufficiali) e uno shader la deforma con onde che
 * viaggiano nel vento, calcolando pieghe, luci e ombre pixel per pixel.
 *
 * - riempie il contenitore a qualsiasi risoluzione (si ricalcola al resize)
 * - si ferma quando non è visibile o la scheda è in background
 * - con "riduci movimento" mostra un fotogramma fermo
 * - senza WebGL ripiega su una bandiera statica disegnata in 2D
 */

const RED = '#CD2E3A';
const BLUE = '#0047A0';
const BLACK = '#111111';
const WHITE = '#FFFFFF';

function drawTaegukgi(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.scale(w / 360, h / 240);
  ctx.fillStyle = WHITE;
  ctx.fillRect(0, 0, 360, 240);

  // Taeguk: asse lungo la diagonale ☰–☷, rosso sopra e blu sotto
  const a = Math.atan2(240, 360);
  ctx.save();
  ctx.translate(180, 120);
  ctx.rotate(a);
  ctx.fillStyle = BLUE;
  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.moveTo(-60, 0);
  ctx.arc(0, 0, 60, Math.PI, 0, false);
  ctx.arc(30, 0, 30, 0, Math.PI, true);
  ctx.arc(-30, 0, 30, 0, Math.PI, false);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Trigrammi (true = barra intera)
  const t = Math.PI / 2 - a;
  const trigrams: [number, boolean[]][] = [
    [-t, [true, true, true]], // ☰ in alto a sinistra
    [t, [false, true, false]], // ☵ in alto a destra
    [-(Math.PI - t), [true, false, true]], // ☲ in basso a sinistra
    [Math.PI - t, [false, false, false]], // ☷ in basso a destra
  ];
  ctx.fillStyle = BLACK;
  for (const [rot, bars] of trigrams) {
    ctx.save();
    ctx.translate(180, 120);
    ctx.rotate(rot);
    bars.forEach((solid, i) => {
      const y = -100 - i * 15;
      if (solid) ctx.fillRect(-30, y, 60, 10);
      else {
        ctx.fillRect(-30, y, 27.5, 10);
        ctx.fillRect(2.5, y, 27.5, 10);
      }
    });
    ctx.restore();
  }
  ctx.restore();
}

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Coordinate "bandiera": 360 x 240 unità; fuori dal rettangolo il telo prosegue bianco.
const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes;      // pixel del canvas
uniform vec2 uCenter;   // centro della bandiera (pixel, y verso il basso)
uniform float uScale;   // pixel per unità bandiera
uniform float uTime;

float waves(vec2 p, float t) {
  float g = 0.8 + 0.2 * sin(t * 0.37) + 0.1 * sin(t * 0.91 + 1.7); // raffiche
  float h = 0.0;
  h += 7.0 * sin(dot(p, vec2(0.034, 0.010)) - t * 1.55);
  h += 3.6 * sin(dot(p, vec2(0.061, -0.024)) - t * 2.25 + 1.3);
  h += 1.7 * sin(dot(p, vec2(0.118, 0.041)) - t * 3.4 + 2.1);
  h += 0.7 * sin(dot(p, vec2(0.21, -0.09)) - t * 4.6 + 0.4);
  return h * g;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (px - uCenter) / uScale + vec2(180.0, 120.0);

  float e = 0.6;
  float h  = waves(p, uTime);
  float hx = (waves(p + vec2(e, 0.0), uTime) - h) / e;
  float hy = (waves(p + vec2(0.0, e), uTime) - h) / e;

  // il tessuto si "raccoglie" nelle pieghe: sposto il campionamento lungo il gradiente
  vec2 q = p + vec2(hx, hy) * 2.4 + vec2(0.0, h * 0.18);
  vec2 uv = q / vec2(360.0, 240.0);
  vec3 col = texture2D(uTex, clamp(uv, 0.0, 1.0)).rgb;

  vec3 n = normalize(vec3(-hx * 1.25, -hy * 1.25, 1.0));
  vec3 L = normalize(vec3(-0.45, -0.55, 0.75));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 Hh = normalize(L + V);
  float spec = pow(clamp(dot(n, Hh), 0.0, 1.0), 28.0);
  float occl = smoothstep(-9.0, 6.0, h); // fondo delle pieghe più scuro

  // trama del tessuto, appena percettibile
  float weave = 0.985 + 0.015 * sin(px.x * 2.2) * sin(px.y * 2.2);

  vec3 lit = col * (0.34 + 0.78 * diff) * mix(0.62, 1.0, occl) * weave;
  lit += vec3(1.0, 0.98, 0.95) * spec * 0.16;
  gl_FragColor = vec4(lit, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

/** Dove sta la bandiera dentro il contenitore: tutta in altezza, centrata, mai troppo piccola. */
function placement(W: number, H: number) {
  const byHeight = (H * 1.08) / 240;
  const byWidth = (W * 0.62) / 360;
  const scale = Math.max(byHeight, byWidth);
  return { scale, cx: W * 0.5, cy: H * 0.5 };
}

export default function FlagBackground({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wrap = canvas.parentElement ?? canvas;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // Texture della bandiera, nitida anche su schermi grandi
    const tex = document.createElement('canvas');
    tex.width = 2160;
    tex.height = 1440;
    const tctx = tex.getContext('2d');
    if (!tctx) return;
    drawTaegukgi(tctx, tex.width, tex.height);

    const gl = (canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) ??
      null) as WebGLRenderingContext | null;

    let W = 0;
    let H = 0;
    const size = () => {
      const isSmall = wrap.clientWidth < 640;
      const dpr = Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 1.25);
      W = Math.max(1, Math.round(wrap.clientWidth * dpr));
      H = Math.max(1, Math.round(wrap.clientHeight * dpr));
      canvas.width = W;
      canvas.height = H;
    };

    // ---- Ripiego 2D (niente WebGL) ----
    if (!gl) {
      const ctx = canvas.getContext('2d');
      const draw2d = () => {
        size();
        if (!ctx) return;
        const { scale, cx, cy } = placement(W, H);
        ctx.fillStyle = WHITE;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(tex, cx - 180 * scale, cy - 120 * scale, 360 * scale, 240 * scale);
        canvas.style.opacity = '1';
      };
      draw2d();
      const ro2 = new ResizeObserver(draw2d);
      ro2.observe(wrap);
      return () => ro2.disconnect();
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, tex);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uCenter = gl.getUniformLocation(prog, 'uCenter');
    const uScale = gl.getUniformLocation(prog, 'uScale');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);

    const layout = () => {
      size();
      gl.viewport(0, 0, W, H);
      const { scale, cx, cy } = placement(W, H);
      gl.uniform2f(uRes, W, H);
      gl.uniform2f(uCenter, cx, cy);
      gl.uniform1f(uScale, scale);
    };
    const t0 = performance.now();
    const render = (now: number) => {
      gl.uniform1f(uTime, reduceMotion ? 2.4 : (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    let raf = 0;
    let running = false;
    let visible = true;
    const loop = (now: number) => {
      render(now);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running || reduceMotion || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    layout();
    render(performance.now());
    canvas.style.opacity = '1';
    start();

    const ro = new ResizeObserver(() => {
      layout();
      render(performance.now());
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(wrap);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-1000"
      />
      {/* velo scuro per leggere testo e riquadri sopra la bandiera */}
      <div className="absolute inset-0 bg-slate-950/40" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/15 to-slate-950/55" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/80 to-transparent" />
    </div>
  );
}
