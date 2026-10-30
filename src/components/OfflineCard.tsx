import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloudOff, Download, Check, Trash2, RefreshCw, X, Loader2, WifiOff, AlertTriangle } from 'lucide-react';
import {
  MapDownloadCancelled, downloadMapPack, getMapPackState, removeMapPack, MAP_PACK_EVENT,
  type MapDownloadProgress, type MapPackMeta
} from '../offline/mapPack';
import { OfflineSummary } from './OfflineSummary';
import {
  DownloadCancelled, downloadPack, estimatePackBytes, formatMb, getPackState, removePack,
  type DownloadProgress, type PackState
} from '../offline/offlinePack';

/** true finché il telefono ha una connessione */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

const CONTENTS = [
  'Programma giorno per giorno e PDF',
  'Schede “Oggi” e “Mostra in coreano”',
  'Mappa con linee metro, stazioni e luoghi',
  'Calcolo dei percorsi in metro',
  'Promemoria da esportare nel calendario'
];

/** Sfondo stradale della mappa per l'offline (OpenFreeMap), con download e rimozione propri. */
const MapPackSection: React.FC<{ online: boolean }> = ({ online }) => {
  const [info, setInfo] = useState<{ supported: boolean; installed: boolean; meta: MapPackMeta | null } | null>(null);
  const [progress, setProgress] = useState<MapDownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => setInfo(await getMapPackState()), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!info?.supported) return null;
  const busy = progress !== null;
  const pct = progress ? Math.min(100, Math.round((progress.done / Math.max(1, progress.total)) * 100)) : 0;

  const start = async () => {
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress({ done: 0, total: 1, bytes: 0, stage: 'stile' });
    try {
      await downloadMapPack(setProgress, ctrl.signal);
    } catch (err) {
      if (!(err instanceof MapDownloadCancelled)) setError((err as Error).message || 'Download non riuscito.');
    } finally {
      abortRef.current = null;
      setProgress(null);
      refresh();
      window.dispatchEvent(new Event(MAP_PACK_EVENT));
    }
  };

  const remove = async () => {
    await removeMapPack();
    setConfirm(false);
    refresh();
    window.dispatchEvent(new Event(MAP_PACK_EVENT));
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-800" data-testid="map-pack">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-white">Sfondo della mappa di Seul</h4>
        {info.installed && (
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-emerald-500/20 text-emerald-300 flex items-center gap-1"><Check className="w-3 h-3" /> Scaricato</span>
        )}
      </div>
      {!info.installed && !busy && (
        <p className="mt-2 text-[11px] text-slate-400 leading-snug">
          Senza internet la mappa usa questo sfondo semplificato (strade e zone intorno a tappe e alloggi, nomi in lettere latine) al posto di Google, che non si può salvare. Fino a circa 40 MB: scaricalo col Wi-Fi.
        </p>
      )}
      {info.installed && !busy && info.meta && (
        <p className="mt-2 text-[11px] text-slate-400 leading-snug" data-testid="map-pack-info">
          {formatMb(info.meta.bytes)} · {info.meta.tiles} riquadri.{info.meta.partial ? ' Il limite di spazio ha fermato il download: alcune zone più lontane hanno meno dettaglio.' : ''} Compare da solo quando la rete manca.
        </p>
      )}
      {busy && progress && (
        <div className="mt-2" role="status" aria-live="polite" data-testid="map-pack-progress">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-sky-400 transition-[width] duration-200" style={{ width: `${pct}%` }} /></div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{progress.stage === 'stile' ? 'Preparo lo stile…' : `Scarico… ${pct}% · ${formatMb(progress.bytes)}`}</span>
            <button type="button" onClick={() => abortRef.current?.abort()} className="flex items-center gap-1 text-slate-300 hover:text-white font-semibold"><X className="w-3 h-3" /> Annulla</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
      <div className="mt-3 grid gap-2">
        {!info.installed && !busy && (
          <button type="button" onClick={start} disabled={!online} className="min-h-[44px] rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2" data-testid="map-pack-download">
            <Download className="w-4 h-4" /> Scarica lo sfondo della mappa
          </button>
        )}
        {info.installed && !busy && !confirm && (
          <button type="button" onClick={() => setConfirm(true)} className="min-h-[44px] rounded-2xl border border-slate-700 hover:border-rose-500/60 text-slate-300 hover:text-rose-200 text-sm font-semibold flex items-center justify-center gap-2" data-testid="map-pack-remove">
            <Trash2 className="w-4 h-4" /> Rimuovi lo sfondo
          </button>
        )}
        {info.installed && !busy && confirm && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3" data-testid="map-pack-confirm">
            <p className="text-xs text-rose-100 leading-snug">Elimino lo sfondo salvato ({info.meta ? formatMb(info.meta.bytes) : ''}). Con la rete la mappa resta quella di Google.</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold">Tieni</button>
              <button type="button" onClick={remove} className="min-h-[44px] rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold" data-testid="map-pack-confirm-yes">Rimuovi</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const OfflineCard: React.FC = () => {
  const online = useOnline();
  const [state, setState] = useState<PackState | null>(null);
  const [estimate, setEstimate] = useState(0);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const busy = progress !== null;

  const refresh = useCallback(async () => setState(await getPackState()), []);
  useEffect(() => {
    refresh();
    estimatePackBytes().then(setEstimate);
  }, [refresh]);

  const start = async () => {
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress({ done: 0, total: 1, bytes: 0, totalBytes: 1 });
    try {
      await downloadPack(setProgress, ctrl.signal);
    } catch (err) {
      if (!(err instanceof DownloadCancelled)) setError((err as Error).message || 'Download non riuscito.');
    } finally {
      abortRef.current = null;
      setProgress(null);
      refresh();
    }
  };

  const remove = async () => {
    await removePack();
    setConfirmRemove(false);
    refresh();
  };

  if (state && !state.supported) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5" data-testid="offline-card">
        <h3 className="text-sm font-bold text-white font-display flex items-center gap-2"><CloudOff className="w-4 h-4 text-slate-400" /> Uso offline</h3>
        <p className="mt-2 text-xs text-slate-400">Questo browser non permette di salvare l’app per l’uso offline. Installa l’app dalla schermata Home e riprova.</p>
      </section>
    );
  }

  const pct = progress ? Math.min(100, Math.round((progress.bytes / Math.max(1, progress.totalBytes)) * 100)) : 0;

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4 sm:p-5" data-testid="offline-card">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white font-display flex items-center gap-2"><CloudOff className="w-4 h-4 text-emerald-400" /> Uso offline</h3>
        {state?.installed && !state.outdated && (
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-emerald-500/20 text-emerald-300 flex items-center gap-1"><Check className="w-3 h-3" /> Scaricato</span>
        )}
        {state?.installed && state.outdated && (
          <span className="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 bg-amber-500/20 text-amber-300">Da aggiornare</span>
        )}
      </div>

      <OfflineSummary online={online} packState={state} onChanged={refresh} />

      {!online && (
        <p className="mt-3 text-xs text-amber-200 flex gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5" data-testid="offline-banner">
          <WifiOff className="w-4 h-4 shrink-0" />
          {state?.installed ? 'Sei offline: stai usando i file salvati sul telefono.' : 'Sei offline e il pacchetto non è stato scaricato: collegati al Wi-Fi per scaricarlo.'}
        </p>
      )}

      {!state?.installed && !busy && (
        <>
          <p className="mt-3 text-xs text-slate-300 leading-snug">
            Salva sul telefono quello che serve senza internet, utile se all’estero non hai roaming o eSIM. Scaricalo col Wi-Fi.
          </p>
          <ul className="mt-2.5 space-y-1">
            {CONTENTS.map((c) => (
              <li key={c} className="text-xs text-slate-300 flex gap-2"><Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />{c}</li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11px] text-slate-500 leading-snug flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-slate-500 mt-0.5" />
            Lo sfondo stradale della mappa si scarica a parte, qui sotto. Senza internet non funzionano meteo, galleria e aggiornamenti del gruppo.
          </p>
        </>
      )}

      {state?.installed && !busy && state.meta && (
        <p className="mt-3 text-xs text-slate-300 leading-snug">
          Salvato il {new Date(state.meta.savedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} alle {new Date(state.meta.savedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} · {formatMb(state.meta.bytes)} · {state.meta.files} file.
          {state.outdated && ' L’app è stata aggiornata: scarica di nuovo per avere anche le novità offline.'}
        </p>
      )}

      {busy && progress && (
        <div className="mt-3" role="status" aria-live="polite" data-testid="offline-progress">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Scarico… {pct}% · {progress.done}/{progress.total} file</span>
            <button type="button" onClick={() => abortRef.current?.abort()} className="flex items-center gap-1 text-slate-300 hover:text-white font-semibold"><X className="w-3 h-3" /> Annulla</button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-300" role="alert">{error}</p>}

      <div className="mt-4 grid gap-2">
        {(!state?.installed || state.outdated) && !busy && (
          <button
            type="button"
            onClick={start}
            disabled={!online}
            className="min-h-[48px] rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-sm flex items-center justify-center gap-2"
            data-testid="offline-download"
          >
            {state?.installed ? <RefreshCw className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {state?.installed ? 'Aggiorna il pacchetto' : `Scarica per l’offline${estimate ? ` (circa ${formatMb(estimate)})` : ''}`}
          </button>
        )}
        {busy && (
          <div className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-300 text-sm font-semibold flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Download in corso</div>
        )}
        {state?.installed && !busy && !confirmRemove && (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="min-h-[44px] rounded-2xl border border-slate-700 hover:border-rose-500/60 text-slate-300 hover:text-rose-200 text-sm font-semibold flex items-center justify-center gap-2"
            data-testid="offline-remove"
          >
            <Trash2 className="w-4 h-4" /> Rimuovi dal telefono
          </button>
        )}
        {state?.installed && !busy && confirmRemove && (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3" data-testid="offline-confirm">
            <p className="text-xs text-rose-100 leading-snug">Elimino i file salvati ({state.meta ? formatMb(state.meta.bytes) : ''}). Liberi spazio, ma senza internet l’app potrebbe non aprirsi più finché non li scarichi di nuovo.</p>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmRemove(false)} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold">Tieni</button>
              <button type="button" onClick={remove} className="min-h-[44px] rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold" data-testid="offline-confirm-yes">Rimuovi</button>
            </div>
          </div>
        )}
      </div>
      <MapPackSection online={online} />
    </section>
  );
};

export default OfflineCard;
