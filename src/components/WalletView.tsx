import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plane, Ticket, FileText, Plus, Lock, LockOpen, Copy, Check, X, Maximize2, Pencil, Trash2,
  QrCode, Download, Upload, ExternalLink, Pin, ChevronRight, Info, Smartphone, ShieldCheck, Delete, WalletCards, Share2
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import {
  KINDS, PRESETS, cardHeadline, legDepartureMs, FLIGHT_LEGS, validityLabel, type Preset, type WalletItem, type WalletKind
} from '../wallet/walletData';
import {
  WALLET_EVENT, WALLET_OPEN_KEY, checkPin, clearPin, deleteItem, exportBackup, getFileBlob, hasPin, importBackup, listItems, saveItem, setPin, totalBytes
} from '../wallet/walletStore';
import { WalletForm } from './WalletForm';
import { WalletViewer, type ViewerEntry } from './WalletViewer';
import { formatCountdown } from '../utils/tripClock';
import { formatMb } from '../offline/offlinePack';

const KIND_ICON: Record<WalletKind, React.ElementType> = { flight: Plane, pass: Ticket, other: FileText };
const FILTERS: { id: 'all' | WalletKind; label: string }[] = [
  { id: 'all', label: 'Tutto' },
  { id: 'flight', label: 'Voli' },
  { id: 'pass', label: 'Abbonamenti' },
  { id: 'other', label: 'Altro' }
];

const TONE: Record<'ok' | 'soon' | 'expired', string> = {
  ok: 'bg-white/15 text-white',
  soon: 'bg-amber-300 text-slate-950',
  expired: 'bg-rose-300 text-slate-950'
};

/* ---------- Blocco con PIN ---------- */

const LockScreen: React.FC<{ onUnlock: () => void }> = ({ onUnlock }) => {
  const [pin, setPinValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (pin.length < 4) return;
    let cancelled = false;
    setBusy(true);
    checkPin(pin).then((ok) => {
      if (cancelled) return;
      setBusy(false);
      if (ok) onUnlock();
      else {
        setWrong(true);
        setPinValue('');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pin, onUnlock]);

  const press = (d: string) => {
    if (busy) return;
    setWrong(false);
    setPinValue((p) => (p.length < 6 ? p + d : p));
  };

  return (
    <div className="max-w-xs mx-auto py-10 text-center" data-testid="wallet-lock">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center"><Lock className="w-7 h-7 text-cyan-400" /></div>
      <h2 className="mt-4 text-lg font-bold text-white font-display">Wallet bloccato</h2>
      <p className="mt-1 text-xs text-slate-400">Inserisci il PIN</p>
      <div className="mt-4 flex justify-center gap-2 h-4" aria-live="polite">
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <span key={i} className={`w-3 h-3 rounded-full border ${i < pin.length ? 'bg-cyan-400 border-cyan-400' : 'border-slate-600'}`} />
        ))}
      </div>
      <p className={`mt-2 text-xs h-4 ${wrong ? 'text-rose-300' : 'text-transparent'}`} role="alert">PIN sbagliato</p>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="min-h-[56px] rounded-2xl bg-slate-800 active:bg-slate-700 text-xl font-semibold text-white" data-testid={`pin-${d}`}>{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')} className="min-h-[56px] rounded-2xl bg-slate-800 active:bg-slate-700 text-xl font-semibold text-white" data-testid="pin-0">0</button>
        <button type="button" onClick={() => setPinValue((p) => p.slice(0, -1))} className="min-h-[56px] rounded-2xl text-slate-300 flex items-center justify-center" aria-label="Cancella"><Delete className="w-6 h-6" /></button>
      </div>
    </div>
  );
};

/* ---------- Scheda ---------- */

function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}

function flightCountdown(item: WalletItem, now: number): string | null {
  const leg = FLIGHT_LEGS.find((l) => l.id === item.legId);
  if (!leg) return null;
  const ms = legDepartureMs(leg) - now;
  if (Number.isNaN(ms)) return null;
  if (ms < -3 * 3_600_000) return null;
  if (ms < 0) return 'In corso';
  if (ms > 30 * 86_400_000) return null;
  return `Parte tra ${formatCountdown(ms)}`;
}

const PassCard: React.FC<{ item: WalletItem; now: number; onOpen: () => void }> = ({ item, now, onOpen }) => {
  const info = KINDS[item.kind];
  const Icon = KIND_ICON[item.kind];
  const validity = validityLabel(item, now);
  const countdown = item.kind === 'flight' ? flightCountdown(item, now) : null;
  const badge = countdown ?? validity?.text;
  const tone = countdown ? 'ok' : validity?.tone ?? 'ok';
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative w-full text-left rounded-3xl bg-gradient-to-br ${info.gradient} p-4 sm:p-5 min-h-[148px] shadow-lg shadow-black/40 active:scale-[0.99] transition-transform overflow-hidden flex flex-col`}
      data-testid="wallet-card"
      data-kind={item.kind}
    >
      <span className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
      <span className="pointer-events-none absolute -right-2 -bottom-16 w-40 h-40 rounded-full bg-black/10" />
      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-white" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{info.label}</p>
          <h3 className="text-lg font-bold text-white font-display leading-tight truncate">{item.title}</h3>
          {item.subtitle && <p className="text-xs text-white/80 truncate">{item.subtitle}</p>}
        </div>
        {item.pinned && <Pin className="w-4 h-4 text-white/80 shrink-0 fill-white/60" aria-label="Fissata" />}
      </div>
      <div className="relative mt-auto pt-4 flex items-end justify-between gap-2">
        <p className="font-mono text-sm sm:text-base font-semibold text-white tracking-wide truncate">{cardHeadline(item)}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          {badge && <span className={`text-[10px] font-bold rounded-full px-2 py-1 ${TONE[tone]}`}>{badge}</span>}
          {(item.files.length > 0 || item.qrText) && (
            <span className="text-[10px] font-bold rounded-full px-2 py-1 bg-black/25 text-white flex items-center gap-1">
              {item.qrText ? <QrCode className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              {item.files.length || ''}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

/* ---------- Dettaglio ---------- */

const CopyRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      /* appunti non disponibili */
    }
  };
  return (
    <div className="flex items-center gap-2 min-h-[52px] py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`text-sm text-white break-words ${mono ? 'font-mono tracking-wide' : ''}`}>{value}</p>
      </div>
      <button type="button" onClick={copy} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center" aria-label={`Copia ${label}`}>
        {done ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
};

const WalletDetail: React.FC<{
  item: WalletItem;
  now: number;
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onTogglePin: () => void;
}> = ({ item, now, onClose, onEdit, onDeleted, onTogglePin }) => {
  const info = KINDS[item.kind];
  const Icon = KIND_ICON[item.kind];
  const [entries, setEntries] = useState<ViewerEntry[]>([]);
  const [viewerAt, setViewerAt] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const validity = validityLabel(item, now);
  const countdown = item.kind === 'flight' ? flightCountdown(item, now) : null;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Allegati e QR in indirizzi temporanei, liberati alla chiusura
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const list: ViewerEntry[] = [];
      if (item.qrText) {
        try {
          const QR = await import('qrcode');
          const url = await QR.toDataURL(item.qrText, { width: 640, margin: 2, errorCorrectionLevel: 'M' });
          list.push({ key: 'qr', name: `Codice QR · ${item.title}`, type: 'image/png', url });
        } catch {
          /* testo troppo lungo per un QR */
        }
      }
      for (const f of item.files) {
        const blob = await getFileBlob(f.id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          list.push({ key: f.id, name: f.name, type: f.type, url });
        }
      }
      if (!cancelled) setEntries(list);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [item]);

  const rows: { label: string; value: string; mono?: boolean }[] = [];
  if (item.code) rows.push({ label: item.kind === 'flight' ? 'Prenotazione (PNR)' : item.kind === 'other' ? 'Numero polizza o documento' : 'Codice', value: item.code, mono: true });
  if (item.validFrom || item.validTo) {
    const fmt = (d?: string) => (d ? d.split('-').reverse().join('/') : '…');
    rows.push({ label: 'Validità', value: `${fmt(item.validFrom)} → ${fmt(item.validTo)}` });
  }
  item.extra.forEach((e) => rows.push({ label: e.label, value: e.value }));

  const remove = async () => {
    await deleteItem(item.id);
    onDeleted();
  };

  return (
    <>
      <div className="fixed inset-0 z-[700] flex items-end sm:items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-label={item.title} data-testid="wallet-detail">
        <div className="w-full sm:max-w-xl max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
          <div className={`relative rounded-t-3xl sm:rounded-t-3xl bg-gradient-to-br ${info.gradient} p-4 pb-5 overflow-hidden`}>
            <span className="pointer-events-none absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
            <div className="relative flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"><Icon className="w-6 h-6 text-white" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">{info.label}</p>
                <h2 className="text-xl font-bold text-white font-display leading-tight">{item.title}</h2>
                {item.subtitle && <p className="text-sm text-white/80">{item.subtitle}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {countdown && <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-white/20 text-white">{countdown}</span>}
                  {validity && <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${TONE[validity.tone]}`}>{validity.text}</span>}
                </div>
              </div>
              <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl bg-black/25 text-white flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="overflow-y-auto px-4 py-4 space-y-4">
            {entries.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setViewerAt(0)}
                  className="w-full min-h-[56px] rounded-2xl bg-white text-slate-950 font-bold text-base flex items-center justify-center gap-2 shadow-lg"
                  data-testid="wallet-show"
                >
                  <Maximize2 className="w-5 h-5" /> Mostra {entries[0].key === 'qr' ? 'il codice QR' : entries[0].type === 'application/pdf' ? 'il PDF' : 'il codice'}
                </button>
                <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
                  {entries.map((e, i) => (
                    <button key={e.key} type="button" onClick={() => setViewerAt(i)} className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-white flex items-center justify-center" aria-label={`Apri ${e.name}`}>
                      {e.type === 'application/pdf' ? <FileText className="w-8 h-8 text-slate-500" /> : <img src={e.url} alt="" className="w-full h-full object-cover" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {rows.length > 0 && (
              <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-3 divide-y divide-slate-800">
                {rows.map((r) => <CopyRow key={r.label + r.value} {...r} />)}
              </div>
            )}

            {item.note && <p className="text-sm text-slate-300 whitespace-pre-line leading-snug rounded-2xl bg-slate-950/60 border border-slate-800 p-3">{item.note}</p>}

            {item.openUrl && (
              <a href={item.openUrl} target="_blank" rel="noopener noreferrer" className="min-h-[48px] rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold flex items-center justify-center gap-2">
                <ExternalLink className="w-4 h-4" /> Apri l’app o il sito
              </a>
            )}

            {entries.length === 0 && rows.length === 0 && !item.note && (
              <p className="text-sm text-slate-400 text-center py-4">Scheda vuota: tocca “Modifica” per aggiungere codici o allegati.</p>
            )}
          </div>

          <div className="px-4 pt-3 border-t border-slate-800" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {!confirm ? (
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={onTogglePin} className="min-h-[46px] rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5" data-testid="wallet-pin"><Pin className={`w-4 h-4 ${item.pinned ? 'fill-current text-cyan-300' : ''}`} /> {item.pinned ? 'Fissata' : 'Fissa'}</button>
                <button type="button" onClick={onEdit} className="min-h-[46px] rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5" data-testid="wallet-edit"><Pencil className="w-4 h-4" /> Modifica</button>
                <button type="button" onClick={() => setConfirm(true)} className="min-h-[46px] rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5" data-testid="wallet-delete"><Trash2 className="w-4 h-4" /> Elimina</button>
              </div>
            ) : (
              <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3" data-testid="wallet-delete-confirm">
                <p className="text-xs text-rose-100">Elimino “{item.title}” e i suoi allegati dal telefono? Non si può annullare.</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setConfirm(false)} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold">Tieni</button>
                  <button type="button" onClick={remove} className="min-h-[44px] rounded-xl bg-rose-500 text-white text-sm font-bold" data-testid="wallet-delete-yes">Elimina</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {viewerAt !== null && <WalletViewer entries={entries} start={viewerAt} onClose={() => setViewerAt(null)} />}
    </>
  );
};

/* ---------- Impostazioni: blocco, copia, icona sulla Home ---------- */

async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Copia del Wallet' });
      return;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const WalletSettings: React.FC<{ ownerId: string; count: number; onChanged: () => void; onClose: () => void }> = ({ ownerId, count, onChanged, onClose }) => {
  const [pinOn, setPinOn] = useState(hasPin());
  const [newPin, setNewPin] = useState('');
  const [settingPin, setSettingPin] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bytes, setBytes] = useState(0);
  const [copied, setCopied] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const link = `${window.location.origin}${window.location.pathname}?tab=wallet&app=wallet`;

  useEffect(() => {
    totalBytes(ownerId).then(setBytes).catch(() => undefined);
  }, [ownerId, count]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const savePin = async () => {
    if (!/^\d{4,6}$/.test(newPin)) return setMsg('Il PIN è di 4-6 numeri.');
    await setPin(newPin);
    setPinOn(true);
    setSettingPin(false);
    setNewPin('');
    setMsg('PIN attivato. Il Wallet si blocca da solo dopo un minuto in cui lasci l’app.');
  };

  const doExport = async () => {
    setMsg(null);
    try {
      const blob = await exportBackup(ownerId);
      await shareOrDownload(blob, `seul2027-wallet-${new Date().toISOString().slice(0, 10)}.json`);
      setMsg('Copia pronta. Conservala in un posto sicuro: contiene i tuoi documenti, non è cifrata.');
    } catch (err) {
      setMsg((err as Error).message);
    }
  };

  const doImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const n = await importBackup(ownerId, file);
      setMsg(`Importate ${n} schede.`);
      onChanged();
    } catch (err) {
      setMsg((err as Error).message || 'Importazione non riuscita.');
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* appunti non disponibili */
    }
  };

  const section = 'rounded-2xl bg-slate-950/60 border border-slate-800 p-3.5';
  return (
    <div className="fixed inset-0 z-[700] flex items-end sm:items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-label="Impostazioni del Wallet" data-testid="wallet-settings">
      <div className="w-full sm:max-w-xl max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800">
          <ShieldCheck className="w-5 h-5 text-cyan-400" />
          <p className="flex-1 text-sm font-bold text-white font-display">Sicurezza, copia e accesso rapido</p>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-4 py-4 space-y-3">
          <div className={section}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Lock className="w-4 h-4 text-cyan-400" /> Blocco con PIN</h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-snug">Chiede il PIN per aprire il Wallet. Tiene lontani gli sguardi curiosi se qualcuno prende il telefono sbloccato; i dati però non sono cifrati.</p>
            {!settingPin ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setSettingPin(true); setMsg(null); }} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold" data-testid="pin-set">{pinOn ? 'Cambia PIN' : 'Attiva il PIN'}</button>
                {pinOn && <button type="button" onClick={() => { clearPin(); setPinOn(false); setMsg('PIN tolto.'); }} className="min-h-[44px] rounded-xl bg-slate-800 text-rose-200 text-sm font-semibold">Togli il PIN</button>}
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" type="password" autoComplete="off" placeholder="4-6 numeri" className="flex-1 min-h-[46px] rounded-xl bg-slate-950 border border-slate-700 px-3 text-white font-mono" aria-label="Nuovo PIN" data-testid="pin-input" />
                <button type="button" onClick={savePin} className="min-h-[46px] px-4 rounded-xl bg-cyan-500 text-slate-950 text-sm font-bold" data-testid="pin-save">Salva</button>
              </div>
            )}
          </div>

          <div className={section}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Download className="w-4 h-4 text-emerald-400" /> Copia di sicurezza</h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-snug">Le schede stanno solo su questo telefono ({formatMb(bytes)} usati). Se lo cambi o cancelli i dati del browser, si perdono: salva una copia, e importala sul nuovo telefono.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={doExport} disabled={count === 0} className="min-h-[44px] rounded-xl bg-slate-800 disabled:opacity-40 text-slate-100 text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="wallet-export"><Share2 className="w-4 h-4" /> Esporta</button>
              <button type="button" onClick={() => importRef.current?.click()} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold flex items-center justify-center gap-1.5"><Upload className="w-4 h-4" /> Importa</button>
              <input ref={importRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </div>

          <div className={section}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><Smartphone className="w-4 h-4 text-amber-300" /> Aprilo con un tocco dalla Home</h3>
            <p className="mt-1.5 text-xs text-slate-400 leading-snug">Un vero widget per la schermata del telefono non si può fare con un’app web. Questi sono i modi che funzionano:</p>
            <ul className="mt-2 space-y-2 text-xs text-slate-300 leading-snug">
              <li><strong className="text-white">Icona Wallet dedicata.</strong> Apri il link qui sotto nel browser del telefono, poi “Aggiungi a Home”: avrai un’icona “Wallet Seul” che si apre dritta sui tuoi documenti, anche senza rete.</li>
              <li><strong className="text-white">Android:</strong> tieni premuta l’icona dell’app installata e scegli “Wallet”.</li>
              <li><strong className="text-white">Oggi:</strong> il giorno del volo la carta d’imbarco compare in cima alla schermata Oggi.</li>
            </ul>
            <div className="mt-3 flex gap-2">
              <input readOnly value={link} className="flex-1 min-w-0 min-h-[44px] rounded-xl bg-slate-950 border border-slate-700 px-3 text-[11px] text-slate-300 font-mono" aria-label="Indirizzo del Wallet" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={copyLink} className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold flex items-center gap-1.5" data-testid="wallet-link-copy">{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />} Copia</button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500 leading-snug">Su iPhone l’icona dedicata va provata prima di partire: dipende dalla versione di iOS.</p>
          </div>

          {msg && <p className="text-xs text-cyan-200 rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-3" role="status">{msg}</p>}
        </div>
      </div>
    </div>
  );
};

/* ---------- Scelta del tipo di scheda ---------- */

const AddPicker: React.FC<{ onPick: (kind: WalletKind, preset?: Preset) => void; onClose: () => void }> = ({ onPick, onClose }) => (
  <div className="fixed inset-0 z-[700] flex items-end sm:items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-label="Cosa vuoi aggiungere?" data-testid="wallet-picker">
    <div className="w-full sm:max-w-xl max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800">
        <p className="flex-1 text-sm font-bold text-white font-display">Cosa vuoi aggiungere?</p>
        <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
      </div>
      <div className="overflow-y-auto px-4 py-3 space-y-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => onPick('flight')} className="w-full min-h-[60px] rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-800 text-left px-4 flex items-center gap-3" data-testid="pick-flight">
          <Plane className="w-6 h-6 text-white" />
          <span className="flex-1"><span className="block text-sm font-bold text-white">Biglietto aereo</span><span className="block text-[11px] text-white/80">Carta d’imbarco, e-ticket, prenotazione</span></span>
          <ChevronRight className="w-5 h-5 text-white/70" />
        </button>
        {(['pass', 'other'] as const).map((kind) => (
          <div key={kind}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{KINDS[kind].plural}</p>
            <div className="space-y-1.5">
              {PRESETS.filter((p) => p.kind === kind).map((p) => {
                const Icon = KIND_ICON[kind];
                return (
                  <button key={p.id} type="button" onClick={() => onPick(kind, p)} className="w-full min-h-[52px] rounded-2xl bg-slate-800/70 hover:bg-slate-800 text-left px-3.5 flex items-center gap-3" data-testid={`pick-${p.id}`}>
                    <span className={`w-9 h-9 rounded-xl bg-gradient-to-br ${KINDS[kind].gradient} flex items-center justify-center shrink-0`}><Icon className="w-4.5 h-4.5 text-white" /></span>
                    <span className="flex-1 min-w-0"><span className="block text-sm font-semibold text-white truncate">{p.title}</span>{p.subtitle && <span className="block text-[11px] text-slate-400 truncate">{p.subtitle}</span>}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ---------- Schermata principale ---------- */

type Sheet = { type: 'picker' } | { type: 'form'; kind: WalletKind; presetId?: string; item?: WalletItem } | { type: 'detail'; id: string } | { type: 'settings' } | null;

export const WalletView: React.FC = () => {
  const { user } = useAuth();
  const ownerId = user!.id;
  const [items, setItems] = useState<WalletItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | WalletKind>('all');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [locked, setLocked] = useState(() => hasPin());
  const [showInfo, setShowInfo] = useState(false);
  const now = useNow();
  const hiddenAt = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listItems(ownerId));
      setError(null);
    } catch (err) {
      setItems([]);
      setError((err as Error).message);
    }
  }, [ownerId]);

  useEffect(() => {
    refresh();
    window.addEventListener(WALLET_EVENT, refresh);
    return () => window.removeEventListener(WALLET_EVENT, refresh);
  }, [refresh]);

  // Si blocca da solo dopo un minuto fuori dall'app
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 60_000 && hasPin()) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Apertura diretta di una scheda (da "Oggi")
  useEffect(() => {
    if (!items || locked) return;
    try {
      const id = sessionStorage.getItem(WALLET_OPEN_KEY);
      if (id) {
        sessionStorage.removeItem(WALLET_OPEN_KEY);
        if (items.some((i) => i.id === id)) setSheet({ type: 'detail', id });
      }
    } catch {
      /* archiviazione bloccata */
    }
  }, [items, locked]);

  const sorted = useMemo(() => {
    const list = (items ?? []).filter((i) => filter === 'all' || i.kind === filter);
    const rank = (i: WalletItem) => {
      if (i.pinned) return 0;
      if (i.kind === 'flight') {
        const leg = FLIGHT_LEGS.find((l) => l.id === i.legId);
        return 1 + (leg ? Math.max(0, legDepartureMs(leg) / 1e13) : 0.9);
      }
      return 2;
    };
    return [...list].sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt));
  }, [items, filter]);

  const detail = sheet?.type === 'detail' ? items?.find((i) => i.id === sheet.id) ?? null : null;
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0 };
    items?.forEach((i) => (c[i.kind] = (c[i.kind] ?? 0) + 1));
    return c;
  }, [items]);

  const togglePin = async (item: WalletItem) => {
    await saveItem({ ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() });
  };

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  const missingLegs = FLIGHT_LEGS.filter((l) => !items?.some((i) => i.legId === l.id));

  return (
    <div className="max-w-5xl mx-auto" data-testid="wallet-view">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shrink-0"><WalletCards className="w-6 h-6 text-white" /></div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-2xl font-bold text-white font-display leading-tight truncate">Wallet del viaggio</h2>
          <p className="text-xs text-slate-400 hidden sm:block">Biglietti, tessere e abbonamenti sul tuo telefono, anche senza rete.</p>
          <p className="text-[11px] text-slate-400 sm:hidden truncate">Sul telefono, anche senza rete</p>
        </div>
        <button type="button" onClick={() => setSheet({ type: 'settings' })} className="min-h-[44px] min-w-[44px] rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center" aria-label="Sicurezza, copia e accesso rapido" data-testid="wallet-settings-btn">
          {hasPin() ? <Lock className="w-5 h-5 text-cyan-300" /> : <LockOpen className="w-5 h-5" />}
        </button>
        <button type="button" onClick={() => setSheet({ type: 'picker' })} className="min-h-[44px] px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold flex items-center gap-1.5" data-testid="wallet-add"><Plus className="w-4 h-4" /> <span className="max-[380px]:hidden">Aggiungi</span><span className="min-[381px]:hidden sr-only">Aggiungi</span></button>
      </div>

      {error && <p className="mb-3 text-xs text-rose-200 rounded-xl bg-rose-500/10 border border-rose-500/40 p-3" role="alert">{error}</p>}

      {items && items.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1" role="tablist" aria-label="Filtra le schede">
          {FILTERS.filter((f) => f.id === 'all' || counts[f.id]).map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)} className={`shrink-0 min-h-[38px] px-3.5 rounded-full text-xs font-semibold border ${filter === f.id ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200' : 'border-slate-700 text-slate-400'}`}>
              {f.label} <span className="opacity-60">{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>
      )}

      {items && items.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-700 p-6 text-center" data-testid="wallet-empty">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center"><WalletCards className="w-7 h-7 text-cyan-400" /></div>
          <h3 className="mt-3 text-base font-bold text-white font-display">Il Wallet è vuoto</h3>
          <p className="mt-1 text-sm text-slate-400 max-w-sm mx-auto">Salva qui carte d’imbarco, eSIM, voucher e prenotazioni: li trovi con un tocco, anche in aereo o in metro senza segnale.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {[{ k: 'flight' as const, l: 'Biglietto aereo' }, { k: 'pass' as const, l: 'eSIM', p: 'esim' }, { k: 'pass' as const, l: 'Prenotazione alloggio', p: 'hotel' }, { k: 'other' as const, l: 'Assicurazione', p: 'insurance' }].map((s) => (
              <button key={s.l} type="button" onClick={() => setSheet({ type: 'form', kind: s.k, presetId: s.p })} className="min-h-[44px] px-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold">{s.l}</button>
            ))}
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="wallet-list">
          {sorted.map((item) => <PassCard key={item.id} item={item} now={now} onOpen={() => setSheet({ type: 'detail', id: item.id })} />)}
        </div>
      )}

      {items && items.length > 0 && missingLegs.length > 0 && (filter === 'all' || filter === 'flight') && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Voli senza biglietto salvato</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {missingLegs.map((l) => (
              <button key={l.id} type="button" onClick={() => setSheet({ type: 'form', kind: 'flight', item: undefined, presetId: l.id })} className="min-h-[52px] rounded-2xl border border-dashed border-slate-700 hover:border-sky-500/60 px-3.5 text-left flex items-center gap-3">
                <Plane className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-slate-300 truncate">{l.departureAirportCode} → {l.arrivalAirportCode} · {l.departureDate.replace(/ 2027$/, '')}</span>
                <Plus className="w-4 h-4 text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl bg-slate-900/70 border border-slate-800">
        <button type="button" onClick={() => setShowInfo((v) => !v)} className="w-full min-h-[48px] px-4 flex items-center gap-2 text-left" aria-expanded={showInfo} data-testid="wallet-info-toggle">
          <Info className="w-4 h-4 text-cyan-400" />
          <span className="flex-1 text-sm font-semibold text-white">Cosa può fare il Wallet (e cosa no)</span>
          <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${showInfo ? 'rotate-90' : ''}`} />
        </button>
        {showInfo && (
          <div className="px-4 pb-4 space-y-2.5 text-xs text-slate-300 leading-snug" data-testid="wallet-info">
            <p><strong className="text-white">Biglietti e abbonamenti:</strong> foto, PDF e codici QR restano sul telefono e si aprono a schermo intero, su fondo bianco e con lo schermo sempre acceso.</p>
            <p><strong className="text-white">Carte di pagamento:</strong> qui non si salvano (per sicurezza rifiuto anche i numeri di carta). Per pagare con il telefono usa il Wallet di Apple o di Google.</p>
            <p><strong className="text-white">Dove stanno i dati:</strong> solo in questo telefono, non nel gruppo e non su internet. Fai una copia dalle impostazioni (il lucchetto).</p>
          </div>
        )}
      </div>

      {sheet?.type === 'picker' && (
        <AddPicker
          onClose={() => setSheet(null)}
          onPick={(kind, p) => setSheet({ type: 'form', kind, presetId: p?.id })}
        />
      )}
      {sheet?.type === 'form' && (
        <WalletForm
          ownerId={ownerId}
          kind={sheet.kind}
          presetId={sheet.kind === 'flight' ? undefined : sheet.presetId}
          initial={sheet.item}
          initialLegId={sheet.kind === 'flight' && !sheet.item ? sheet.presetId : undefined}
          onClose={() => setSheet(sheet.item ? { type: 'detail', id: sheet.item.id } : null)}
          onSaved={(it) => setSheet({ type: 'detail', id: it.id })}
        />
      )}
      {detail && (
        <WalletDetail
          item={detail}
          now={now}
          onClose={() => setSheet(null)}
          onEdit={() => setSheet({ type: 'form', kind: detail.kind, item: detail })}
          onDeleted={() => setSheet(null)}
          onTogglePin={() => togglePin(detail)}
        />
      )}
      {sheet?.type === 'settings' && <WalletSettings ownerId={ownerId} count={items?.length ?? 0} onChanged={refresh} onClose={() => setSheet(null)} />}
    </div>
  );
};

export default WalletView;
