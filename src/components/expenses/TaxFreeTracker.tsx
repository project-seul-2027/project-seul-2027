import React, { useMemo, useState } from 'react';
import { Check, CircleAlert, PlaneTakeoff, Plus, Receipt, Store, Trash2 } from 'lucide-react';
import type { LiveExchangeRates } from '../../services/currencyService';
import {
  TAX_FREE_INSTANT_MAX_KRW, TAX_FREE_MIN_KRW, estimateRefundKrw, loadTaxFree, saveTaxFree,
  type TaxFreeEntry, type TaxFreeStatus
} from '../../services/taxFreeStore';
import { formatDay, formatEur, todayIso } from '../../types/expenses';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';

const STATUS_META: Record<TaxFreeStatus, { label: string; short: string; tone: string }> = {
  kiosk: { label: 'Da passare a Incheon', short: 'Chiosco Incheon', tone: 'text-amber-300 bg-amber-500/15' },
  instant: { label: 'Già detassato in cassa', short: 'Detassato in cassa', tone: 'text-[#52d9e6] bg-[#52d9e6]/15' },
  refunded: { label: 'Rimborso ritirato', short: 'Ritirato', tone: 'text-emerald-300 bg-emerald-500/15' }
};

const fmtKrw = (n: number) => `₩${Math.round(n).toLocaleString('it-IT')}`;

interface TaxFreeTrackerProps {
  uid: string | null;
  rates: LiveExchangeRates;
  onCountChange?: (pendingKioskCount: number) => void;
}

/**
 * Tracker personale per gli acquisti Tax-Free in Corea (soglia 15.000 KRW).
 * Dati salvati sul telefono: funziona offline in negozio e al chiosco a Incheon.
 */
export const TaxFreeTracker: React.FC<TaxFreeTrackerProps> = ({ uid, rates, onCountChange }) => {
  const [items, setItems] = useState<TaxFreeEntry[]>(() => loadTaxFree(uid));
  const [adding, setAdding] = useState(false);
  const [store, setStore] = useState('');
  const [amountText, setAmountText] = useState('');
  const [status, setStatus] = useState<TaxFreeStatus>('kiosk');
  const [date, setDate] = useState(todayIso);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = (next: TaxFreeEntry[]) => {
    setItems(next);
    saveTaxFree(uid, next);
    onCountChange?.(next.filter((i) => i.status === 'kiosk').length);
  };

  const amountNum = Number(amountText.replace(/[^\d]/g, ''));
  const belowMin = amountNum > 0 && amountNum < TAX_FREE_MIN_KRW;
  const aboveInstantMax = status === 'instant' && amountNum > TAX_FREE_INSTANT_MAX_KRW;

  const stats = useMemo(() => {
    const kiosk = items.filter((i) => i.status === 'kiosk');
    const done = items.filter((i) => i.status !== 'kiosk');
    const kioskSpend = kiosk.reduce((s, i) => s + i.amountKrw, 0);
    const kioskRefundKrw = kiosk.reduce((s, i) => s + estimateRefundKrw(i.amountKrw), 0);
    const doneSpend = done.reduce((s, i) => s + i.amountKrw, 0);
    const doneRefundKrw = done.reduce((s, i) => s + estimateRefundKrw(i.amountKrw), 0);
    return {
      kioskCount: kiosk.length,
      kioskSpend,
      kioskRefundKrw,
      kioskRefundEurCents: rates.KRW > 0 ? Math.round((kioskRefundKrw / rates.KRW) * 100) : 0,
      doneCount: done.length,
      doneSpend,
      doneRefundKrw
    };
  }, [items, rates.KRW]);

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStore = store.trim();
    if (!cleanStore) {
      setError('Scrivi il nome del negozio.');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Inserisci l’importo in won.');
      return;
    }
    const entry: TaxFreeEntry = {
      id: `tf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      store: cleanStore.slice(0, 60),
      amountKrw: Math.round(amountNum),
      status,
      date: date || todayIso(),
      ...(note.trim() ? { note: note.trim().slice(0, 120) } : {}),
      createdAt: Date.now()
    };
    commit([entry, ...items]);
    setStore('');
    setAmountText('');
    setNote('');
    setStatus('kiosk');
    setDate(todayIso());
    setError(null);
    setAdding(false);
  };

  const toggleKioskDone = (id: string) => {
    commit(
      items.map((item) => {
        if (item.id !== id) return item;
        const nextStatus: TaxFreeStatus =
          item.status === 'kiosk' ? 'refunded' : item.status === 'refunded' ? 'kiosk' : 'instant';
        return { ...item, status: nextStatus };
      })
    );
  };

  const cycleStatus = (id: string) => {
    const order: TaxFreeStatus[] = ['kiosk', 'instant', 'refunded'];
    commit(
      items.map((item) => {
        if (item.id !== id) return item;
        const next = order[(order.indexOf(item.status) + 1) % order.length];
        return { ...item, status: next };
      })
    );
  };

  const removeItem = (id: string) => {
    commit(items.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-4" data-testid="tax-free-tracker">
      {/* Riepilogo */}
      <section className="rounded-xl bg-[#101c29] p-4 sm:p-5 space-y-3" data-keep-style>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-white">Tax-Free Corea</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Acquisti personali sopra i {TAX_FREE_MIN_KRW.toLocaleString('it-IT')} ₩ · salvati sul telefono anche offline.
            </p>
          </div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              data-keep-style
              className={`min-h-11 px-3.5 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors ${FOCUS_RING}`}
              data-testid="taxfree-add-open"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Aggiungi
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-white/[0.08]">
          <div>
            <div className="text-xs text-slate-400">Da passare a Incheon</div>
            <div className="mt-0.5 text-lg font-bold font-display tabular-nums text-white">
              {stats.kioskCount} {stats.kioskCount === 1 ? 'ricevuta' : 'ricevute'}
            </div>
            <div className="text-xs tabular-nums text-amber-300">
              {stats.kioskRefundKrw > 0
                ? `stima rimborso ~${fmtKrw(stats.kioskRefundKrw)} (${formatEur(stats.kioskRefundEurCents)})`
                : 'nessuna in attesa'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Già sistemati</div>
            <div className="mt-0.5 text-lg font-bold font-display tabular-nums text-white">
              {stats.doneCount} {stats.doneCount === 1 ? 'acquisto' : 'acquisti'}
            </div>
            <div className="text-xs tabular-nums text-slate-400">
              {stats.doneSpend > 0 ? `totale ${fmtKrw(stats.doneSpend)}` : 'cassa o già ritirati'}
            </div>
          </div>
        </div>
      </section>

      {/* Modulo nuovo acquisto */}
      {adding && (
        <form onSubmit={addItem} className="rounded-xl bg-[#101c29] p-4 sm:p-5 space-y-3.5" data-keep-style data-testid="taxfree-form">
          <div className="font-display text-sm font-semibold text-white">Nuovo acquisto Tax-Free</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tf-store" className="block text-xs text-slate-300 mb-1">Negozio</label>
              <input
                id="tf-store"
                type="text"
                value={store}
                onChange={(e) => {
                  setStore(e.target.value);
                  setError(null);
                }}
                placeholder="Es. Olive Young Myeongdong"
                maxLength={60}
                autoFocus
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
                data-testid="taxfree-store"
              />
            </div>

            <div>
              <label htmlFor="tf-amount" className="block text-xs text-slate-300 mb-1">Importo (KRW)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₩</span>
                <input
                  id="tf-amount"
                  type="text"
                  inputMode="numeric"
                  value={amountText}
                  onChange={(e) => {
                    setAmountText(e.target.value.replace(/[^\d]/g, '').slice(0, 9));
                    setError(null);
                  }}
                  placeholder="45000"
                  data-keep-style
                  className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 pl-7 pr-3 text-sm font-semibold tabular-nums text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
                  data-testid="taxfree-amount"
                />
              </div>
            </div>
          </div>

          {belowMin && (
            <p className="text-xs text-amber-300 flex items-start gap-1.5">
              <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              Sotto i 15.000 ₩: in Corea il Tax-Free si applica da 15.000 ₩ per singolo scontrino.
            </p>
          )}
          {aboveInstantMax && (
            <p className="text-xs text-amber-300 flex items-start gap-1.5">
              <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              Oltre 1.000.000 ₩ a scontrino il rimborso non è immediato in cassa ma va fatto al chiosco a Incheon.
            </p>
          )}

          <div>
            <span className="block text-xs text-slate-300 mb-1.5">Stato rimborso</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Stato rimborso">
              {(
                [
                  ['kiosk', 'Da passare a Incheon'],
                  ['instant', 'Già detassato in cassa']
                ] as const
              ).map(([id, label]) => {
                const selected = status === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setStatus(id)}
                    data-keep-style
                    className={`min-h-11 rounded-xl px-3 text-xs sm:text-sm font-medium transition-colors ${FOCUS_RING} ${
                      selected ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-[#0a1119] text-slate-200 hover:bg-white/[0.06]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tf-date" className="block text-xs text-slate-300 mb-1">Data</label>
              <input
                id="tf-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#52d9e6]"
              />
            </div>
            <div>
              <label htmlFor="tf-note" className="block text-xs text-slate-300 mb-1">Nota (opzionale)</label>
              <input
                id="tf-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Es. busta Global Blue in valigia"
                maxLength={120}
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-300 flex items-center gap-1.5">
              <CircleAlert className="w-3.5 h-3.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              data-keep-style
              className={`flex-1 sm:flex-none sm:px-6 min-h-11 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] text-sm font-semibold transition-colors ${FOCUS_RING}`}
              data-testid="taxfree-save"
            >
              Salva acquisto
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
              data-keep-style
              className={`min-h-11 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-sm font-medium transition-colors ${FOCUS_RING}`}
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {/* Elenco acquisti */}
      {items.length === 0 ? (
        <div className="rounded-xl bg-[#101c29] px-4 py-7 text-center space-y-2" data-keep-style>
          <Receipt className="w-6 h-6 text-slate-500 mx-auto" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-200">Nessun acquisto Tax-Free segnato</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Quando fai acquisti da 15.000 ₩ in su (Olive Young, abbigliamento, elettronica, souvenir), segnali qui per ricordare cosa passare al chiosco a Incheon.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {items.map((item) => {
            const meta = STATUS_META[item.status];
            const refundKrw = estimateRefundKrw(item.amountKrw);
            return (
              <div key={item.id} className="py-3.5 flex items-start gap-3" data-testid="taxfree-row">
                <button
                  type="button"
                  onClick={() => (item.status === 'instant' ? cycleStatus(item.id) : toggleKioskDone(item.id))}
                  aria-label={item.status === 'kiosk' ? `Segna ${item.store} come ritirato` : `Cambia stato di ${item.store}`}
                  title="Tocca per cambiare stato"
                  data-keep-style
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${FOCUS_RING} ${
                    item.status === 'refunded'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : item.status === 'instant'
                        ? 'bg-[#52d9e6]/15 text-[#52d9e6]'
                        : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                  }`}
                >
                  {item.status === 'refunded' ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  ) : item.status === 'instant' ? (
                    <Store className="w-4 h-4" />
                  ) : (
                    <PlaneTakeoff className="w-4 h-4" />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className={`text-sm font-semibold ${item.status === 'refunded' ? 'line-through text-slate-400' : 'text-white'}`}>
                      {item.store}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-white">{fmtKrw(item.amountKrw)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <button
                      type="button"
                      onClick={() => cycleStatus(item.id)}
                      data-keep-style
                      className={`px-2 py-0.5 rounded-md font-medium ${meta.tone} ${FOCUS_RING}`}
                    >
                      {meta.short}
                    </button>
                    <span className="text-slate-400">{formatDay(item.date)}</span>
                    {refundKrw > 0 && item.status === 'kiosk' && (
                      <span className="text-slate-400 tabular-nums">· ~{fmtKrw(refundKrw)} stimati</span>
                    )}
                  </div>
                  {item.note && <p className="mt-1 text-xs text-slate-400 leading-snug">{item.note}</p>}
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Elimina ${item.store}`}
                  data-keep-style
                  className={`min-h-10 min-w-10 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-white/[0.04] flex items-center justify-center shrink-0 transition-colors ${FOCUS_RING}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Promemoria compatto per Incheon */}
      <details className="rounded-xl bg-[#101c29] px-4 py-3 text-xs text-slate-300" data-keep-style>
        <summary className="cursor-pointer font-semibold text-slate-200 select-none min-h-8 flex items-center">
          Come funziona il rimborso a Incheon
        </summary>
        <ul className="mt-2.5 space-y-1.5 list-disc pl-4 text-slate-400 leading-relaxed marker:text-[#52d9e6]">
          <li>Porta sempre il passaporto in negozio: nei negozi aderenti fino a 1.000.000 ₩ lo sconto IVA è immediato in cassa.</li>
          <li>Se hai ricevute da rimborsare in aeroporto, scansionale ai chioschi Tax Refund a Incheon <b className="text-slate-200">prima di imbarcare i bagagli</b> se gli oggetti sono in stiva.</li>
          <li>Ritira il rimborso (carta o contanti) al banco Tax Refund dopo i controlli di sicurezza, vicino ai gate.</li>
        </ul>
      </details>
    </div>
  );
};
