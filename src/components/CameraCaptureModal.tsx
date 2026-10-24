import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, ScanSearch, Smartphone, X, Zap, ZapOff } from 'lucide-react';
import { assignLenses, estimateMagnification, frameContrast, type GrayFrame } from '../services/lensProbe';

interface CameraCaptureModalProps {
  /** Foto scattata (JPEG) */
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Apre l'app Fotocamera di sistema (su Android può chiudere l'app durante lo scatto) */
  onUseSystemCamera: () => void;
}

/** Zoom digitale usato quando la fotocamera non espone lo zoom ottico/hardware */
const DIGITAL_ZOOM_MAX = 4;
/** Oltre questo valore lo zoom hardware è solo ingrandimento e peggiora la foto */
const HARDWARE_ZOOM_CAP = 10;
/** Un ultra grandangolare inquadra circa il doppio del principale: se non misurato, lo zoom mostrato parte da 0.5× */
const ULTRA_DEFAULT_MAG = 0.5;
/** Zoom massimo mostrato quando si può passare a un teleobiettivo dedicato */
const TELE_DISPLAY_CAP = 30;

// v2: le misure della v1 davano per scontato che l'obiettivo aperto di default fosse il principale (sbagliato su alcuni telefoni)
const LENS_INFO_KEY = 'seul2027_lens_info_v2';
const MAIN_LENS_KEY = 'seul2027_main_lens_v2';
const ASPECT_KEY = 'seul2027_camera_aspect';

type ZoomMode = 'hardware' | 'digital';

interface CameraCaps {
  zoom?: { min: number; max: number; step?: number };
  torch?: boolean;
  focusMode?: string[];
}

interface ImageCaptureLike {
  takePhoto(): Promise<Blob>;
}

type LensKind = 'ultra' | 'tele' | 'macro' | 'other';
/** main = obiettivo predefinito del telefono; ultra/tele = obiettivi separati di cui si conosce l'ingrandimento; other = senza ruolo noto */
type LensRole = 'main' | 'ultra' | 'tele' | 'other';

/** Cosa si sa di un obiettivo: detto dall'utente o misurato dall'app (mai supposto) */
interface LensInfo {
  kind: LensKind;
  /** Ingrandimento rispetto al principale, se misurato */
  mag?: number;
  origin: 'user' | 'measured';
}

interface RawLens {
  id: string;
  label: string;
}

/** Obiettivo posteriore esposto dal browser */
interface Lens {
  id: string;
  name: string;
  kind: LensKind;
  /** Ingrandimento rispetto al principale (0.5 ultra, 3 tele…). 1 se non noto */
  mag: number;
  magKnown: boolean;
  origin: 'label' | 'user' | 'measured' | 'none';
}

const FRONT_RE = /front|user|selfie|anterior|frontale/i;
const BACK_RE = /back|rear|environment|posterior|trasera|arri[eè]re/i;
// Sensori che non servono per scattare foto (profondità, infrarossi, ...)
const IGNORE_RE = /depth|tof|infrared|\bir\b|mono|bokeh/i;

function lensKindFromLabel(label: string): LensKind {
  if (/ultra|grandangol/i.test(label)) return 'ultra';
  if (/tele|periscop/i.test(label)) return 'tele';
  if (/macro/i.test(label)) return 'macro';
  return 'other';
}

const fmtMag = (m: number) => `${Number.isInteger(m) ? m : m.toFixed(1)}×`;

function loadLensInfo(): Record<string, LensInfo> {
  try {
    const raw = localStorage.getItem(LENS_INFO_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LensInfo>) : {};
  } catch {
    return {};
  }
}

function loadMainOverride(): string | null {
  try {
    return localStorage.getItem(MAIN_LENS_KEY);
  } catch {
    return null;
  }
}

function saveMainOverride(id: string | null): void {
  try {
    if (id) localStorage.setItem(MAIN_LENS_KEY, id);
    else localStorage.removeItem(MAIN_LENS_KEY);
  } catch {
    /* ignora */
  }
}

function saveLensInfo(info: Record<string, LensInfo>): void {
  try {
    localStorage.setItem(LENS_INFO_KEY, JSON.stringify(info));
  } catch {
    /* archiviazione non disponibile: la scelta vale solo finché la fotocamera è aperta */
  }
}

/**
 * Obiettivi posteriori con il loro nome. Il browser dice di che tipo sono solo a volte (nel nome del dispositivo):
 * altrimenti valgono quanto detto dall'utente o misurato dall'app, e in mancanza di entrambi restano "Obiettivo N".
 * Il principale è sempre quello che il telefono apre di default.
 */
function buildLenses(raw: RawLens[], info: Record<string, LensInfo>, mainId: string | null): Lens[] {
  const sorted = [...raw].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  const main = mainId ? sorted.find((r) => r.id === mainId) : sorted[0];
  const ordered = main ? [main, ...sorted.filter((r) => r !== main)] : sorted;
  let n = 1;
  return ordered.map((r) => {
    if (r === main) {
      return { id: r.id, name: 'Principale', kind: 'other', mag: 1, magKnown: true, origin: 'none' } as Lens;
    }
    n += 1;
    const saved = info[r.id];
    const labelKind = lensKindFromLabel(r.label);
    const kind = saved?.kind ?? labelKind;
    const origin: Lens['origin'] = saved ? saved.origin : labelKind !== 'other' ? 'label' : 'none';
    let mag = 1;
    let magKnown = false;
    if (kind === 'ultra') {
      mag = saved?.mag ?? ULTRA_DEFAULT_MAG;
      magKnown = true;
    } else if (kind === 'tele' && saved?.mag) {
      mag = saved.mag;
      magKnown = true;
    }
    let name = `Obiettivo ${n}`;
    if (kind === 'ultra') name = 'Ultra grandangolare';
    else if (kind === 'tele') name = magKnown ? `Teleobiettivo ${fmtMag(mag)}` : 'Teleobiettivo';
    else if (kind === 'macro') name = 'Macro';
    return { id: r.id, name, kind, mag, magKnown, origin };
  });
}

function lensRole(lens: Lens | null, mainId: string | null): LensRole {
  if (!lens || lens.id === mainId) return 'main';
  if (lens.kind === 'ultra') return 'ultra';
  if (lens.kind === 'tele' && lens.magKnown) return 'tele';
  return 'other';
}

type AspectId = '4:3' | '1:1' | '16:9' | 'full';
const ASPECTS: AspectId[] = ['4:3', '1:1', '16:9', 'full'];
const ASPECT_LABEL: Record<AspectId, string> = { '4:3': '4:3', '1:1': '1:1', '16:9': '16:9', full: 'Intero' };

function loadAspect(): AspectId {
  try {
    const v = localStorage.getItem(ASPECT_KEY) as AspectId | null;
    if (v && ASPECTS.includes(v)) return v;
  } catch {
    /* ignora */
  }
  return '4:3';
}

/** Larghezza / altezza della foto: 4:3 e 16:9 seguono l'orientamento dell'inquadratura */
function aspectValue(id: AspectId, portrait: boolean, areaW: number, areaH: number): number {
  switch (id) {
    case '1:1':
      return 1;
    case '16:9':
      return portrait ? 9 / 16 : 16 / 9;
    case 'full':
      return areaW > 0 && areaH > 0 ? areaW / areaH : portrait ? 9 / 16 : 16 / 9;
    default:
      return portrait ? 3 / 4 : 4 / 3;
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const touchDistance = (touches: React.TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

/** Ritaglio centrale con le proporzioni volute */
function fitRegion(w: number, h: number, aspect: number): { sw: number; sh: number } {
  if (w / h > aspect) return { sw: h * aspect, sh: h };
  return { sw: w, sh: w / aspect };
}

/** Fotogramma dal video, con ritaglio centrale per lo zoom digitale e per il formato scelto */
function grabFrame(video: HTMLVideoElement, digitalZoom: number, aspect: number): Promise<Blob | null> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const { sw, sh } = fitRegion(vw / digitalZoom, vh / digitalZoom, aspect);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  canvas.getContext('2d')?.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

/** Porta una foto già scattata (piena risoluzione) al formato scelto */
async function cropBlobToAspect(blob: Blob, aspect: number, videoPortrait: boolean): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob;
  }
  const bw = bitmap.width;
  const bh = bitmap.height;
  // Se la foto è girata rispetto all'anteprima, le proporzioni si invertono
  const a = aspect !== 1 && bh >= bw !== videoPortrait ? 1 / aspect : aspect;
  if (Math.abs(bw / bh - a) < 0.01) {
    bitmap.close?.();
    return blob;
  }
  const { sw, sh } = fitRegion(bw, bh, a);
  // Sensori da 50-200 MP: si limita la dimensione per non esaurire la memoria
  const shrink = Math.min(1, Math.sqrt(24_000_000 / (sw * sh)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * shrink);
  canvas.height = Math.round(sh * shrink);
  canvas.getContext('2d')?.drawImage(bitmap, (bw - sw) / 2, (bh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  return out ?? blob;
}

/** Una ripresa in piccolo e in scala di grigi da un obiettivo, per confrontare i campi visivi */
async function probeFrame(deviceId: string | null, portrait: boolean, alive: () => boolean): Promise<GrayFrame | null> {
  const constraints = {
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } }),
    width: { ideal: 640 },
    height: { ideal: 480 },
  } as MediaTrackConstraints;
  let stream: MediaStream | null = null;
  for (let attempt = 0; attempt < 3 && !stream && alive(); attempt++) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
    } catch {
      await sleep(350);
    }
  }
  if (!stream) return null;
  const track = stream.getVideoTracks()[0];
  const video = document.createElement('video');
  try {
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    for (let i = 0; i < 30 && !video.videoWidth && alive(); i++) await sleep(100);
    if (!video.videoWidth || !alive()) return null;
    // Zoom a 1× (i telefoni con più obiettivi in uno possono aprirsi già ingranditi)
    const caps = (track.getCapabilities?.() ?? {}) as CameraCaps;
    if (caps.zoom && caps.zoom.min <= 1 && caps.zoom.max >= 1) {
      await track.applyConstraints({ advanced: [{ zoom: 1 } as MediaTrackConstraintSet] }).catch(() => undefined);
    }
    // Il tempo che serve a esposizione e fuoco per assestarsi
    await sleep(900);
    if (!alive()) return null;

    const W = portrait ? 240 : 320;
    const H = portrait ? 320 : 240;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const { sw, sh } = fitRegion(vw, vh, W / H);
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const data = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) data[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    return { w: W, h: H, data };
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  }
}

/**
 * Fotocamera dentro l'app, usata su Android: con l'app Fotocamera di sistema Android può chiudere
 * l'app durante lo scatto e la foto andrebbe persa. Offre zoom (pizzico, pulsanti e cursore),
 * flash, tocco per mettere a fuoco, scelta dell'obiettivo, formato della foto e foto a piena risoluzione dove possibile.
 *
 * Obiettivi: il browser quasi mai dice quale lente sia ultra grandangolare o tele. L'app afferma un tipo solo se
 * lo dichiara il nome, lo ha detto l'utente o lo ha misurato confrontando il campo visivo con quello del principale
 * ("Riconosci"). Altrimenti l'obiettivo resta "Obiettivo N" e non si cambia da solo.
 */
export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ onCapture, onClose, onUseSystemCamera }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Stessa ripresa, attenuata, che mostra anche ciò che resta fuori dal formato scelto
  const ghostRef = useRef<HTMLVideoElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  // Zoom da applicare quando la fotocamera si riapre dopo un cambio di obiettivo
  const pendingZoomRef = useRef<number | null>(null);
  // Cambio di obiettivo in corso: evita richieste doppie durante il pizzico
  const switchingRef = useRef(false);
  const lastMainMaxRef = useRef(DIGITAL_ZOOM_MAX);
  const aliveRef = useRef(true);
  const mainIdRef = useRef<string | null>(null);
  // Principale misurato dall'app (può non essere quello aperto di default dal telefono)
  const mainOverrideRef = useRef<string | null>(loadMainOverride());
  const lensInfoRef = useRef<Record<string, LensInfo>>({});

  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  // Obiettivo posteriore scelto (null = quello predefinito del telefono)
  const [deviceId, setDeviceId] = useState<string | null>(() => mainOverrideRef.current);
  const [restartKey, setRestartKey] = useState(0);
  const [rawLenses, setRawLenses] = useState<RawLens[]>([]);
  const [mainId, setMainId] = useState<string | null>(null);
  const [lensInfo, setLensInfo] = useState<Record<string, LensInfo>>(loadLensInfo);
  const [activeLensId, setActiveLensId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [zoomMode, setZoomMode] = useState<ZoomMode>('digital');
  // Limiti dello zoom dell'obiettivo aperto (hardware) e valore mostrato all'utente (rispetto al principale)
  const [hwMin, setHwMin] = useState(1);
  const [hwMax, setHwMax] = useState(DIGITAL_ZOOM_MAX);
  const [mainHwMin, setMainHwMin] = useState(1);
  const [zoom, setZoom] = useState(1);

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [focusSupported, setFocusSupported] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number; key: number } | null>(null);

  const [aspect, setAspect] = useState<AspectId>(loadAspect);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const [videoDims, setVideoDims] = useState({ w: 0, h: 0 });

  const [probing, setProbing] = useState<{ step: number; total: number } | null>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [menuLens, setMenuLens] = useState<Lens | null>(null);

  useEffect(() => {
    lensInfoRef.current = lensInfo;
  }, [lensInfo]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Avvio della fotocamera (e riavvio quando si cambia obiettivo, tra posteriore e frontale o dopo il riconoscimento)
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    setTorchOn(false);

    (async () => {
      try {
        const constraints = {
          ...(deviceId && facing === 'environment'
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: facing } }),
          width: { ideal: 1920 },
          height: { ideal: 1440 },
          // chiede l'accesso allo zoom della fotocamera dove il browser lo supporta
          zoom: true,
        } as unknown as MediaTrackConstraints;
        const stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const ghost = ghostRef.current;
        if (ghost) {
          ghost.srcObject = stream;
          ghost.play().catch(() => undefined);
        }

        const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
        const caps = (track.getCapabilities?.() ?? {}) as CameraCaps;
        const activeId = settings.deviceId ?? null;
        // L'obiettivo aperto senza sceglierlo è quello predefinito del telefono: il "Principale"
        if (facing === 'environment' && activeId) {
          const override = mainOverrideRef.current;
          const target = override ?? activeId;
          if (!deviceId || deviceId === override) {
            mainIdRef.current = target;
            setMainId(target);
          }
        }

        // Con il permesso concesso il browser mostra i nomi delle fotocamere: si cercano gli obiettivi posteriori
        let rawList: RawLens[] = [];
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (facing === 'environment') {
            rawList = devices
              .filter(
                (d) =>
                  d.kind === 'videoinput' &&
                  !!d.label &&
                  !FRONT_RE.test(d.label) &&
                  BACK_RE.test(d.label) &&
                  !IGNORE_RE.test(d.label)
              )
              .map((d) => ({ id: d.deviceId, label: d.label }));
          }
        } catch {
          rawList = [];
        }
        if (cancelled) return;

        // Il principale salvato non esiste più (permessi azzerati, fotocamera diversa): si torna al predefinito
        if (mainOverrideRef.current && rawList.length > 0 && !rawList.some((r) => r.id === mainOverrideRef.current)) {
          mainOverrideRef.current = null;
          saveMainOverride(null);
          setDeviceId(null);
          setRestartKey((k) => k + 1);
          return;
        }

        const built = buildLenses(rawList, lensInfoRef.current, mainIdRef.current);
        const role = lensRole(built.find((l) => l.id === activeId) ?? null, mainIdRef.current);
        const openedLens = built.find((l) => l.id === activeId) ?? null;
        const scale = (role === 'ultra' || role === 'tele') && openedLens ? openedLens.mag : 1;

        let mode: ZoomMode = 'digital';
        let min = 1;
        let max = DIGITAL_ZOOM_MAX;
        let initialHw = 1;
        if (caps.zoom && caps.zoom.max > caps.zoom.min) {
          mode = 'hardware';
          min = caps.zoom.min;
          max = Math.min(caps.zoom.max, HARDWARE_ZOOM_CAP);
          initialHw = settings.zoom ?? caps.zoom.min;
        }
        if (role === 'main') {
          lastMainMaxRef.current = max;
          setMainHwMin(min);
        }

        // Zoom richiesto prima del cambio di obiettivo (es. 0.9× dopo il passaggio all'ultra grandangolare)
        let hw = initialHw;
        const pending = pendingZoomRef.current;
        pendingZoomRef.current = null;
        if (pending != null) {
          hw = clamp(pending / scale, min, max);
          if (mode === 'hardware') {
            track.applyConstraints({ advanced: [{ zoom: hw } as MediaTrackConstraintSet] }).catch(() => undefined);
          }
        }

        setZoomMode(mode);
        setHwMin(min);
        setHwMax(max);
        setZoom(round1(scale * hw));
        setTorchSupported(!!caps.torch);
        setFocusSupported(Array.isArray(caps.focusMode) && caps.focusMode.includes('single-shot'));
        setRawLenses(rawList);
        setActiveLensId(activeId);
        setVideoDims({ w: video?.videoWidth ?? 0, h: video?.videoHeight ?? 0 });
        switchingRef.current = false;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        switchingRef.current = false;
        pendingZoomRef.current = null;
        // L'obiettivo scelto non si apre: si torna a quello predefinito
        if (deviceId) {
          if (deviceId === mainOverrideRef.current) {
            mainOverrideRef.current = null;
            saveMainOverride(null);
          }
          setDeviceId(null);
          return;
        }
        const name = (err as DOMException)?.name;
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setError('Permesso negato: consenti l\'uso della fotocamera a questo sito nelle impostazioni del browser.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('Non trovo nessuna fotocamera su questo dispositivo.');
        } else {
          setError('Non riesco ad aprire la fotocamera.');
        }
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      trackRef.current = null;
    };
  }, [facing, deviceId, restartKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuLens) setMenuLens(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, menuLens]);

  // Misura dell'area dell'anteprima, per adattare il riquadro al formato scelto
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 7000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const lenses = useMemo(() => buildLenses(rawLenses, lensInfo, mainId), [rawLenses, lensInfo, mainId]);
  const activeLens = lenses.find((l) => l.id === activeLensId) ?? null;
  const role = lensRole(activeLens, mainId);
  const ultraLens = lenses.find((l) => l.id !== mainId && l.kind === 'ultra' && l.mag < 1) ?? null;
  const teleLens = lenses.find((l) => l.id !== mainId && l.kind === 'tele' && l.magKnown && l.mag > 1) ?? null;
  // Sotto 1× si passa all'ultra separato solo se il principale non scende già sotto 1× da solo
  const ultraEligible = facing === 'environment' && !!ultraLens && mainHwMin >= 1;
  const teleEligible = facing === 'environment' && !!teleLens;
  // Zoom mostrato = zoom dell'obiettivo × ingrandimento dell'obiettivo (l'ultra grandangolare vale 0.5×, un tele 3× vale 3×…)
  const scale = (role === 'ultra' || role === 'tele') && activeLens ? activeLens.mag : 1;

  let displayMin = hwMin;
  let displayMax = hwMax;
  if (role === 'main') {
    displayMin = ultraEligible && ultraLens ? ultraLens.mag : hwMin;
    displayMax = teleEligible && teleLens ? Math.max(hwMax, Math.min(TELE_DISPLAY_CAP, teleLens.mag * 4)) : hwMax;
  } else if (role === 'ultra') {
    displayMin = scale * hwMin;
    displayMax =
      teleEligible && teleLens ? Math.min(TELE_DISPLAY_CAP, teleLens.mag * 4) : Math.max(lastMainMaxRef.current, 2);
  } else if (role === 'tele') {
    displayMin = ultraEligible && ultraLens ? ultraLens.mag : 1;
    displayMax = Math.min(TELE_DISPLAY_CAP, scale * hwMax);
  }

  /** Obiettivo giusto per uno zoom: 'MAIN' per il principale, altrimenti l'id dell'ultra o del tele */
  const wantedLens = useCallback(
    (next: number, current: LensRole): string => {
      if (ultraEligible && ultraLens && next < 1) return ultraLens.id;
      if (teleEligible && teleLens) {
        // piccola isteresi: per tornare al principale si scende un po' sotto la soglia
        const threshold = current === 'tele' ? teleLens.mag * 0.95 : teleLens.mag;
        if (next >= threshold) return teleLens.id;
      }
      return 'MAIN';
    },
    [ultraEligible, ultraLens, teleEligible, teleLens]
  );

  const applyZoom = useCallback(
    (value: number) => {
      let next = round1(clamp(value, displayMin, displayMax));

      if (role !== 'other') {
        if (switchingRef.current) {
          setZoom(next);
          pendingZoomRef.current = next;
          return;
        }
        if (role === 'tele' && teleLens && next >= teleLens.mag * 0.95 && next < teleLens.mag) next = teleLens.mag;
        const target = wantedLens(next, role);
        const current = role === 'main' ? 'MAIN' : (activeLens?.id ?? 'MAIN');
        // Cambio di obiettivo: ultra sotto 1×, tele dal suo ingrandimento in su, altrimenti il principale
        if (target !== current) {
          switchingRef.current = true;
          pendingZoomRef.current = next;
          setZoom(next);
          setDeviceId(target === 'MAIN' ? mainOverrideRef.current : target);
          return;
        }
      } else if (switchingRef.current) {
        setZoom(next);
        pendingZoomRef.current = next;
        return;
      }

      setZoom(next);
      if (zoomMode === 'hardware') {
        trackRef.current
          ?.applyConstraints({ advanced: [{ zoom: next / scale } as MediaTrackConstraintSet] })
          .catch(() => undefined);
      }
    },
    [displayMin, displayMax, role, teleLens, wantedLens, activeLens, zoomMode, scale]
  );

  const selectLens = (lens: Lens) => {
    if (switchingRef.current || probing) return;
    if (lens.id === activeLensId) {
      // Toccare l'obiettivo già attivo (non il principale) permette di dire che cos'è
      if (lens.id !== mainId) setMenuLens(lens);
      return;
    }
    switchingRef.current = true;
    pendingZoomRef.current = lensRole(lens, mainId) === 'ultra' || lensRole(lens, mainId) === 'tele' ? lens.mag : 1;
    setDeviceId(lens.id === mainId ? mainOverrideRef.current : lens.id);
  };

  /** L'utente dice che cos'è un obiettivo: la scelta vale su questo telefono */
  const labelLens = (lens: Lens, kind: LensKind | null) => {
    setLensInfo((prev) => {
      const next = { ...prev };
      if (kind === null) delete next[lens.id];
      else next[lens.id] = { kind, mag: prev[lens.id]?.kind === kind ? prev[lens.id].mag : undefined, origin: 'user' };
      saveLensInfo(next);
      lensInfoRef.current = next;
      return next;
    });
    setMenuLens(null);
    // Si riapre l'obiettivo per ripartire dallo zoom giusto (es. un ultra parte da 0.5×)
    if (lens.id === activeLensId) {
      switchingRef.current = true;
      pendingZoomRef.current = kind === 'ultra' ? ULTRA_DEFAULT_MAG : 1;
      setRestartKey((k) => k + 1);
    }
  };

  /**
   * Confronta il campo visivo di tutti gli obiettivi con quello aperto di default, per capire quale sia ultra grandangolare,
   * principale e tele. Il principale non si dà per scontato: su alcuni telefoni il predefinito è l'ultra grandangolare.
   */
  const probeLenses = async () => {
    const video = videoRef.current;
    if (probing || !ready || !video) return;
    const refLens = rawLenses.find((r) => r.id === mainId) ?? rawLenses[0];
    const targets = rawLenses.filter((r) => r.id !== refLens?.id);
    if (!refLens || targets.length === 0) return;
    const portrait = video.videoHeight >= video.videoWidth;
    const alive = () => aliveRef.current;
    setNotice(null);
    setProbing({ step: 0, total: targets.length + 1 });

    // Android apre una sola fotocamera alla volta: si ferma l'anteprima
    streamRef.current?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    if (ghostRef.current) ghostRef.current.srcObject = null;
    await sleep(350);

    let failure: string | null = null;
    let assignment: ReturnType<typeof assignLenses> = null;
    const ref = await probeFrame(refLens.id, portrait, alive);
    if (!ref) failure = 'Non riesco ad aprire gli obiettivi per confrontarli.';
    else if (frameContrast(ref) < 10) failure = 'La scena è troppo uniforme (buio o muro): inquadra qualcosa con molti dettagli.';

    if (!failure && ref) {
      const estimates: { id: string; est: ReturnType<typeof estimateMagnification> }[] = [];
      for (let i = 0; i < targets.length && alive(); i++) {
        setProbing({ step: i + 1, total: targets.length + 1 });
        await sleep(300);
        const frame = await probeFrame(targets[i].id, portrait, alive);
        estimates.push({ id: targets[i].id, est: frame ? estimateMagnification(ref, frame) : null });
      }
      if (alive()) assignment = assignLenses(refLens.id, estimates);
    }
    if (!alive()) return;

    if (assignment) {
      const next: Record<string, LensInfo> = {};
      for (const [id, o] of Object.entries(assignment.others)) next[id] = { kind: o.kind, mag: o.mag, origin: 'measured' };
      saveLensInfo(next);
      lensInfoRef.current = next;
      setLensInfo(next);
      mainOverrideRef.current = assignment.mainId;
      saveMainOverride(assignment.mainId);
      mainIdRef.current = assignment.mainId;
      setMainId(assignment.mainId);
      const rebuilt = buildLenses(rawLenses, next, assignment.mainId);
      setNotice({ ok: true, text: rebuilt.map((l) => l.name).join(' · ') });
    } else {
      setNotice({
        ok: false,
        text:
          failure ??
          'Non sono riuscito a riconoscere gli obiettivi. Riprova inquadrando una scena con molti dettagli, a qualche metro, tenendo fermo il telefono.',
      });
    }
    setProbing(null);
    // Riapre la fotocamera sul principale
    pendingZoomRef.current = null;
    switchingRef.current = false;
    setDeviceId(mainOverrideRef.current);
    setRestartKey((k) => k + 1);
  };

  const toggleTorch = () => {
    const next = !torchOn;
    trackRef.current
      ?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => undefined);
  };

  // Zoom digitale effettivo (solo se l'obiettivo non ha zoom hardware)
  const digitalZoom = zoomMode === 'digital' ? zoom / scale : 1;

  const videoPortrait = videoDims.w > 0 ? videoDims.h >= videoDims.w : area.h >= area.w;
  const targetAspect = aspectValue(aspect, videoPortrait, area.w, area.h);
  // Riquadro dell'anteprima: il formato scelto, il più grande possibile dentro l'area
  let boxStyle: React.CSSProperties = { width: '100%', height: '100%' };
  if (area.w > 0 && area.h > 0) {
    boxStyle =
      area.w / area.h > targetAspect
        ? { height: area.h, width: area.h * targetAspect }
        : { width: area.w, height: area.w / targetAspect };
  }

  const cycleAspect = () => {
    const next = ASPECTS[(ASPECTS.indexOf(aspect) + 1) % ASPECTS.length];
    setAspect(next);
    try {
      localStorage.setItem(ASPECT_KEY, next);
    } catch {
      /* ignora */
    }
  };

  // Tocco sull'anteprima: messa a fuoco in quel punto (dove il telefono lo supporta)
  const onPreviewTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!focusSupported || !ready) return;
    const areaRect = e.currentTarget.getBoundingClientRect();
    setFocusPoint({ x: e.clientX - areaRect.left, y: e.clientY - areaRect.top, key: Date.now() });
    const box = boxRef.current?.getBoundingClientRect();
    const video = videoRef.current;
    if (!box || !video || !box.width || !box.height) return;
    const bx = e.clientX - box.left;
    const by = e.clientY - box.top;
    if (bx < 0 || by < 0 || bx > box.width || by > box.height) return;
    // Dal punto toccato al punto nel fotogramma: il video riempie il riquadro tagliando i bordi, con zoom digitale al centro
    let nx = bx / box.width;
    let ny = by / box.height;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw && vh) {
      const k = Math.max(box.width / vw, box.height / vh);
      nx = (bx + (vw * k - box.width) / 2) / (vw * k);
      ny = (by + (vh * k - box.height) / 2) / (vh * k);
    }
    if (digitalZoom !== 1) {
      nx = 0.5 + (nx - 0.5) / digitalZoom;
      ny = 0.5 + (ny - 0.5) / digitalZoom;
    }
    if (facing === 'user') nx = 1 - nx;
    trackRef.current
      ?.applyConstraints({
        advanced: [
          { focusMode: 'single-shot', pointsOfInterest: [{ x: clamp(nx, 0, 1), y: clamp(ny, 0, 1) }] } as MediaTrackConstraintSet,
        ],
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!focusPoint) return;
    const id = window.setTimeout(() => setFocusPoint(null), 900);
    return () => window.clearTimeout(id);
  }, [focusPoint]);

  const takePhoto = async () => {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !video.videoWidth || busy || probing) return;
    setBusy(true);
    try {
      const portrait = video.videoHeight >= video.videoWidth;
      const wanted = aspectValue(aspect, portrait, area.w, area.h);
      let blob: Blob | null = null;
      // Foto a piena risoluzione del sensore (Android Chrome), con lo zoom hardware già applicato
      const ImageCaptureCtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike })
        .ImageCapture;
      const canUseFullRes = zoomMode === 'hardware' || digitalZoom === 1;
      if (ImageCaptureCtor && track && canUseFullRes) {
        try {
          const full = await new ImageCaptureCtor(track).takePhoto();
          blob = await cropBlobToAspect(full, wanted, portrait);
        } catch {
          blob = null;
        }
      }
      if (!blob) blob = await grabFrame(video, digitalZoom, wanted);
      if (!blob) {
        setError('Scatto non riuscito, riprova.');
        return;
      }
      onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  };

  // Pulsanti rapidi di zoom (0.5× compare solo se si può davvero scendere sotto 1×; un tele dedicato aggiunge il suo ingrandimento)
  const zoomPresets = Array.from(
    new Set(
      [displayMin < 1 ? displayMin : null, 1, 2, teleEligible && teleLens ? teleLens.mag : null, 5, 10].filter(
        (v): v is number => v !== null && v >= displayMin && v <= displayMax
      )
    )
  ).sort((a, b) => a - b);
  const nearestPreset = zoomPresets.reduce((a, b) => (Math.abs(b - zoom) < Math.abs(a - zoom) ? b : a), zoomPresets[0] ?? 1);

  // Avviso verde: compare solo quando è certo quale obiettivo è in uso e sparisce tornando al principale
  let lensNotice: string | null = null;
  if (ready && facing === 'environment') {
    if (activeLens && activeLens.id !== mainId) {
      const feminine = activeLens.kind === 'ultra' || activeLens.kind === 'macro';
      lensNotice = `${activeLens.name} ${feminine ? 'attiva' : 'attivo'}`;
    } else if (scale === 1 && hwMin < 1 && zoom < 1) {
      // Il principale scende sotto 1× da solo: per definizione è l'ultra grandangolare
      lensNotice = 'Ultra grandangolare attiva';
    }
  }

  // Il pulsante "Riconosci" serve finché c'è un obiettivo di cui non si sa nulla
  const needsRecognition = lenses.length > 1;

  // Ripresa attenuata dietro il riquadro: stesse dimensioni e stesso ingrandimento del video principale, così combacia
  let ghostStyle: React.CSSProperties | null = null;
  if (area.w > 0 && area.h > 0 && videoDims.w > 0 && videoDims.h > 0 && (boxStyle.width !== area.w || boxStyle.height !== area.h)) {
    const bw = Number(boxStyle.width);
    const bh = Number(boxStyle.height);
    const k = Math.max(bw / videoDims.w, bh / videoDims.h);
    ghostStyle = { width: videoDims.w * k, height: videoDims.h * k };
  }

  const ghostOn = ghostStyle !== null;
  useEffect(() => {
    const ghost = ghostRef.current;
    if (ghostOn && ghost && streamRef.current && ghost.srcObject !== streamRef.current) {
      ghost.srcObject = streamRef.current;
      ghost.play().catch(() => undefined);
    }
  }, [ghostOn, ready, restartKey]);

  const previewTransform = [
    facing === 'user' ? 'scaleX(-1)' : '',
    digitalZoom !== 1 ? `scale(${digitalZoom})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotocamera"
      className="fixed inset-0 z-[10001] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] select-none"
    >
      {/* Barra superiore */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi fotocamera"
          className="w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-95 transition-transform"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          {facing === 'environment' && (
            <button
              type="button"
              onClick={toggleTorch}
              disabled={!torchSupported}
              title={torchSupported ? undefined : 'Flash non disponibile su questa fotocamera'}
              aria-label={torchSupported ? (torchOn ? 'Spegni flash' : 'Accendi flash') : 'Flash non disponibile'}
              aria-pressed={torchOn}
              className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-95 transition-all disabled:opacity-30 ${
                torchOn ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white'
              }`}
            >
              {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={onUseSystemCamera}
            className="h-11 px-3.5 rounded-full bg-white/10 text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <Smartphone className="w-4 h-4" />
            <span>App Fotocamera</span>
          </button>
        </div>
      </div>

      {/* Anteprima: pizzica per lo zoom, tocca per mettere a fuoco */}
      <div
        ref={areaRef}
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
        onClick={onPreviewTap}
        onTouchStart={(e) => {
          if (e.touches.length === 2) pinchRef.current = { dist: touchDistance(e.touches), zoom };
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchRef.current) {
            applyZoom(pinchRef.current.zoom * (touchDistance(e.touches) / pinchRef.current.dist));
          }
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) pinchRef.current = null;
        }}
      >
        {/* Fuori dal formato scelto si vede la stessa ripresa, attenuata: così si capisce come viene la foto in totale */}
        {ghostStyle && (
          <video
            ref={ghostRef}
            playsInline
            muted
            autoPlay
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 max-w-none opacity-35"
            style={{
              ...ghostStyle,
              transform: `translate(-50%, -50%)${previewTransform ? ` ${previewTransform}` : ''}`,
            }}
          />
        )}

        {/* Riquadro con le proporzioni della foto: quello che si vede è quello che si salva */}
        <div ref={boxRef} className="relative overflow-hidden shrink-0" style={boxStyle} data-aspect={aspect}>
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            onLoadedMetadata={(e) => setVideoDims({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
            onResize={(e) => setVideoDims({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
            className="w-full h-full object-cover"
            style={{ transform: previewTransform || undefined }}
          />
        </div>

        {focusPoint && (
          <span
            key={focusPoint.key}
            className="pointer-events-none absolute w-16 h-16 -ml-8 -mt-8 rounded-full border-2 border-amber-300 animate-ping"
            style={{ left: focusPoint.x, top: focusPoint.y }}
          />
        )}

        {ready && (
          <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-mono">
            {fmtMag(zoom)}
          </span>
        )}

        {lensNotice && (
          <span
            role="status"
            className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold shadow-lg whitespace-nowrap"
          >
            {lensNotice}
          </span>
        )}

        {notice && (
          <span
            role="status"
            className={`pointer-events-none absolute bottom-3 left-3 right-3 mx-auto max-w-sm px-3 py-2 rounded-xl text-xs font-semibold text-center shadow-lg ${
              notice.ok ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
            }`}
          >
            {notice.text}
          </span>
        )}

        {!ready && !error && !probing && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-300 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Apro la fotocamera…
          </div>
        )}

        {probing && (
          <div
            role="status"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/85 text-slate-100"
          >
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm font-semibold">
              Riconosco gli obiettivi… {probing.step}/{probing.total}
            </p>
            <p className="text-xs text-slate-300 max-w-xs">
              Tieni fermo il telefono su una scena con molti dettagli, a qualche metro. L'anteprima si spegne per qualche secondo.
            </p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center bg-black/80">
            <p className="text-sm text-slate-200 max-w-xs">{error}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUseSystemCamera();
              }}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
            >
              Usa l'app Fotocamera
            </button>
          </div>
        )}
      </div>

      {/* Scelta dell'obiettivo posteriore (solo se il telefono ne espone più di uno) */}
      {ready && facing === 'environment' && lenses.length > 1 && (
        <div className="shrink-0 px-4 pt-3 flex overflow-x-auto" role="group" aria-label="Obiettivo">
          <div className="mx-auto flex items-center gap-2">
            {lenses.map((lens) => (
              <button
                key={lens.id}
                type="button"
                onClick={() => selectLens(lens)}
                aria-pressed={lens.id === activeLensId}
                className={`h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  lens.id === activeLensId ? 'bg-white text-slate-950' : 'bg-white/10 text-white'
                }`}
              >
                {lens.name}
              </button>
            ))}
            {needsRecognition && (
              <button
                type="button"
                onClick={() => void probeLenses()}
                className="h-9 px-3 rounded-full border border-dashed border-white/40 text-white/90 text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                <ScanSearch className="w-3.5 h-3.5" />
                Riconosci
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controlli zoom */}
      {ready && zoomPresets.length > 1 && (
        <div className="shrink-0 px-6 pt-3 space-y-3">
          <div className="flex items-center justify-center gap-2">
            {zoomPresets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyZoom(preset)}
                className={`min-w-[44px] h-9 px-2 rounded-full text-xs font-bold font-mono transition-colors ${
                  preset === nearestPreset && Math.abs(zoom - preset) < 0.05
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-white'
                }`}
              >
                {fmtMag(preset)}
              </button>
            ))}
          </div>
          <input
            type="range"
            min={displayMin}
            max={displayMax}
            step={0.1}
            value={zoom}
            onChange={(e) => applyZoom(Number(e.target.value))}
            aria-label="Zoom"
            className="w-full accent-amber-400"
          />
        </div>
      )}

      {/* Scatto, cambio fotocamera e formato della foto */}
      <div className="shrink-0 px-8 py-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            pendingZoomRef.current = null;
            switchingRef.current = false;
            setDeviceId(facing === 'environment' ? null : mainOverrideRef.current);
            setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
          }}
          aria-label="Cambia fotocamera"
          className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center active:scale-95 transition-transform"
        >
          <RefreshCw className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={takePhoto}
          disabled={!ready || busy || !!probing}
          aria-label="Scatta foto"
          className="w-[76px] h-[76px] rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        >
          {busy ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <span className="w-[60px] h-[60px] rounded-full bg-white" />}
        </button>

        <button
          type="button"
          onClick={cycleAspect}
          aria-label={`Formato foto ${ASPECT_LABEL[aspect]}. Tocca per cambiare`}
          className="w-12 h-12 rounded-full bg-white/10 text-white text-[11px] font-bold font-mono flex items-center justify-center active:scale-95 transition-transform"
        >
          {ASPECT_LABEL[aspect]}
        </button>
      </div>

      {/* Che obiettivo è? La risposta resta salvata su questo telefono */}
      {menuLens && (
        <div className="absolute inset-0 z-20 bg-black/60 flex items-end" onClick={() => setMenuLens(null)}>
          <div
            role="dialog"
            aria-label="Che obiettivo è?"
            className="w-full rounded-t-3xl bg-slate-900 border-t border-slate-700 p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="text-sm font-bold text-white">Che obiettivo è «{menuLens.name}»?</div>
              <p className="text-[11px] text-slate-400 leading-snug mt-1">
                Il telefono non lo dice al browser. Se lo sai, ricordo la scelta; altrimenti usa «Riconosci».
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  ['ultra', 'Ultra grandangolare'],
                  ['tele', 'Teleobiettivo'],
                  ['macro', 'Macro'],
                ] as [LensKind, string][]
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => labelLens(menuLens, kind)}
                  className={`h-11 rounded-xl text-sm font-semibold ${
                    menuLens.kind === kind && menuLens.origin === 'user' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => labelLens(menuLens, null)}
                className="h-11 rounded-xl text-sm font-semibold bg-white/5 text-slate-300"
              >
                Non lo so
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
