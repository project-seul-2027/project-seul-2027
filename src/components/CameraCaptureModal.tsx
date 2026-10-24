import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, RefreshCw, X } from 'lucide-react';

interface CameraCaptureModalProps {
  /** Foto scattata (JPEG a piena risoluzione della fotocamera) */
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Ripiego: apre la fotocamera di sistema del telefono */
  onUseSystemCamera: () => void;
}

/**
 * Fotocamera dentro l'app: l'anteprima è un <video> nella pagina, quindi non si esce mai dall'app.
 * Con la fotocamera di sistema Android/iOS possono chiudere l'app durante lo scatto e al ritorno
 * la foto andrebbe persa.
 */
export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({ onCapture, onClose, onUseSystemCamera }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setReady(true);
      } catch (err) {
        if (cancelled) return;
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
    };
  }, [facing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('Scatto non riuscito, riprova.');
          return;
        }
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotocamera"
      className="fixed inset-0 z-[10001] bg-black flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="max-w-full max-h-full w-full h-full object-contain"
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />

        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-300 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Apro la fotocamera…
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-slate-200 max-w-xs">{error}</p>
            <button
              type="button"
              onClick={onUseSystemCamera}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
            >
              Usa la fotocamera del telefono
            </button>
          </div>
        )}
      </div>

      <div className="shrink-0 px-6 py-5 flex items-center justify-between bg-black/90">
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi fotocamera"
          className="w-12 h-12 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center active:scale-95 transition-transform"
        >
          <X className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={takePhoto}
          disabled={!ready}
          aria-label="Scatta foto"
          className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        >
          <span className="w-14 h-14 rounded-full bg-white" />
        </button>

        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          aria-label="Cambia fotocamera"
          className="w-12 h-12 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center active:scale-95 transition-transform"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>
    </div>,
    document.body
  );
};
