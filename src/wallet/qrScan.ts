/**
 * Lettura di codici (QR, Aztec, PDF417…) da una foto o da un fotogramma della fotocamera.
 * Usa il lettore del telefono (BarcodeDetector, Chrome su Android) quando c'è, altrimenti jsQR per i QR.
 * Tutto avviene sul telefono: nessuna immagine esce dal dispositivo.
 */
export interface ScanResult {
  text: string;
  /** qr_code, aztec, pdf417, data_matrix… */
  format: string;
}

type Source = ImageBitmap | HTMLVideoElement | HTMLCanvasElement;

interface Detector {
  detect: (src: Source) => Promise<{ rawValue: string; format: string }[]>;
}

let detectorPromise: Promise<Detector | null> | null = null;

function getDetector(): Promise<Detector | null> {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      try {
        const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
        if (!BD) return null;
        const supported = (await BD.getSupportedFormats?.()) ?? ['qr_code'];
        const formats = supported.filter((f) => ['qr_code', 'aztec', 'pdf417', 'data_matrix'].includes(f));
        return formats.length ? new BD({ formats }) : null;
      } catch {
        return null;
      }
    })();
  }
  return detectorPromise;
}

const dim = (s: Source) => (s instanceof HTMLVideoElement ? { w: s.videoWidth, h: s.videoHeight } : { w: (s as ImageBitmap).width, h: (s as ImageBitmap).height });

async function jsqrAt(src: Source, maxSide: number): Promise<ScanResult | null> {
  const { w, h } = dim(src);
  if (!w || !h) return null;
  const k = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k));
  const ch = Math.max(1, Math.round(h * k));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src as CanvasImageSource, 0, 0, cw, ch);
  const { default: jsQR } = await import('jsqr');
  const code = jsQR(ctx.getImageData(0, 0, cw, ch).data, cw, ch, { inversionAttempts: 'attemptBoth' });
  return code?.data ? { text: code.data, format: 'qr_code' } : null;
}

/** Un solo tentativo veloce (per i fotogrammi del video). */
export async function scanFrame(src: Source): Promise<ScanResult | null> {
  const det = await getDetector();
  if (det) {
    try {
      const r = await det.detect(src);
      if (r[0]?.rawValue) return { text: r[0].rawValue, format: r[0].format };
    } catch {
      /* fotogramma non pronto */
    }
    return null;
  }
  return jsqrAt(src, 720);
}

/** Lettura accurata di una foto: prova più risoluzioni. */
export async function scanBlob(blob: Blob): Promise<ScanResult | null> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob);
  } catch {
    return null;
  }
  try {
    const det = await getDetector();
    if (det) {
      try {
        const r = await det.detect(bmp);
        if (r[0]?.rawValue) return { text: r[0].rawValue, format: r[0].format };
      } catch {
        /* ripiego su jsQR */
      }
    }
    for (const side of [1600, 1000, 700, 450]) {
      const r = await jsqrAt(bmp, side);
      if (r) return r;
    }
    return null;
  } finally {
    bmp.close?.();
  }
}
