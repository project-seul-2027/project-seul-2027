import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, Smartphone, X, Zap, ZapOff } from 'lucide-react';

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
/** Un ultra grandangolare separato inquadra circa il doppio del principale: lo zoom mostrato parte da 0.5× */
const ULTRA_BASE = 0.5;

type ZoomMode = 'hardware' | 'digital';

interface CameraCaps {
  zoom?: { min: number; max: number; step?: number };
  torch?: boolean;
  focusMode?: string[];
}

interface ImageCaptureLike {
  takePhoto(): Promise<Blob>;
}

type LensKind = 'ultra' | 'tele' | 'other';

/** Obiettivo posteriore esposto dal browser */
interface Lens {
  id: string;
  name: string;
  /** Solo quando il nome dell'obiettivo lo dichiara: altrimenti 'other' e non si afferma nulla */
  kind: LensKind;
}

const FRONT_RE = /front|user|selfie|anterior|frontale/i;
const BACK_RE = /back|rear|environment|posterior|trasera|arri[eè]re/i;
// Sensori che non servono per scattare foto (profondità, infrarossi, ...)
const IGNORE_RE = /depth|tof|infrared|\bir\b|mono|bokeh/i;

function lensKind(label: string): LensKind {
  if (/ultra|grandangol/i.test(label)) return 'ultra';
  if (/tele|periscop/i.test(label)) return 'tele';
  return 'other';
}

/** Il browser raramente dice di che tipo è un obiettivo: si deduce dal nome, altrimenti si numerano */
function lensName(label: string, kind: LensKind, index: number): string {
  if (kind === 'ultra') return 'Ultra grandangolare';
  if (kind === 'tele') return 'Teleobiettivo';
  if (/macro/i.test(label)) return 'Macro';
  return index === 0 ? 'Principale' : `Obiettivo ${index + 1}`;
}

function toLenses(devices: MediaDeviceInfo[]): Lens[] {
  return devices
    .filter(
      (d) =>
        d.kind === 'videoinput' && !!d.label && !FRONT_RE.test(d.label) && BACK_RE.test(d.label) && !IGNORE_RE.test(d.label)
    )
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
    .map((d, i) => {
      const kind = lensKind(d.label);
      return { id: d.deviceId, name: lensName(d.label, kind, i), kind };
    });
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

const touchDistance = (touches: React.TouchList) =>
  Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

/** Fotogramma dal video, con ritaglio centrale per lo zoom digitale */
function grabFrame(video: HTMLVideoElement, digitalZoom: number): Promise<Blob | null> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const sw = vw / digitalZoom;
  const sh = vh / digitalZoom;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  canvas.getContext('2d')?.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

/**
 * Fotocamera dentro l'app, usata su Android: con l'app Fotocamera di sistema Android può chiudere
 * l'app durante lo scatto e la foto andrebbe persa. Offre zoom (pizzico, pulsanti e cursore),
 * flash, tocco per mettere a fuoco, scelta dell'obiettivo e foto a piena risoluzione dove possibile.
 *
 * Obiettivi: il browser non dice quale lente sia ultra grandangolare o tele. Lo zoom sotto 1× di una
 * fotocamera "logica" è per definizione l'ultra grandangolare; un obiettivo separato è riconosciuto
 * solo se il suo nome lo dichiara. In tutti gli altri casi l'app non afferma nulla.
 */
export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ onCapture, onClose, onUseSystemCamera }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  // Zoom da applicare quando la fotocamera si riapre dopo un cambio di obiettivo
  const pendingZoomRef = useRef<number | null>(null);
  // Cambio di obiettivo in corso: evita richieste doppie durante il pizzico
  const switchingRef = useRef(false);
  const lastMainMaxRef = useRef(DIGITAL_ZOOM_MAX);

  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  // Obiettivo posteriore scelto (null = quello predefinito del telefono)
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [lenses, setLenses] = useState<Lens[]>([]);
  const [activeLensId, setActiveLensId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [zoomMode, setZoomMode] = useState<ZoomMode>('digital');
  // Limiti dello zoom dell'obiettivo aperto (hardware) e valore mostrato all'utente (rispetto al principale)
  const [hwMin, setHwMin] = useState(1);
  const [hwMax, setHwMax] = useState(DIGITAL_ZOOM_MAX);
  const [zoom, setZoom] = useState(1);

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [focusSupported, setFocusSupported] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number; key: number } | null>(null);

  // Avvio della fotocamera (e riavvio quando si cambia obiettivo o tra posteriore e frontale)
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

        // Con il permesso concesso il browser mostra i nomi delle fotocamere: si cercano gli obiettivi posteriori
        let lensList: Lens[] = [];
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (facing === 'environment') lensList = toLenses(devices);
        } catch {
          lensList = [];
        }
        if (cancelled) return;

        const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
        const caps = (track.getCapabilities?.() ?? {}) as CameraCaps;
        const activeId = settings.deviceId ?? null;
        const kind = lensList.find((l) => l.id === activeId)?.kind ?? 'other';
        const scale = kind === 'ultra' ? ULTRA_BASE : 1;

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
        if (kind !== 'ultra') lastMainMaxRef.current = max;

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
        setLenses(lensList);
        setActiveLensId(activeId);
        switchingRef.current = false;
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        switchingRef.current = false;
        pendingZoomRef.current = null;
        // L'obiettivo scelto non si apre: si torna a quello predefinito
        if (deviceId) {
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
  }, [facing, deviceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeLens = lenses.find((l) => l.id === activeLensId) ?? null;
  const activeKind: LensKind = activeLens?.kind ?? 'other';
  const ultraLens = lenses.find((l) => l.kind === 'ultra') ?? null;
  // Zoom mostrato = zoom dell'obiettivo × scala (l'ultra grandangolare separato vale 0.5×)
  const scale = activeKind === 'ultra' ? ULTRA_BASE : 1;
  // Sotto 1× si passa all'ultra grandangolare separato solo se l'obiettivo principale non scende già sotto 1×
  const canSwitchToUltra = facing === 'environment' && !!ultraLens && activeKind !== 'ultra' && hwMin >= 1;
  const displayMin = activeKind === 'ultra' ? scale * hwMin : canSwitchToUltra ? ULTRA_BASE : hwMin;
  const displayMax = activeKind === 'ultra' ? Math.max(lastMainMaxRef.current, 2) : hwMax;

  const applyZoom = useCallback(
    (value: number) => {
      const next = round1(clamp(value, displayMin, displayMax));

      // Cambio di obiettivo: sotto 1× ultra grandangolare, da 1× in su di nuovo il principale
      if (switchingRef.current) {
        setZoom(next);
        pendingZoomRef.current = next;
        return;
      }
      if (canSwitchToUltra && ultraLens && next < 1) {
        switchingRef.current = true;
        pendingZoomRef.current = next;
        setZoom(next);
        setDeviceId(ultraLens.id);
        return;
      }
      if (activeKind === 'ultra' && next >= 1) {
        switchingRef.current = true;
        pendingZoomRef.current = next;
        setZoom(next);
        setDeviceId(null);
        return;
      }

      setZoom(next);
      if (zoomMode === 'hardware') {
        trackRef.current
          ?.applyConstraints({ advanced: [{ zoom: next / scale } as MediaTrackConstraintSet] })
          .catch(() => undefined);
      }
    },
    [displayMin, displayMax, canSwitchToUltra, ultraLens, activeKind, zoomMode, scale]
  );

  const selectLens = (lens: Lens) => {
    if (lens.id === activeLensId || switchingRef.current) return;
    switchingRef.current = true;
    pendingZoomRef.current = lens.kind === 'ultra' ? ULTRA_BASE : 1;
    setDeviceId(lens.id);
  };

  const toggleTorch = () => {
    const next = !torchOn;
    trackRef.current
      ?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      .then(() => setTorchOn(next))
      .catch(() => undefined);
  };

  // Tocco sull'anteprima: messa a fuoco in quel punto (dove il telefono lo supporta)
  const onPreviewTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!focusSupported || !ready) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setFocusPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top, key: Date.now() });
    trackRef.current
      ?.applyConstraints({
        advanced: [{ focusMode: 'single-shot', pointsOfInterest: [{ x, y }] } as MediaTrackConstraintSet],
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!focusPoint) return;
    const id = window.setTimeout(() => setFocusPoint(null), 900);
    return () => window.clearTimeout(id);
  }, [focusPoint]);

  // Zoom digitale effettivo (solo se l'obiettivo non ha zoom hardware)
  const digitalZoom = zoomMode === 'digital' ? zoom / scale : 1;

  const takePhoto = async () => {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !video.videoWidth || busy) return;
    setBusy(true);
    try {
      let blob: Blob | null = null;
      // Foto a piena risoluzione del sensore (Android Chrome), con lo zoom hardware già applicato
      const ImageCaptureCtor = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike })
        .ImageCapture;
      const canUseFullRes = zoomMode === 'hardware' || digitalZoom === 1;
      if (ImageCaptureCtor && track && canUseFullRes) {
        try {
          blob = await new ImageCaptureCtor(track).takePhoto();
        } catch {
          blob = null;
        }
      }
      if (!blob) blob = await grabFrame(video, digitalZoom);
      if (!blob) {
        setError('Scatto non riuscito, riprova.');
        return;
      }
      onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' }));
    } finally {
      setBusy(false);
    }
  };

  // Pulsanti rapidi di zoom (0.5× compare solo se si può davvero scendere sotto 1×)
  const zoomPresets = Array.from(
    new Set([displayMin < 1 ? displayMin : null, 1, 2, 5, 10].filter((v): v is number => v !== null && v >= displayMin && v <= displayMax))
  );
  const nearestPreset = zoomPresets.reduce((a, b) => (Math.abs(b - zoom) < Math.abs(a - zoom) ? b : a), zoomPresets[0] ?? 1);
  const formatZoom = (z: number) => `${Number.isInteger(z) ? z : z.toFixed(1)}×`;

  // Avvisi verdi: compaiono solo quando è certo quale obiettivo è in uso e spariscono tornando al principale
  const showUltraNotice =
    ready && facing === 'environment' && (activeKind === 'ultra' || (scale === 1 && hwMin < 1 && zoom < 1));
  const showTeleNotice = ready && facing === 'environment' && activeKind === 'tele';

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
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-contain"
          style={{ transform: previewTransform || undefined }}
        />

        {focusPoint && (
          <span
            key={focusPoint.key}
            className="pointer-events-none absolute w-16 h-16 -ml-8 -mt-8 rounded-full border-2 border-amber-300 animate-ping"
            style={{ left: focusPoint.x, top: focusPoint.y }}
          />
        )}

        {ready && (
          <span className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-mono">
            {formatZoom(zoom)}
          </span>
        )}

        {(showUltraNotice || showTeleNotice) && (
          <span
            role="status"
            className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 text-xs font-bold shadow-lg whitespace-nowrap"
          >
            {showUltraNotice ? 'Ultra grandangolare attiva' : 'Teleobiettivo attivo'}
          </span>
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-300 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Apro la fotocamera…
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
        <div className="shrink-0 px-4 pt-3 flex items-center justify-center gap-2 overflow-x-auto" role="group" aria-label="Obiettivo">
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
                {formatZoom(preset)}
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

      {/* Scatto e cambio fotocamera */}
      <div className="shrink-0 px-8 py-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            pendingZoomRef.current = null;
            switchingRef.current = false;
            setDeviceId(null);
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
          disabled={!ready || busy}
          aria-label="Scatta foto"
          className="w-[76px] h-[76px] rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        >
          {busy ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <span className="w-[60px] h-[60px] rounded-full bg-white" />}
        </button>

        <span className="w-12 h-12" aria-hidden="true" />
      </div>
    </div>,
    document.body
  );
};
