import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Trash2, Paperclip, AlertTriangle, Loader2, ScanLine, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import {
  FLIGHT_LEGS, KINDS, legSubtitle, legTitle, looksLikeCardNumber, newId, presetById, trainHeadings,
  type WalletExtra, type WalletFileMeta, type WalletItem, type WalletKind
} from '../wallet/walletData';
import { MAX_FILES_PER_ITEM, clearDraft, getFileBlob, prepareFile, saveDraft, saveItem, type WalletDraft } from '../wallet/walletStore';
import { scanBlob, type ScanResult } from '../wallet/qrScan';
import { QrScanner } from './QrScanner';

interface Props {
  ownerId: string;
  kind: WalletKind;
  presetId?: string;
  initial?: WalletItem;
  /** Bozza da riprendere (dopo che l'app è stata chiusa) */
  draft?: WalletDraft;
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

export const WalletForm: React.FC<Props> = ({ ownerId, kind, presetId, initial, draft, initialLegId, onClose, onSaved }) => {
  const preset = presetById(initial?.preset ?? presetId);
  // Valore ripreso dalla bozza (se c'è), altrimenti quello di partenza
  const pick = <T,>(k: string, fb: T): T => (draft && k in draft.fields ? (draft.fields[k] as T) : fb);
  const t0 = initial?.train;
  const [tFrom, setTFrom] = useState(pick('tFrom', t0?.from ?? initial?.title.split(' → ')[0] ?? ''));
  const [tTo, setTTo] = useState(pick('tTo', t0?.to ?? initial?.title.split(' → ')[1] ?? ''));
  const [tArrive, setTArrive] = useState(pick('tArrive', t0?.arrive ?? ''));
  const [tPassenger, setTPassenger] = useState(pick('tPassenger', t0?.passenger ?? ''));
  const [tNumber, setTNumber] = useState(pick('tNumber', t0?.number ?? ''));
  const [tCp, setTCp] = useState(pick('tCp', t0?.cp ?? ''));
  const [tCarriage, setTCarriage] = useState(pick('tCarriage', t0?.carriage ?? ''));
  const [tSeat, setTSeat] = useState(pick('tSeat', t0?.seat ?? ''));
  const startLeg = FLIGHT_LEGS.find((l) => l.id === initialLegId);
  const [title, setTitle] = useState(pick('title', initial?.title ?? (startLeg ? legTitle(startLeg) : kind === 'train' ? '' : preset?.title ?? '')));
  const [subtitle, setSubtitle] = useState(pick('subtitle', initial?.subtitle ?? (startLeg ? legSubtitle(startLeg) : kind === 'train' ? '' : preset?.subtitle ?? '')));
  const [departAt, setDepartAt] = useState(pick('departAt', initial?.departAt ?? ''));
  const [legId, setLegId] = useState(pick('legId', initial?.legId ?? startLeg?.id ?? ''));
  const [code, setCode] = useState(pick('code', initial?.code ?? ''));
  const [qrText, setQrText] = useState(pick('qrText', initial?.qrText ?? ''));
  const [qrFormat, setQrFormat] = useState<string | undefined>(pick('qrFormat', initial?.qrFormat));
  const [validFrom, setValidFrom] = useState(pick('validFrom', initial?.validFrom ?? ''));
  const [validTo, setValidTo] = useState(pick('validTo', initial?.validTo ?? ''));
  const [openUrl, setOpenUrl] = useState(pick('openUrl', initial?.openUrl ?? preset?.openUrl ?? ''));
  const [note, setNote] = useState(pick('note', initial?.note ?? ''));
  const [extra, setExtra] = useState<WalletExtra[]>(
    pick<WalletExtra[] | null>('extra', null) ?? (initial?.extra?.length ? initial.extra : (DEFAULT_EXTRA[kind] ?? []).map((label) => ({ label, value: '' })))
  );
  // La foto del codice (quando non è un QR leggibile) vive a parte dagli altri allegati
  const initialQrMeta = initial?.qrFileId ? initial.files.find((x) => x.id === initial.qrFileId) : undefined;
  const [qrImg, setQrImg] = useState<{ file?: Blob; meta: WalletFileMeta } | null>(draft ? draft.qrImg : initialQrMeta ? { meta: initialQrMeta } : null);
  const keptAll = initial?.files ?? [];
  const [kept, setKept] = useState<WalletFileMeta[]>(() => {
    const ids = pick<string[] | null>('keptIds', null);
    return keptAll.filter((x) => x.id !== initial?.qrFileId && (!ids || ids.includes(x.id)));
  });
  const [added, setAdded] = useState<{ file: Blob; meta: WalletFileMeta }[]>(draft?.added ?? []);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [qrPreview, setQrPreview] = useState('');
  const sysCamRef = useRef<HTMLInputElement>(null);
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

  // Anteprima del QR letto / della foto del codice
  useEffect(() => {
    let cancelled = false;
    let url = '';
    (async () => {
      if (qrText) {
        try {
          const QR = await import('qrcode');
          const u = await QR.toDataURL(qrText, { width: 360, margin: 2, errorCorrectionLevel: qrText.length > 400 ? 'L' : 'M' });
          if (!cancelled) setQrPreview(u);
        } catch {
          if (!cancelled) setQrPreview('');
        }
      } else if (qrImg) {
        const blob = qrImg.file ?? (await getFileBlob(qrImg.meta.id));
        if (blob && !cancelled) {
          url = URL.createObjectURL(blob);
          setQrPreview(url);
        }
      } else setQrPreview('');
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [qrText, qrImg]);

  // Bozza: tutto quello che si sta scrivendo (foto comprese) resta nel telefono, così
  // se Android chiude l'app mentre si apre la galleria il modulo si riapre com'era.
  const closedRef = useRef(false);
  const buildDraft = useCallback((): WalletDraft => ({
    ownerId, kind, presetId, itemId: initial?.id, initialLegId, savedAt: Date.now(),
    fields: { title, subtitle, departAt, legId, code, qrText, qrFormat, validFrom, validTo, openUrl, note, extra, keptIds: kept.map((x) => x.id), tFrom, tTo, tArrive, tPassenger, tNumber, tCp, tCarriage, tSeat },
    added, qrImg
  }), [ownerId, kind, presetId, initial?.id, initialLegId, title, subtitle, departAt, legId, code, qrText, qrFormat, validFrom, validTo, openUrl, note, extra, kept, tFrom, tTo, tArrive, tPassenger, tNumber, tCp, tCarriage, tSeat, added, qrImg]);
  const draftRef = useRef(buildDraft);
  draftRef.current = buildDraft;
  // La bozza si salva solo se qualcosa è cambiato rispetto al modulo appena aperto
  const sigOf = (d: WalletDraft) => JSON.stringify([d.fields, d.added.map((x) => x.meta.id), d.qrImg?.meta.id]);
  const baseSig = useRef<string | null>(null);
  if (baseSig.current === null) baseSig.current = draft ? '' : sigOf(buildDraft());
  const flushDraft = useCallback(() => {
    if (closedRef.current) return;
    const d = draftRef.current();
    if (sigOf(d) !== baseSig.current) void saveDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = window.setTimeout(flushDraft, 400);
    return () => window.clearTimeout(t);
  }, [buildDraft, flushDraft]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flushDraft();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushDraft);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushDraft);
    };
  }, [flushDraft]);

  const close = async () => {
    closedRef.current = true;
    await clearDraft(ownerId);
    onClose();
  };

  const applyScan = (r: ScanResult, frame: Blob | null) => {
    setScanOpen(false);
    if (r.format === 'qr_code') {
      setQrText(r.text);
      setQrFormat('qr_code');
      setQrImg(null);
      setScanMsg({ ok: true, text: 'Codice letto: lo mostrerò come QR nitido.' });
    } else if (frame) {
      void keepAsPhoto(frame, `Codice ${r.format.replace('_', ' ')}: non è un QR, quindi lo tengo come foto e lo mostro a schermo intero.`);
    }
  };

  const keepAsPhoto = async (blob: Blob, text: string) => {
    try {
      const prepared = await prepareFile(new File([blob], 'codice.jpg', { type: blob.type || 'image/jpeg' }));
      setQrImg(prepared);
      setQrText('');
      setQrFormat(undefined);
      setScanMsg({ ok: false, text });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /** Foto del codice dalla galleria o dalla fotocamera di sistema */
  const onCodeImage = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setScanMsg(null);
    setScanBusy(true);
    try {
      const r = await scanBlob(file);
      if (r?.format === 'qr_code') return applyScan(r, null);
      await keepAsPhoto(file, r ? `Codice ${r.format.replace('_', ' ')}: non è un QR, quindi lo tengo come foto e lo mostro a schermo intero.` : 'Non riesco a leggere il codice: tengo la foto e la mostro a schermo intero, su fondo bianco.');
    } finally {
      setScanBusy(false);
    }
  };

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
    const isTrain = kind === 'train';
    if (isTrain && (!tFrom.trim() || !tTo.trim())) return setError('Scrivi la stazione di partenza e quella di arrivo.');
    const trainInfo = isTrain
      ? { from: tFrom.trim(), to: tTo.trim(), arrive: tArrive || undefined, passenger: tPassenger.trim() || undefined, number: tNumber.trim() || undefined, cp: tCp.trim() || undefined, carriage: tCarriage.trim() || undefined, seat: tSeat.trim() || undefined }
      : undefined;
    const heads = trainInfo ? trainHeadings(trainInfo, departAt) : null;
    const t = heads ? heads.title : title.trim();
    if (!t) return setError('Dai un nome alla scheda.');
    const cleanExtra = extra.map((e) => ({ label: e.label.trim(), value: e.value.trim() })).filter((e) => e.label && e.value);
    // Il Wallet non è un posto per i numeri delle carte di pagamento
    const scan = [t, subtitle, code, note, tPassenger, tNumber, tCarriage, tSeat, ...cleanExtra.map((e) => e.value)].join(' | ');
    if (looksLikeCardNumber(scan)) return setError('Sembra un numero di carta di pagamento: per sicurezza non lo salvo nel Wallet.');
    if (validFrom && validTo && validTo < validFrom) return setError('La data di fine è prima di quella di inizio.');
    const now = new Date().toISOString();
    const finalFiles = [...kept, ...(qrImg && !qrText ? [qrImg.meta] : []), ...added.map((a) => a.meta)];
    const removed = (initial?.files ?? []).filter((f) => !finalFiles.some((k) => k.id === f.id)).map((f) => f.id);
    const newFiles = [...added, ...(qrImg?.file && !qrText ? [{ file: qrImg.file, meta: qrImg.meta }] : [])];
    const item: WalletItem = {
      id: initial?.id ?? newId(),
      ownerId,
      kind,
      preset: initial?.preset ?? presetId,
      legId: legId || undefined,
      departAt: kind === 'train' && departAt ? departAt : undefined,
      title: t,
      subtitle: heads ? heads.subtitle : subtitle.trim() || undefined,
      train: trainInfo,
      code: code.trim() || undefined,
      qrText: qrText.trim() || undefined,
      qrFormat: qrText.trim() ? qrFormat ?? 'qr_code' : undefined,
      qrFileId: qrImg && !qrText.trim() ? qrImg.meta.id : undefined,
      validFrom: validFrom || undefined,
      // Il treno scade il giorno della partenza
      validTo: kind === 'train' && departAt ? departAt.slice(0, 10) : validTo || undefined,
      openUrl: openUrl.trim() || undefined,
      extra: cleanExtra,
      note: note.trim() || undefined,
      pinned: initial?.pinned,
      files: finalFiles,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now
    };
    setSaving(true);
    try {
      await saveItem(item, newFiles, removed);
      closedRef.current = true;
      await clearDraft(ownerId);
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

  const showQr = kind === 'pass' || kind === 'train';
  const showDates = kind === 'pass' || kind === 'other';
  const codeLabel =
    kind === 'flight' || kind === 'train' ? 'Codice di prenotazione (PNR)' : kind === 'other' ? 'Numero polizza o documento' : 'Codice o numero prenotazione';

  return (
    <div className="fixed inset-0 z-[800] flex items-end sm:items-center justify-center bg-black/70" role="dialog" aria-modal="true" aria-label="Scheda del Wallet" data-testid="wallet-form">
      <div className="w-full sm:max-w-xl max-h-[94dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${info.gradient}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white font-display">{initial ? 'Modifica scheda' : `Nuova scheda · ${info.label}`}</p>
            <p className="text-[11px] text-slate-400 truncate">{info.hint}</p>
          </div>
          <button type="button" onClick={close} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
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

          {kind === 'train' ? (
            <div className="space-y-3" data-testid="wf-train">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="wf-from">Da</label>
                  <input id="wf-from" value={tFrom} onChange={(e) => setTFrom(e.target.value)} className={inputCls} placeholder="Padova" maxLength={40} data-testid="wf-from" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="wf-to-st">A</label>
                  <input id="wf-to-st" value={tTo} onChange={(e) => setTTo(e.target.value)} className={inputCls} placeholder="Milano Centrale" maxLength={40} data-testid="wf-to-st" />
                </div>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_8.75rem] gap-3">
                <div>
                  <label className={labelCls} htmlFor="wf-depart">Partenza (ora italiana)</label>
                  <input id="wf-depart" type="datetime-local" value={departAt} onChange={(e) => setDepartAt(e.target.value)} className={`${inputCls} min-w-0 [color-scheme:dark]`} data-testid="wf-depart" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="wf-arrive">Arrivo</label>
                  <input id="wf-arrive" type="time" value={tArrive} onChange={(e) => setTArrive(e.target.value)} className={`${inputCls} min-w-0 [color-scheme:dark]`} data-testid="wf-arrive" />
                </div>
              </div>
              <p className="-mt-1 text-[11px] text-slate-500 leading-snug">La partenza serve per il conto alla rovescia e per averlo in evidenza in «Oggi» prima di partire.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="wf-pass">Passeggero</label>
                  <input id="wf-pass" value={tPassenger} onChange={(e) => setTPassenger(e.target.value)} className={inputCls} autoCapitalize="characters" maxLength={50} data-testid="wf-passenger" />
                </div>
                <div>
                  <label className={labelCls} htmlFor="wf-num">Treno</label>
                  <input id="wf-num" value={tNumber} onChange={(e) => setTNumber(e.target.value)} className={inputCls} placeholder="FR 9700" autoCapitalize="characters" maxLength={20} data-testid="wf-number" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls} htmlFor="wf-cp">CP</label>
                  <input id="wf-cp" value={tCp} onChange={(e) => setTCp(e.target.value)} className={`${inputCls} font-mono`} autoCapitalize="characters" maxLength={20} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="wf-car">Carrozza</label>
                  <input id="wf-car" value={tCarriage} onChange={(e) => setTCarriage(e.target.value)} className={inputCls} maxLength={10} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="wf-seat">Posto</label>
                  <input id="wf-seat" value={tSeat} onChange={(e) => setTSeat(e.target.value)} className={inputCls} autoCapitalize="characters" maxLength={10} />
                </div>
              </div>
            </div>
          ) : (
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
          )}

          <div>
            <label className={labelCls} htmlFor="wf-code">{codeLabel}</label>
            <input id="wf-code" value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} font-mono`} autoCapitalize="characters" autoComplete="off" data-testid="wf-code" />
          </div>

          {showQr && (
            <div data-testid="wf-qr-block">
              <p className={labelCls}>Codice QR del biglietto</p>
              {(qrText || qrImg) && (
                <div className={`mb-2 flex items-center gap-3 rounded-xl border p-2.5 ${qrText ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10'}`} data-testid="wf-qr-state" data-mode={qrText ? 'qr' : 'photo'}>
                  <div className="w-16 h-16 rounded-lg bg-white overflow-hidden shrink-0 flex items-center justify-center">
                    {qrPreview ? <img src={qrPreview} alt="" className="w-full h-full object-contain" /> : <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white flex items-center gap-1.5">{qrText ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /> QR letto</> : 'Foto del codice'}</p>
                    <p className="text-[11px] text-slate-300 leading-snug">{qrText ? 'Lo mostro nitido a schermo intero, anche senza rete.' : 'La mostro a schermo intero su fondo bianco.'}</p>
                  </div>
                  <button type="button" onClick={() => { setQrText(''); setQrFormat(undefined); setQrImg(null); setScanMsg(null); }} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:text-rose-300 flex items-center justify-center" aria-label="Togli il codice" data-testid="wf-qr-remove"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { flushDraft(); setScanMsg(null); setScanOpen(true); }} disabled={scanBusy} className="min-h-[48px] rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-sm font-bold flex items-center justify-center gap-2" data-testid="wf-qr-camera"><ScanLine className="w-4 h-4" /> Inquadra</button>
                <label className="min-h-[48px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer">
                  {scanBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />} Dalla galleria
                  <input type="file" accept="image/*" className="sr-only" onClick={flushDraft} onChange={(e) => { void onCodeImage(e.target.files?.[0]); e.target.value = ''; }} data-testid="wf-qr-file" />
                </label>
              </div>
              <input ref={sysCamRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void onCodeImage(e.target.files?.[0]); e.target.value = ''; }} data-testid="wf-qr-syscam" />
              {scanMsg && <p className={`mt-2 text-[11px] leading-snug ${scanMsg.ok ? 'text-emerald-300' : 'text-amber-200'}`} role="status" data-testid="wf-qr-msg">{scanMsg.text}</p>}
              <p className="mt-1.5 text-[11px] text-slate-500 leading-snug">«Inquadra» apre la fotocamera dentro l’app, senza uscire. Puoi anche scegliere lo screenshot del biglietto dalla galleria.</p>
              <details className="mt-2">
                <summary className="text-[11px] text-slate-400 cursor-pointer min-h-[32px] flex items-center">Oppure incolla il testo del codice</summary>
                <textarea id="wf-qr" value={qrText} onChange={(e) => { setQrText(e.target.value); setQrFormat('qr_code'); if (e.target.value) setQrImg(null); }} rows={2} className={`${inputCls} py-2 font-mono text-xs mt-1`} placeholder="Incolla qui il codice: l’app lo mostra come QR da scansionare" data-testid="wf-qr" />
              </details>
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

          {(kind === 'pass' || kind === 'train') && (
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
          <button type="button" onClick={close} className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-200 text-sm font-semibold">Annulla</button>
          <button type="button" onClick={save} disabled={saving || busyFiles} className="min-h-[48px] rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-sm font-bold" data-testid="wf-save">{saving ? 'Salvo…' : 'Salva'}</button>
        </div>
      </div>
      {scanOpen && (
        <QrScanner
          onResult={applyScan}
          onPhoto={(b) => { setScanOpen(false); void keepAsPhoto(b, 'Tengo la foto e la mostro a schermo intero, su fondo bianco.'); }}
          onClose={() => setScanOpen(false)}
          onUnavailable={() => { setScanOpen(false); setScanMsg({ ok: false, text: 'La fotocamera dell’app non è disponibile: apro quella del telefono.' }); flushDraft(); window.setTimeout(() => sysCamRef.current?.click(), 50); }}
        />
      )}
    </div>
  );
};

export default WalletForm;
