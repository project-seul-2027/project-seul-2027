import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';
import { scanFrame, type ScanResult } from '../wallet/qrScan';

interface Props {
  /** `frame`: fotogramma del codice, fornito quando il formato non è un QR (si può solo mostrare come foto) */
  onResult: (r: ScanResult, frame: Blob | null) => void;
  /** Foto del codice quando non si riesce a leggerlo */
  onPhoto: (blob: Blob) => void;
  onClose: () => void;
  /** La fotocamera dell'app non è disponibile: si passa alla fotocamera di sistema */
  onUnavailable: () => void;
}

/**
 * Lettore di codici con la fotocamera DENTRO l'app: non si esce verso un'altra app,
 * quindi Android non ricarica la pagina e non si perde il modulo che si sta compilando.
 */
export const QrScanner: React.FC<Props> = ({ onResult, onPhoto, onClose, onUnavailable }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let alive = true;
    const started = Date.now();

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return onUnavailable();
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      } catch {
        if (alive) onUnavailable();
        return;
      }
      if (!alive) return stream.getTracks().forEach((t) => t.stop());
      const v = videoRef.current!;
      v.srcObject = stream;
      try {
        await v.play();
      } catch {
        /* partirà da solo */
      }
      setReady(true);
      const tick = async () => {
        if (!alive || doneRef.current) return;
        if (v.readyState >= 2) {
          const r = await scanFrame(v);
          if (r && alive && !doneRef.current) {
            doneRef.current = true;
            try {
              navigator.vibrate?.(60);
            } catch {
              /* non supportato */
            }
            return onResult(r, r.format === 'qr_code' ? null : await frameBlob());
          }
        }
        if (Date.now() - started > 12_000) setHint(true);
        timer = window.setTimeout(tick, 180);
      };
      tick();
    })();

    return () => {
      alive = false;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const frameBlob = (): Promise<Blob | null> => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return Promise.resolve(null);
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.92));
  };
  const snap = async () => {
    const b = await frameBlob();
    if (b) onPhoto(b);
  };

  return (
    <div className="fixed inset-0 z-[900] bg-black flex flex-col" role="dialog" aria-modal="true" aria-label="Leggi il codice con la fotocamera" data-testid="qr-scanner">
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        {!ready && <div className="absolute inset-0 flex items-center justify-center text-white"><Loader2 className="w-7 h-7 animate-spin" /></div>}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[68vmin] h-[68vmin] max-w-[420px] max-h-[420px] rounded-3xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
        </div>
        <button type="button" onClick={onClose} className="absolute top-3 right-3 min-h-[48px] min-w-[48px] rounded-full bg-black/55 text-white flex items-center justify-center" style={{ marginTop: 'env(safe-area-inset-top)' }} aria-label="Chiudi" data-testid="qr-scanner-close"><X className="w-6 h-6" /></button>
      </div>
      <div className="px-5 pt-4 text-center bg-black" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <p className="text-sm text-white font-semibold">Inquadra il codice QR del biglietto</p>
        <p className="text-xs text-slate-400 mt-1">{hint ? 'Non lo leggo: avvicinati, evita i riflessi o alza la luminosità dell’altro schermo.' : 'Si legge da solo, senza scattare.'}</p>
        {hint && (
          <button type="button" onClick={snap} className="mt-3 min-h-[48px] px-5 rounded-2xl bg-white/15 text-white text-sm font-semibold inline-flex items-center gap-2" data-testid="qr-scanner-snap"><Camera className="w-4 h-4" /> Tieni la foto così com’è</button>
        )}
      </div>
    </div>
  );
};

export default QrScanner;
