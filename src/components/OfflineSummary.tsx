import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Download, Loader2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { listItems } from '../wallet/walletStore';
import { MAP_PACK_EVENT, MapDownloadCancelled, downloadMapPack, getMapPackState } from '../offline/mapPack';
import { DownloadCancelled, downloadPack, formatMb, type PackState } from '../offline/offlinePack';
import { SOS_SNAPSHOT_KEY } from './SosView';

interface Row {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
  warn?: boolean;
}

const fmt = (iso?: string | null) =>
  iso ? `${new Date(iso).toLocaleDateString('it-IT')}, ${new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : '';

/**
 * "Pacchetto Seoul 2027": in un colpo solo dice cosa funziona senza internet e permette di scaricare tutto.
 * I servizi online (meteo, galleria, gruppo in tempo reale) restano fuori di proposito.
 */
const friendlyError = (err: unknown): string => {
  const m = err instanceof Error ? err.message : '';
  if (!m || /failed to fetch|networkerror|load failed|fetch/i.test(m)) return 'Download non riuscito: controlla la connessione e riprova (le parti già scaricate restano salvate).';
  return m;
};

export const OfflineSummary: React.FC<{ online: boolean; packState: PackState | null; onChanged: () => void }> = ({ online, packState, onChanged }) => {
  const { account } = useAuth();
  const [mapState, setMapState] = useState<Awaited<ReturnType<typeof getMapPackState>> | null>(null);
  const [walletCount, setWalletCount] = useState<number | null>(null);
  const [phase, setPhase] = useState<null | { label: string; pct: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = React.useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    setMapState(await getMapPackState());
    try {
      setWalletCount(account ? (await listItems(account.id)).length : 0);
    } catch {
      setWalletCount(0);
    }
  }, [account]);
  useEffect(() => {
    reload();
    window.addEventListener(MAP_PACK_EVENT, reload);
    return () => window.removeEventListener(MAP_PACK_EVENT, reload);
  }, [reload]);

  const appOk = !!packState?.installed;
  const appFresh = appOk && !packState!.outdated;
  let snapshot = false;
  try {
    snapshot = !!localStorage.getItem(SOS_SNAPSHOT_KEY);
  } catch {
    /* archiviazione bloccata */
  }
  const mapOk = !!mapState?.installed;

  const rows: Row[] = [
    { id: 'app', label: 'Itinerario, alloggi in coreano, frasi, guida e percorsi in metro', detail: appFresh ? `Aggiornato ${fmt(packState!.meta?.savedAt)}` : appOk ? 'Da aggiornare: l’app è cambiata' : 'Da scaricare', ok: appFresh, warn: appOk && !appFresh },
    { id: 'map', label: 'Sfondo della mappa di Seul', detail: mapOk ? `${mapState!.meta ? formatMb(mapState!.meta.bytes) : ''}${mapState!.meta?.partial ? ' · area ridotta' : ''}`.trim() || 'Scaricato' : 'Da scaricare', ok: mapOk, warn: mapOk && !!mapState?.meta?.partial },
    { id: 'sos', label: 'Emergenze, numeri e contatti personali', detail: appOk && snapshot ? 'Pronti' : appOk ? 'Apri una volta la scheda SOS per salvare i tuoi dati' : 'Servono il pacchetto e un primo accesso alla scheda SOS', ok: appOk && snapshot },
    { id: 'wallet', label: 'Wallet: biglietti e documenti', detail: walletCount === null ? '…' : walletCount === 0 ? 'Vuoto (nulla da salvare)' : `${walletCount} ${walletCount === 1 ? 'elemento sul telefono' : 'elementi sul telefono'}`, ok: true }
  ];
  const done = rows.filter((r) => r.ok).length;
  const pct = Math.round((done / rows.length) * 100);
  const last = [packState?.meta?.savedAt, mapState?.meta?.savedAt].filter(Boolean).sort().pop();
  const busy = phase !== null;

  const downloadAll = async () => {
    setError(null);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      if (!appFresh) {
        setPhase({ label: 'App e programma', pct: 0 });
        await downloadPack((p) => setPhase({ label: 'App e programma', pct: Math.round((p.bytes / Math.max(1, p.totalBytes)) * 100) }), ctrl.signal);
      }
      if (!mapOk) {
        setPhase({ label: 'Sfondo della mappa', pct: 0 });
        await downloadMapPack((p) => setPhase({ label: p.stage === 'stile' ? 'Stile della mappa' : 'Sfondo della mappa', pct: Math.round((p.done / Math.max(1, p.total)) * 100) }), ctrl.signal);
      }
    } catch (err) {
      if (!(err instanceof DownloadCancelled) && !(err instanceof MapDownloadCancelled)) setError(friendlyError(err));
    } finally {
      abort.current = null;
      setPhase(null);
      await reload();
      onChanged();
    }
  };

  return (
    <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5" data-testid="offline-summary">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pacchetto Seoul 2027</p>
          <p className={`text-sm font-bold ${pct === 100 ? 'text-emerald-300' : 'text-white'}`}>{pct === 100 ? 'Disponibile offline' : 'Non ancora completo'}</p>
        </div>
        <p className="text-3xl font-black font-mono text-white tabular-nums" data-testid="offline-summary-pct">{pct}%</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${pct === 100 ? 'bg-emerald-400' : 'bg-cyan-400'} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-2.5" data-testid={`offline-row-${r.id}`} data-ok={r.ok ? '1' : '0'}>
            <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${r.ok ? 'bg-emerald-500/20 text-emerald-300' : r.warn ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
              {r.ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3 h-3" />}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-slate-200 leading-snug">{r.label}</p>
              <p className="text-[11px] text-slate-500 leading-snug">{r.detail}</p>
            </div>
          </li>
        ))}
      </ul>
      {last && <p className="mt-3 text-[11px] text-slate-500">Ultimo aggiornamento: {fmt(last)}</p>}
      <p className="mt-1 text-[11px] text-slate-600 leading-snug">Meteo, galleria, spese e posizione del gruppo richiedono sempre internet.</p>

      {busy && phase && (
        <div className="mt-3" role="status" aria-live="polite" data-testid="offline-summary-progress">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400 transition-[width] duration-200" style={{ width: `${phase.pct}%` }} /></div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{phase.label}… {phase.pct}%</span>
            <button type="button" onClick={() => abort.current?.abort()} className="flex items-center gap-1 text-slate-300 hover:text-white font-semibold"><X className="w-3 h-3" /> Annulla</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
      {pct < 100 && !busy && (
        <button type="button" onClick={downloadAll} disabled={!online || (appFresh && mapOk)} className="mt-3 w-full min-h-[48px] rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2" data-testid="offline-download-all">
          <Download className="w-4 h-4" /> Scarica tutto (col Wi-Fi)
        </button>
      )}
      {busy && <div className="mt-3 min-h-[44px] rounded-2xl bg-slate-800 text-slate-300 text-sm font-semibold flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Download in corso</div>}
    </div>
  );
};

export default OfflineSummary;
