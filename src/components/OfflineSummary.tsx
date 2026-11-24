import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Download, Loader2, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { listItems } from '../wallet/walletStore';
import { FLIGHT_LEGS, type WalletItem } from '../wallet/walletData';
import { MAP_PACK_EVENT, MapDownloadCancelled, downloadMapPack, getMapPackState } from '../offline/mapPack';
import { DownloadCancelled, downloadPack, formatMb, type PackState } from '../offline/offlinePack';
import { SOS_SNAPSHOT_KEY } from './SosView';
import { useItineraryPdf } from './useItineraryPdf';
import { useBookings } from '../services/bookingsService';
import { useSeoulHome } from '../services/homeInfoService';
import { isPushConfigured, usePush } from '../notifications';
import { requestOpenPage } from '../pageAddress';

interface Row {
  id: string;
  label: string;
  detail: string;
  ok: boolean;
  warn?: boolean;
  openTab?: string;
}

const fmt = (iso?: string | null) =>
  iso ? `${new Date(iso).toLocaleDateString('it-IT')}, ${new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : '';

const friendlyError = (err: unknown): string => {
  const m = err instanceof Error ? err.message : '';
  if (!m || /failed to fetch|networkerror|load failed|fetch/i.test(m)) {
    return 'Download non riuscito: controlla la connessione e riprova (le parti già scaricate restano salvate).';
  }
  return m;
};

/**
 * "Pacchetto Seoul 2027": verifica sia i pacchetti offline (app, mappa, PDF, scheda SOS)
 * sia la prontezza operativa sul dispositivo (4 voli incluso Pechino -> Milano per il visto 240h,
 * Casa a Seul con PIN e Wi-Fi, prenotazioni di gruppo e notifiche push).
 */
export const OfflineSummary: React.FC<{ online: boolean; packState: PackState | null; onChanged: () => void }> = ({ online, packState, onChanged }) => {
  const { account, user } = useAuth();
  const [mapState, setMapState] = useState<Awaited<ReturnType<typeof getMapPackState>> | null>(null);
  const [walletItems, setWalletItems] = useState<WalletItem[] | null>(null);
  const [phase, setPhase] = useState<null | { label: string; pct: number }>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = React.useRef<AbortController | null>(null);

  const { custom: customPdf, meta: pdfMeta } = useItineraryPdf();
  const { bookings } = useBookings();
  const { homeDoc: seoulHome } = useSeoulHome();
  const { status: pushStatus } = usePush(user?.id);

  const reload = useCallback(async () => {
    setMapState(await getMapPackState());
    try {
      setWalletItems(account ? await listItems(account.id) : []);
    } catch {
      setWalletItems([]);
    }
  }, [account]);

  useEffect(() => {
    void reload();
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
  const pdfOk = customPdf ? !!pdfMeta : appOk;

  const savedLegs = walletItems
    ? FLIGHT_LEGS.filter((leg) => walletItems.some((item) => item.legId === leg.id))
    : [];
  const pekExitLeg = FLIGHT_LEGS.find((l) => l.departureAirportCode === 'PEK' && l.arrivalAirportCode === 'MXP');
  const hasPekExit = pekExitLeg && walletItems ? walletItems.some((i) => i.legId === pekExitLeg.id) : false;
  const walletCount = walletItems ? walletItems.length : null;

  const rows: Row[] = [
    {
      id: 'app',
      label: 'Itinerario, alloggi, frasi coreano/cinese, guida e metro',
      detail: appFresh ? `Aggiornato ${fmt(packState!.meta?.savedAt)}` : appOk ? 'Da aggiornare: l’app è cambiata' : 'Da scaricare',
      ok: appFresh,
      warn: appOk && !appFresh
    },
    {
      id: 'map',
      label: 'Sfondo della mappa di Seul',
      detail: mapOk ? `${mapState!.meta ? formatMb(mapState!.meta.bytes) : ''}${mapState!.meta?.partial ? ' · area ridotta' : ''}`.trim() || 'Scaricato' : 'Da scaricare',
      ok: mapOk,
      warn: mapOk && !!mapState?.meta?.partial
    },
    {
      id: 'pdf',
      label: 'PDF del programma sul telefono',
      detail: customPdf
        ? `Versione aggiornata salvata (${pdfMeta?.name ?? 'PDF'})`
        : appOk
          ? 'Incluso nel pacchetto offline'
          : 'Si salva scaricando il pacchetto',
      ok: pdfOk,
      openTab: 'pdf'
    },
    {
      id: 'sos',
      label: 'Emergenze, numeri e contatti personali',
      detail: appOk && snapshot ? 'Pronti offline' : appOk ? 'Tocca per aprire SOS e salvare i tuoi dati' : 'Servono il pacchetto e un accesso alla scheda SOS',
      ok: appOk && snapshot,
      warn: appOk && !snapshot,
      openTab: !snapshot ? 'sos' : undefined
    },
    {
      id: 'wallet',
      label: 'Wallet: biglietti e documenti salvati',
      detail:
        walletCount === null
          ? 'Controllo in corso…'
          : walletCount === 0
            ? 'Vuoto: aggiungi carte d’imbarco, eSIM e voucher'
            : `${walletCount} ${walletCount === 1 ? 'documento salvato' : 'documenti salvati'} · ${savedLegs.length}/${FLIGHT_LEGS.length} voli`,
      ok: true,
      openTab: 'wallet'
    }
  ];

  const coreRows = rows.filter((r) => r.id !== 'wallet');
  const done = coreRows.filter((r) => r.ok).length;
  const pct = Math.round((done / coreRows.length) * 100);
  const last = [packState?.meta?.savedAt, mapState?.meta?.savedAt].filter(Boolean).sort().pop();
  const busy = phase !== null;

  const homeHasEssentials =
    !!seoulHome.confirmedAccId && Boolean(seoulHome.doorPin.trim() || seoulHome.wifiPass.trim() || seoulHome.exactAddress.trim());
  const bookedCount = bookings.filter((b) => b.status === 'booked').length;
  const todoBookings = bookings.length - bookedCount;

  const prepRows: Row[] = [
    {
      id: 'flights',
      label: 'Voli nel Wallet (incluso Pechino → Milano per visto 240h)',
      detail:
        walletItems === null
          ? '…'
          : savedLegs.length === FLIGHT_LEGS.length
            ? `Tutte le ${FLIGHT_LEGS.length} tratte salvate sul telefono`
            : !hasPekExit
              ? `${savedLegs.length}/${FLIGHT_LEGS.length} tratte · manca il volo PEK → MXP richiesto al banco transito 240h`
              : `${savedLegs.length}/${FLIGHT_LEGS.length} tratte salvate (PEK → MXP presente)`,
      ok: walletItems !== null && savedLegs.length === FLIGHT_LEGS.length,
      warn: walletItems !== null && savedLegs.length > 0 && savedLegs.length < FLIGHT_LEGS.length,
      openTab: 'wallet'
    },
    {
      id: 'home',
      label: 'Casa a Seul (indirizzo, PIN porta e Wi-Fi)',
      detail: homeHasEssentials
        ? `Salvati offline${seoulHome.doorPin ? ' · PIN pronto' : ''}${seoulHome.wifiPass ? ' · Wi-Fi pronto' : ''}`
        : seoulHome.confirmedAccId
          ? 'Alloggio scelto: aggiungi PIN porta e password Wi-Fi quando arrivano'
          : 'Da compilare in Alloggi appena confermata la casa',
      ok: homeHasEssentials,
      warn: !!seoulHome.confirmedAccId && !homeHasEssentials,
      openTab: 'accommodations'
    },
    {
      id: 'bookings',
      label: 'Prenotazioni e scadenze di gruppo',
      detail:
        bookings.length === 0
          ? 'Nessuna scadenza registrata'
          : todoBookings === 0
            ? `Tutte completate (${bookedCount}/${bookings.length})`
            : `${bookedCount}/${bookings.length} completate · ${todoBookings} ancora da fare`,
      ok: bookings.length > 0 && todoBookings === 0,
      warn: bookedCount > 0 && todoBookings > 0,
      openTab: 'bookings'
    },
    ...(isPushConfigured && pushStatus !== 'unsupported'
      ? [
          {
            id: 'push',
            label: 'Notifiche su questo dispositivo',
            detail:
              pushStatus === 'on'
                ? 'Attive'
                : pushStatus === 'denied'
                  ? 'Bloccate nelle impostazioni del browser/telefono'
                  : pushStatus === 'ios-install'
                    ? 'Su iPhone aggiungi prima l’app alla schermata Home'
                    : 'Disattivate (attivabili dal menu)',
            ok: pushStatus === 'on',
            warn: pushStatus === 'denied'
          } satisfies Row
        ]
      : [])
  ];

  const readyPrep = prepRows.filter((r) => r.ok).length;

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

  const renderRow = (r: Row) => {
    const inner = (
      <>
        <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${r.ok ? 'bg-emerald-500/20 text-emerald-300' : r.warn ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'}`}>
          {r.ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3 h-3" />}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-xs text-slate-200 leading-snug">{r.label}</span>
          <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{r.detail}</span>
        </span>
        {r.openTab && <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 mt-1" aria-hidden="true" />}
      </>
    );

    return (
      <li key={r.id} data-testid={`offline-row-${r.id}`} data-ok={r.ok ? '1' : '0'}>
        {r.openTab ? (
          <button
            type="button"
            onClick={() => requestOpenPage(r.openTab!)}
            className="w-full min-h-11 py-1 flex items-start gap-2.5 rounded-lg hover:bg-white/[0.04] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]"
          >
            {inner}
          </button>
        ) : (
          <div className="py-1 flex items-start gap-2.5">{inner}</div>
        )}
      </li>
    );
  };

  return (
    <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3.5" data-testid="offline-summary">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-400">Pacchetto Seoul 2027</p>
          <p className={`text-sm font-bold ${pct === 100 ? 'text-emerald-300' : 'text-white'}`}>{pct === 100 ? 'Disponibile offline' : 'Non ancora completo'}</p>
        </div>
        <p className="text-3xl font-black font-mono text-white tabular-nums" data-testid="offline-summary-pct">{pct}%</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${pct === 100 ? 'bg-emerald-400' : 'bg-cyan-400'} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {rows.map(renderRow)}
      </ul>

      <div className="mt-3.5 pt-3 border-t border-white/[0.08]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-xs font-semibold text-slate-300">Pronti a partire</p>
          <span className="text-[11px] font-semibold tabular-nums text-slate-400">{readyPrep}/{prepRows.length} pronti</span>
        </div>
        <ul className="space-y-1">
          {prepRows.map(renderRow)}
        </ul>
      </div>

      {last && <p className="mt-3 text-[11px] text-slate-500">Ultimo aggiornamento offline: {fmt(last)}</p>}
      <p className="mt-1 text-[11px] text-slate-500 leading-snug">Meteo, galleria, spese e posizione del gruppo richiedono internet.</p>

      {busy && phase && (
        <div className="mt-3" role="status" aria-live="polite" data-testid="offline-summary-progress">
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden"><div className="h-full bg-cyan-400 transition-[width] duration-200" style={{ width: `${phase.pct}%` }} /></div>
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
            <span>{phase.label}… {phase.pct}%</span>
            <button type="button" onClick={() => abort.current?.abort()} className="min-h-9 px-2 flex items-center gap-1 text-slate-300 hover:text-white font-semibold"><X className="w-3 h-3" /> Annulla</button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
      {(!appFresh || !mapOk) && !busy && (
        <button type="button" onClick={downloadAll} disabled={!online} className="mt-3 w-full min-h-[48px] rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2" data-testid="offline-download-all">
          <Download className="w-4 h-4" /> Scarica tutto (col Wi-Fi)
        </button>
      )}
      {busy && <div className="mt-3 min-h-[44px] rounded-2xl bg-slate-800 text-slate-300 text-sm font-semibold flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Download in corso</div>}
    </div>
  );
};

export default OfflineSummary;
