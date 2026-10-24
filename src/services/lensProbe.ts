// Riconoscimento degli obiettivi di un telefono dal campo visivo.
//
// Il browser (Chrome su Android) chiama gli obiettivi "camera2 0, facing back", "camera2 2, facing back"…
// senza dire quale sia ultra grandangolare o tele. Qui si misura: la stessa scena viene ripresa da due
// obiettivi e si cerca di quanto cambia l'ingrandimento (la parte centrale di un'immagine, ingrandita,
// deve coincidere con l'altra). Se la corrispondenza non è netta non si afferma nulla.
//
// Modulo senza dipendenze dal browser: lavora su immagini in scala di grigi.

export interface GrayFrame {
  w: number;
  h: number;
  data: Float32Array;
}

export interface MagEstimate {
  /** Ingrandimento dell'altro obiettivo rispetto al principale (0.5 = vede il doppio, 3 = vede un terzo) */
  mag: number;
  /** Somiglianza (correlazione normalizzata, da -1 a 1) tra le due immagini dopo l'allineamento */
  score: number;
  /** Quanto il risultato migliore supera le alternative con un ingrandimento molto diverso */
  margin: number;
}

const GRID_W = 64;
const GRID_H = 48;
const MIN_MAG = 0.3;
const MAX_MAG = 6;

function sampleRegion(f: GrayFrame, cx: number, cy: number, rw: number, rh: number, out: Float32Array): void {
  const { w, h, data } = f;
  for (let gy = 0; gy < GRID_H; gy++) {
    const sy = Math.min(h - 1.001, Math.max(0, cy + ((gy + 0.5) / GRID_H - 0.5) * rh));
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    for (let gx = 0; gx < GRID_W; gx++) {
      const sx = Math.min(w - 1.001, Math.max(0, cx + ((gx + 0.5) / GRID_W - 0.5) * rw));
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const i = y0 * w + x0;
      out[gy * GRID_W + gx] =
        data[i] * (1 - fx) * (1 - fy) + data[i + 1] * fx * (1 - fy) + data[i + w] * (1 - fx) * fy + data[i + w + 1] * fx * fy;
    }
  }
}

function ncc(a: Float32Array, b: Float32Array): number {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  if (saa < 1e-6 || sbb < 1e-6) return -1;
  return sab / Math.sqrt(saa * sbb);
}

/** Deviazione standard dei grigi: una scena uniforme (muro, buio) non permette di confrontare */
export function frameContrast(f: GrayFrame): number {
  const n = f.data.length;
  let m = 0;
  for (let i = 0; i < n; i++) m += f.data[i];
  m /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (f.data[i] - m) ** 2;
  return Math.sqrt(v / n);
}

export function estimateMagnification(main: GrayFrame, other: GrayFrame): MagEstimate | null {
  if (main.w < 32 || other.w < 32) return null;
  const wholeMain = new Float32Array(GRID_W * GRID_H);
  const wholeOther = new Float32Array(GRID_W * GRID_H);
  sampleRegion(main, main.w / 2, main.h / 2, main.w, main.h, wholeMain);
  sampleRegion(other, other.w / 2, other.h / 2, other.w, other.h, wholeOther);
  const patch = new Float32Array(GRID_W * GRID_H);

  // m >= 1: l'altro obiettivo vede la parte centrale del principale; m < 1: il principale vede la parte centrale dell'altro
  const score = (m: number, dx: number, dy: number): number => {
    if (m >= 1) {
      sampleRegion(main, main.w / 2 + dx, main.h / 2 + dy, main.w / m, main.h / m, patch);
      return ncc(patch, wholeOther);
    }
    sampleRegion(other, other.w / 2 + dx, other.h / 2 + dy, other.w * m, other.h * m, patch);
    return ncc(patch, wholeMain);
  };

  // Scale esplorate (progressione geometrica) e piccoli spostamenti, perché gli obiettivi sono a qualche cm l'uno dall'altro
  const steps = 72;
  const offsets = [-8, -4, 0, 4, 8];
  const perScale: { m: number; s: number; dx: number; dy: number }[] = [];
  for (let i = 0; i < steps; i++) {
    const m = MIN_MAG * Math.pow(MAX_MAG / MIN_MAG, i / (steps - 1));
    let best = { m, s: -2, dx: 0, dy: 0 };
    for (const dy of offsets) {
      for (const dx of offsets) {
        const s = score(m, dx, dy);
        if (s > best.s) best = { m, s, dx, dy };
      }
    }
    perScale.push(best);
  }
  let best = perScale.reduce((a, b) => (b.s > a.s ? b : a));

  // Affinamento attorno al massimo
  let refined = best;
  for (let k = -5; k <= 5; k++) {
    const m = best.m * (1 + k * 0.01);
    if (m < MIN_MAG || m > MAX_MAG) continue;
    for (let dy = best.dy - 3; dy <= best.dy + 3; dy += 1.5) {
      for (let dx = best.dx - 3; dx <= best.dx + 3; dx += 1.5) {
        const s = score(m, dx, dy);
        if (s > refined.s) refined = { m, s, dx, dy };
      }
    }
  }
  best = refined;

  // Alternative con ingrandimento molto diverso (oltre ±40%): se si avvicinano al migliore il risultato è ambiguo.
  // Scale vicine si somigliano sempre un po', soprattutto con scene sfumate: non contano.
  let other2 = -1;
  for (const p of perScale) {
    if (Math.abs(Math.log(p.m / best.m)) > 0.34 && p.s > other2) other2 = p.s;
  }
  return { mag: best.m, score: best.s, margin: best.s - other2 };
}

export type MeasuredKind = 'ultra' | 'tele';

export interface LensVerdict {
  kind: MeasuredKind;
  /** Ingrandimento rispetto al principale, arrotondato (0.5, 0.6… per l'ultra, 2, 2.5, 3… per il tele) */
  mag: number;
}

/** Trasforma la misura in un verdetto, oppure null se non è abbastanza sicura o l'inquadratura è simile al principale */
export function verdictFromEstimate(e: MagEstimate | null): LensVerdict | null {
  if (!e || e.score < 0.5 || e.margin < 0.06) return null;
  if (e.mag < 0.8) {
    const snapped = Math.abs(e.mag - 0.5) < 0.08 ? 0.5 : Math.round(e.mag * 10) / 10;
    return { kind: 'ultra', mag: snapped };
  }
  if (e.mag > 1.4) return { kind: 'tele', mag: Math.round(e.mag * 2) / 2 };
  return null;
}
