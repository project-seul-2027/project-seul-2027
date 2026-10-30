import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Paperclip, AlertTriangle, Loader2 } from 'lucide-react';
import {
  FLIGHT_LEGS, KINDS, legSubtitle, legTitle, looksLikeCardNumber, newId, presetById,
  type WalletExtra, type WalletFileMeta, type WalletItem, type WalletKind
} from '../wallet/walletData';
import { MAX_FILES_PER_ITEM, prepareFile, saveItem } from '../wallet/walletStore';

interface Props {
  ownerId: string;
  kind: WalletKind;
  presetId?: string;
  initial?: WalletItem;
  /** Tratta da preselezionare (solo voli nuovi) */
  initialLegId?: string;
  onClose: () => void;
  onSaved: (item: WalletItem) => void;
}

const inputCls = 'w-full min-h-[46px] rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-500 focus:outline-none px-3 text-sm text-white placeholder:text-slate-600';
const labelCls = 'block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5';

const DEFAULT_EXTRA: Partial<Record<WalletKind, string[]>> = {
  flight: ['Numero biglietto', 'Posto'],
  other: ['Telefono assistenza']
};

export const WalletForm: React.FC<Props> = ({ ownerId, kind, presetId, initial, initialLegId, onClose, onSaved }) => {
  const preset = presetById(initial?.preset ?? presetId);
  const startLeg = FLIGHT_LEGS.find((l) => l.id === initialLegId);
  const [title, setTitle] = useState(initial?.title ?? (startLeg ? legTitle(startLeg) : preset?.title ?? ''));
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? (startLeg ? legSubtitle(startLeg) : preset?.subtitle ?? ''));
  const [legId, setLegId] = useState(initial?.legId ?? startLeg?.id ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [qrText, setQrText] = useState(initial?.qrText ?? '');
  const [validFrom, setValidFrom] = useState(initial?.validFrom ?? '');
  const [validTo, setValidTo] = useState(initial?.validTo ?? '');
  const [openUrl, setOpenUrl] = useState(initial?.openUrl ?? preset?.openUrl ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [extra, setExtra] = useState<WalletExtra[]>(
    initial?.extra?.length ? initial.extra : (DEFAULT_EXTRA[kind] ?? []).map((label) => ({ label, value: '' }))
  );
  const [kept, setKept] = useState<WalletFileMeta[]>(initial?.files ?? []);
  const [added, setAdded] = useState<{ file: Blob; meta: WalletFileMeta }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyFiles, setBusyFiles] = useState(false);
  const info = KINDS[kind];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const pickLeg = (id: string) => {
    setLegId(id);
    const leg = FLIGHT_LEGS.find((l) => l.id === id);
    if (leg) {
      setTitle(legTitle(leg));
      setSubtitle(legSubtitle(leg));
    }
  };

  const previews = useMemo(() => added.map((a) => ({ id: a.meta.id, url: a.meta.type.startsWith('image/') ? URL.createObjectURL(a.file) : '' })), [added]);
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews]);

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    setBusyFiles(true);
    try {
      const room = MAX_FILES_PER_ITEM - kept.length - added.length;
      const next: { file: Blob; meta: WalletFileMeta }[] = [];
      for (const f of Array.from(list).slice(0, Math.max(0, room))) next.push(await prepareFile(f));
      if (list.length > room) setError(`Al massimo ${MAX_FILES_PER_ITEM} allegati per scheda.`);
      setAdded((a) => [...a, ...next]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyFiles(false);
    }
  };

  const save = async () => {
    setError(null);
    const t = title.trim();
    if (!t) return setError('Dai un nome alla scheda.');
    const cleanExtra = extra.map((e) => ({ label: e.label.trim(), value: e.value.trim() })).filter((e) => e.label && e.value);
    // Il Wallet non è un posto per i numeri delle carte di pagamento
    const scan = [t, subtitle, code, note, ...cleanExtra.map((e) => e.value)].join(' | ');
    if (looksLikeCardNumber(scan)) return setError('Sembra un numero di carta di pagamento: per sicurezza non lo salvo nel Wallet.');
    if (validFrom && validTo && validTo < validFrom) return setError('La data di fine è prima di quella di inizio.');
    const now = new Date().toISOString();
    const removed = (initial?.files ?? []).filter((f) => !kept.some((k) => k.id === f.id)).map((f) => f.id);
    const item: WalletItem = {
      id: initial?.id ?? newId(),
      ownerId,
      kind,
      preset: initial?.preset ?? presetId,
      legId: legId || undefined,
      title: t,
      subtitle: subtitle.trim() || undefined,
      code: code.trim() || undefined,
      qrText: qrText.trim() || undefined,
      validFrom: validFrom || undefined,
      validTo: validTo || undefined,
      openUrl: openUrl.trim() || undefined,
      extra: cleanExtra,
      note: note.trim() || undefined,
      pinned: initial?.pinned,
      files: [...kept, ...added.map((a) => a.meta)],
      createdAt: initial?.createdAt ?? now,
      updatedAt: now
    };
    setSaving(true);
    try {
      await saveItem(item, added, removed);
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* non essenziale */
      }
      onSaved(item);
    } catch (err) {
      setError((err as Error).message || 'Salvataggio non riuscito.');
      setSaving(false);
    }
  };

  const showQr = kind === 'pass';
  const showDates = kind === 'pass' || kind === 'other';
  const codeLabel =
    kind === 'flight' ? 'Codice di prenotazione (PNR)' : kind === 'other' ? 'Numero polizza o documento' : 'Codice o numero prenotazione';

  return (
    <div className="fixed inset-0 z-[800] flex items-end sm:items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-label="Scheda del Wallet" data-testid="wallet-form">
      <div className="w-full sm:max-w-xl max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${info.gradient}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white font-display">{initial ? 'Modifica scheda' : `Nuova scheda · ${info.label}`}</p>
            <p className="text-[11px] text-slate-400 truncate">{info.hint}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-4 py-4 space-y-4">
          {preset?.tip && <p className="text-xs text-slate-300 leading-snug rounded-xl bg-slate-800/60 border border-slate-700 p-3">{preset.tip}</p>}

          {kind === 'flight' && (
            <div>
              <label className={labelCls} htmlFor="wf-leg">Tratta del viaggio</label>
              <select id="wf-leg" value={legId} onChange={(e) => pickLeg(e.target.value)} className={inputCls} data-testid="wf-leg">
                <option value="">Altro volo (scrivo io)</option>
                {FLIGHT_LEGS.map((l) => (
                  <option key={l.id} value={l.id}>{legTitle(l)} · {l.departureDate.replace(/ 2027$/, '')}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="wf-title">Nome</label>
              <input id="wf-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="es. eSIM di Anna" maxLength={60} data-testid="wf-title" />
            </div>
            <div>
              <label className={labelCls} htmlFor="wf-sub">Descrizione breve</label>
              <input id="wf-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={inputCls} maxLength={70} />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="wf-code">{codeLabel}</label>
            <input id="wf-code" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} font-mono`} autoCapitalize="characters" autoComplete="off" data-testid="wf-code" />
          </div>

          {showQr && (
            <div>
              <label className={labelCls} htmlFor="wf-qr">Testo del codice QR (facoltativo)</label>
              <textarea id="wf-qr" value={qrText} onChange={(e) => setQrText(e.target.value)} rows={2} className={`${inputCls} py-2 font-mono text-xs`} placeholder="Incolla qui il codice: l’app lo mostra come QR da scansionare" data-testid="wf-qr" />
            </div>
          )}

          {showDates && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="wf-from">Valido dal</label>
                <input id="wf-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="wf-to">Valido fino al</label>
                <input id="wf-to" type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={inputCls} data-testid="wf-to" />
              </div>
            </div>
          )}

          {kind === 'pass' && (
            <div>
              <label className={labelCls} htmlFor="wf-url">Indirizzo che apre l’app o il sito (facoltativo)</label>
              <input id="wf-url" type="url" value={openUrl} onChange={(e) => setOpenUrl(e.target.value)} className={inputCls} placeholder="https://…" inputMode="url" />
            </div>
          )}

          <div>
            <p className={labelCls}>Altri dati</p>
            <div className="space-y-2">
              {extra.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input value={row.label} onChange={(e) => setExtra(extra.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))} className={`${inputCls} w-2/5`} placeholder="Nome" maxLength={30} aria-label="Nome del dato" />
                  <input value={row.value} onChange={(e) => setExtra(extra.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} className={`${inputCls} flex-1`} placeholder="Valore" maxLength={120} aria-label="Valore del dato" />
                  <button type="button" onClick={() => setExtra(extra.filter((_, j) => j !== i))} className="min-h-[46px] min-w-[44px] rounded-xl text-slate-400 hover:text-rose-300 flex items-center justify-center" aria-label="Togli riga"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setExtra([...extra, { label: '', value: '' }])} className="min-h-[40px] px-3 rounded-xl border border-dashed border-slate-600 text-slate-300 text-xs font-semibold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Aggiungi un dato</button>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="wf-note">Note</label>
            <textarea id="wf-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className={`${inputCls} py-2`} maxLength={500} />
          </div>

          <div>
            <p className={labelCls}>Foto e PDF ({kept.length + added.length}/{MAX_FILES_PER_ITEM})</p>
            <p className="text-[11px] text-slate-500 mb-2 leading-snug">Carta d’imbarco, schermata con il QR, PDF del biglietto. Restano solo su questo telefono.</p>
            <div className="space-y-1.5">
              {kept.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-xl bg-slate-950 border border-slate-800 px-3 min-h-[44px]">
                  <Paperclip className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="flex-1 min-w-0 text-xs text-slate-200 truncate">{f.name}</span>
                  <button type="button" onClick={() => setKept(kept.filter((k) => k.id !== f.id))} className="min-h-[40px] min-w-[40px] text-slate-400 hover:text-rose-300 flex items-center justify-center" aria-label={`Togli ${f.name}`}><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              {added.map((a) => {
                const p = previews.find((x) => x.id === a.meta.id);
                return (
                  <div key={a.meta.id} className="flex items-center gap-2 rounded-xl bg-slate-950 border border-emerald-500/30 px-2 min-h-[44px]">
                    {p?.url ? <img src={p.url} alt="" className="w-9 h-9 rounded-md object-cover" /> : <Paperclip className="w-4 h-4 text-slate-500 ml-1" />}
                    <span className="flex-1 min-w-0 text-xs text-slate-200 truncate">{a.meta.name}</span>
                    <button type="button" onClick={() => setAdded(added.filter((x) => x.meta.id !== a.meta.id))} className="min-h-[40px] min-w-[40px] text-slate-400 hover:text-rose-300 flex items-center justify-center" aria-label={`Togli ${a.meta.name}`}><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
            {kept.length + added.length < MAX_FILES_PER_ITEM && (
              <label className="mt-2 min-h-[46px] rounded-xl border border-dashed border-slate-600 hover:border-cyan-500 text-slate-300 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer">
                {busyFiles ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                Aggiungi foto o PDF
                <input type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} data-testid="wf-files" />
              </label>
            )}
          </div>

          {error && (
            <p className="flex gap-2 text-xs text-rose-200 rounded-xl bg-rose-500/10 border border-rose-500/40 p-3" role="alert"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</p>
          )}
        </div>

        <div className="px-4 pt-3 pb-4 border-t border-slate-800 grid grid-cols-2 gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-200 text-sm font-semibold">Annulla</button>
          <button type="button" onClick={save} disabled={saving || busyFiles} className="min-h-[48px] rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-sm font-bold" data-testid="wf-save">{saving ? 'Salvo…' : 'Salva'}</button>
        </div>
      </div>
    </div>
  );
};

export default WalletForm;
