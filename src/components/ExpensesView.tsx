import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight, Check, CircleAlert, CloudOff, HandCoins, Loader2, Pencil, PlaneTakeoff, Plus, Receipt, Search, Trash2, Undo2, Wallet, X
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useMediaQuery } from '../pwa';
import { FALLBACK_RATES, getLiveExchangeRates, type LiveExchangeRates } from '../services/currencyService';
import {
  addExpense, deleteExpense, friendlyExpenseError, setRepaid, settlePair, updateExpense, watchExpenses
} from '../services/expenseService';
import type { TravelerSlotId } from '../shared/travelerProfile';
import { LEAVER_DEPARTURE_DAY, LEAVER_SLOT, nowOrSim, presentSlots, seoulDateIso } from '../shared/tripPresence';
import { CurrencyConverter, QuickExpenseBody, recentTitles, type QuickDraft } from './expenses/QuickExpense';
import type { Traveler } from '../data/tripData';
import {
  CURRENCY_DECIMALS, CURRENCY_SYMBOL, EXPENSE_CATEGORIES, SLOTS, canEdit, canMarkRepaid, debtsOf, formatDay, formatEur,
  formatOriginal, isSlot, myStatus, pairBalances, sharesFromInput, summarize, toEurCents, todayIso, validateInput,
  type Expense, type ExpenseCategory, type ExpenseCurrency, type ExpenseInput, type PairBalance, type PersonSummary
} from '../types/expenses';

/**
 * Spese di gruppo: chi ha anticipato, chi deve quanto a chi, chi ha già restituito.
 * Telefono: saldo in alto, tre sotto-schede (Saldi, Spese, Riepilogo) e pulsante "+" con foglio dal basso.
 * Desktop: saldi e riepilogo a sinistra, tabella delle spese a destra, moduli in finestre centrate.
 */

type MobileTab = 'balances' | 'list' | 'summary';
type ListFilter = 'all' | 'open' | 'mine';

const categoryOf = (id: ExpenseCategory) => EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[5];

// ---------------------------------------------------------------------------
// Piccoli elementi
// ---------------------------------------------------------------------------

const Dot: React.FC<{ color: string; className?: string }> = ({ color, className = '' }) => (
  <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${className}`} style={{ backgroundColor: color }} />
);

function useNames(travelers: Traveler[], me: TravelerSlotId | null) {
  return useMemo(() => {
    const byId = Object.fromEntries(travelers.map((t) => [t.id, t])) as Record<string, Traveler>;
    const name = (s: TravelerSlotId) => (s === me ? 'Tu' : byId[s]?.name ?? s);
    const fullName = (s: TravelerSlotId) => byId[s]?.name ?? s;
    const color = (s: TravelerSlotId) => byId[s]?.color ?? '#64748b';
    return { name, fullName, color };
  }, [travelers, me]);
}
type Names = ReturnType<typeof useNames>;

const StatusPill: React.FC<{ e: Expense; me: TravelerSlotId | null }> = ({ e, me }) => {
  const st = myStatus(e, me);
  const base = 'text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap';
  switch (st.kind) {
    case 'owe':
      return <span className={`${base} bg-amber-500/15 text-amber-300`}>Devi {formatEur(st.cents)}</span>;
    case 'repaid':
      return <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Restituita</span>;
    case 'lent':
      return st.open > 0 ? (
        <span className={`${base} bg-cyan-500/15 text-cyan-300`}>Ti devono {formatEur(st.open)}</span>
      ) : (
        <span className={`${base} bg-emerald-500/15 text-emerald-300`}>Rimborsata</span>
      );
    case 'paidOwn':
      return <span className={`${base} bg-slate-700/60 text-slate-300`}>Solo tua</span>;
    default:
      return <span className={`${base} bg-slate-800 text-slate-500`}>Non ti riguarda</span>;
  }
};

/** Foglio dal basso su telefono, finestra centrata su desktop */
const Sheet: React.FC<{
  title: string;
  onClose: () => void;
  isDesktop: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ title, onClose, isDesktop, children, footer }) => {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex justify-center ${
        isDesktop ? 'items-center p-6' : 'items-end'
      }`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(ev) => ev.stopPropagation()}
        className={`bg-slate-900 border border-slate-700/80 shadow-2xl w-full flex flex-col text-slate-200 ${
          isDesktop ? 'max-w-lg rounded-3xl max-h-[90vh]' : 'rounded-t-3xl max-h-[92dvh] pb-[env(safe-area-inset-bottom)]'
        }`}
      >
        <div className="relative flex items-center justify-between gap-3 px-4 pt-3 pb-2 border-b border-slate-800 shrink-0">
          {!isDesktop && <span className="absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-slate-700" />}
          <h3 className="font-bold text-white text-base truncate pt-1">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="w-9 h-9 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-3 space-y-4">{children}</div>
        {footer && <div className="shrink-0 px-4 py-3 border-t border-slate-800">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

// ---------------------------------------------------------------------------
// Modulo nuova spesa / modifica
// ---------------------------------------------------------------------------

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : NaN;
}

function amountToText(v: number, currency: ExpenseCurrency): string {
  if (!v) return '';
  return v.toLocaleString('it-IT', { maximumFractionDigits: CURRENCY_DECIMALS[currency], useGrouping: false });
}

const ExpenseForm: React.FC<{
  initial: Expense | null;
  /** Dati già scelti nella spesa veloce ("Più opzioni") */
  prefill?: QuickDraft | null;
  me: TravelerSlotId | null;
  travelers: Traveler[];
  names: Names;
  rates: LiveExchangeRates;
  isDesktop: boolean;
  onCancel: () => void;
  onSubmit: (input: ExpenseInput) => void;
}> = ({ initial, prefill, me, travelers, names, rates, isDesktop, onCancel, onSubmit }) => {
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? prefill?.category ?? 'food');
  const [date, setDate] = useState(initial?.date ?? todayIso());
  const [currency, setCurrency] = useState<ExpenseCurrency>(initial?.currency ?? prefill?.currency ?? 'KRW');
  const [amountText, setAmountText] = useState(
    initial ? amountToText(initial.originalAmount, initial.currency) : prefill?.amount ? amountToText(prefill.amount, prefill.currency) : ''
  );
  const [rateText, setRateText] = useState(() => {
    const cur = initial?.currency ?? prefill?.currency ?? 'KRW';
    const r = initial && initial.currency !== 'EUR' ? initial.rate : cur === 'EUR' ? 1 : rates[cur];
    return String(r).replace('.', ',');
  });
  const [paidBy, setPaidBy] = useState<TravelerSlotId>(initial?.paidBy ?? me ?? 't1');
  const [splitMode, setSplitMode] = useState(initial?.splitMode ?? 'equal');
  const [participants, setParticipants] = useState<TravelerSlotId[]>(
    initial ? SLOTS.filter((s) => (initial.shares[s] ?? 0) > 0) : prefill?.participants ?? presentSlots(todayIso())
  );
  // Nuova spesa: finché non si tocca la lista, si divide tra chi è in viaggio nella data scelta
  const [touchedPeople, setTouchedPeople] = useState(!!initial || !!prefill?.peopleTouched);
  useEffect(() => {
    if (!touchedPeople) setParticipants(presentSlots(date));
  }, [date, touchedPeople]);
  const leaverAbsent = !initial && !presentSlots(date).includes(LEAVER_SLOT);
  const [exactText, setExactText] = useState<Partial<Record<TravelerSlotId, string>>>(() => {
    if (!initial || initial.splitMode !== 'exact') return {};
    const out: Partial<Record<TravelerSlotId, string>> = {};
    for (const s of SLOTS) {
      const c = initial.shares[s];
      if (c) out[s] = amountToText(Math.round(((c / 100) * initial.rate) * 10 ** CURRENCY_DECIMALS[initial.currency]) / 10 ** CURRENCY_DECIMALS[initial.currency], initial.currency);
    }
    return out;
  });
  const [note, setNote] = useState(initial?.note ?? '');
  const [showNote, setShowNote] = useState(!!initial?.note);
  const [error, setError] = useState<string | null>(null);

  const changeCurrency = (c: ExpenseCurrency) => {
    setCurrency(c);
    setRateText(String(c === 'EUR' ? 1 : rates[c]).replace('.', ','));
  };

  const amount = parseAmount(amountText);
  const rate = currency === 'EUR' ? 1 : parseAmount(rateText);
  const exactAmounts = Object.fromEntries(
    SLOTS.map((s) => [s, parseAmount(exactText[s] ?? '') || 0])
  ) as Partial<Record<TravelerSlotId, number>>;
  const input: ExpenseInput = {
    title, category, date, currency, originalAmount: amount, rate, paidBy, splitMode, participants, exactAmounts, note
  };
  const totalCents = amount > 0 && rate > 0 ? toEurCents(amount, rate) : 0;
  const preview = totalCents > 0 ? sharesFromInput(input) : {};
  const assigned = SLOTS.reduce((acc, s) => acc + (exactAmounts[s] ?? 0), 0);
  const remaining = (amount || 0) - assigned;

  const submit = () => {
    const err = validateInput(input);
    if (err) {
      setError(err);
      return;
    }
    onSubmit(input);
  };

  const toggle = (s: TravelerSlotId) => {
    setTouchedPeople(true);
    setParticipants((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const chip = (active: boolean) =>
    `h-9 px-3 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
      active ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-300'
    }`;

  return (
    <Sheet
      title={initial ? 'Modifica spesa' : 'Nuova spesa'}
      onClose={onCancel}
      isDesktop={isDesktop}
      footer={
        <div className="space-y-2">
          {error && (
            <p role="alert" className="text-xs text-amber-300 flex items-start gap-1.5">
              <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            className="w-full h-11 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm active:scale-[0.99] transition-transform"
          >
            {initial ? 'Salva modifiche' : 'Aggiungi spesa'}
          </button>
        </div>
      }
    >
      {/* Importo e valuta */}
      <div>
        <div className="flex items-stretch gap-2">
          <input
            autoFocus={!initial}
            inputMode="decimal"
            placeholder="0"
            value={amountText}
            onChange={(ev) => {
              setAmountText(ev.target.value);
              setError(null);
            }}
            aria-label="Importo"
            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 h-14 text-2xl font-bold font-mono text-white focus:outline-none focus:border-emerald-500"
          />
          <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1 shrink-0" role="group" aria-label="Valuta">
            {(['KRW', 'EUR', 'CNY'] as ExpenseCurrency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => changeCurrency(c)}
                aria-pressed={currency === c}
                className={`w-11 rounded-lg text-sm font-bold ${currency === c ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
              >
                {CURRENCY_SYMBOL[c]}
              </button>
            ))}
          </div>
        </div>
        {currency !== 'EUR' && (
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
            <span>1 € =</span>
            <input
              inputMode="decimal"
              value={rateText}
              onChange={(ev) => setRateText(ev.target.value)}
              aria-label="Cambio"
              className="w-20 bg-slate-950 border border-slate-800 rounded-md px-1.5 py-0.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <span>{CURRENCY_SYMBOL[currency]}</span>
            {totalCents > 0 && <span className="ml-auto text-emerald-300 font-bold">≈ {formatEur(totalCents)}</span>}
          </div>
        )}
      </div>

      <input
        placeholder="Descrizione (es. Cena BBQ a Hongdae)"
        value={title}
        maxLength={80}
        onChange={(ev) => {
          setTitle(ev.target.value);
          setError(null);
        }}
        aria-label="Descrizione"
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 h-11 text-sm text-white focus:outline-none focus:border-emerald-500"
      />

      <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5" role="group" aria-label="Categoria">
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={`${chip(category === c.id)} shrink-0`}>
            <span>{c.emoji}</span>
            {c.label}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between gap-3 text-xs text-slate-400">
        <span className="font-semibold">Data</span>
        <input
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 h-9 text-sm text-white [color-scheme:dark] focus:outline-none focus:border-emerald-500"
        />
      </label>

      {/* Chi ha pagato */}
      <div>
        <p className="text-xs font-semibold text-slate-400 mb-1.5">Ha pagato</p>
        <div className="grid grid-cols-2 gap-1.5">
          {travelers.map((t) => {
            const s = t.id as TravelerSlotId;
            return (
              <button key={s} type="button" onClick={() => setPaidBy(s)} className={`${chip(paidBy === s)} justify-start min-w-0`}>
                <Dot color={t.color} />
                <span className="truncate">{s === me ? `${t.name} (tu)` : t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divisione */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold text-slate-400">Divisa tra</p>
          <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-[11px] font-semibold">
            {(
              [
                ['equal', 'Parti uguali'],
                ['exact', 'Importi esatti']
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setSplitMode(m);
                  setError(null);
                }}
                aria-pressed={splitMode === m}
                className={`px-2.5 py-1 rounded-md ${splitMode === m ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          {travelers.map((t) => {
            const s = t.id as TravelerSlotId;
            const share = preview[s] ?? 0;
            if (splitMode === 'equal') {
              const on = participants.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(s)}
                  aria-pressed={on}
                  className={`w-full h-10 px-3 rounded-xl border flex items-center gap-2.5 text-sm transition-colors ${
                    on ? 'bg-slate-800/70 border-slate-700 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      on ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-slate-600'
                    }`}
                  >
                    {on && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                  <Dot color={t.color} />
                  <span className="truncate flex-1 text-left">{names.name(s)}</span>
                  <span className="font-mono text-xs">{on && share > 0 ? formatEur(share) : '—'}</span>
                </button>
              );
            }
            return (
              <div key={s} className="h-10 px-3 rounded-xl border border-slate-800 bg-slate-950 flex items-center gap-2.5 text-sm">
                <Dot color={t.color} />
                <span className="truncate flex-1">{names.name(s)}</span>
                <input
                  inputMode="decimal"
                  placeholder="0"
                  value={exactText[s] ?? ''}
                  onChange={(ev) => {
                    setExactText((prev) => ({ ...prev, [s]: ev.target.value }));
                    setError(null);
                  }}
                  aria-label={`Quota di ${names.fullName(s)}`}
                  className="w-24 bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-right font-mono text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="text-slate-500 text-xs w-3">{CURRENCY_SYMBOL[currency]}</span>
              </div>
            );
          })}
        </div>
        {splitMode === 'equal' && leaverAbsent && (
          <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <PlaneTakeoff className="w-3.5 h-3.5" /> In questa data {names.fullName(LEAVER_SLOT)} è già ripartito: escluso, ma puoi aggiungerlo.
          </p>
        )}
        {splitMode === 'exact' && amount > 0 && (
          <p className={`mt-1.5 text-[11px] font-mono ${Math.abs(remaining) < 1e-9 ? 'text-emerald-300' : 'text-amber-300'}`}>
            {Math.abs(remaining) < 1e-9
              ? 'Quote complete'
              : remaining > 0
                ? `Da assegnare: ${formatOriginal(remaining, currency)}`
                : `Oltre il totale: ${formatOriginal(-remaining, currency)}`}
          </p>
        )}
      </div>

      {showNote ? (
        <textarea
          placeholder="Nota (facoltativa)"
          value={note}
          maxLength={300}
          rows={2}
          onChange={(ev) => setNote(ev.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
        />
      ) : (
        <button type="button" onClick={() => setShowNote(true)} className="text-xs font-semibold text-slate-400 underline underline-offset-2">
          + Aggiungi una nota
        </button>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------------
// Dettaglio di una spesa
// ---------------------------------------------------------------------------

const ExpenseDetail: React.FC<{
  e: Expense;
  me: TravelerSlotId | null;
  uid: string;
  names: Names;
  isDesktop: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRepaid: (slot: TravelerSlotId, repaid: boolean) => void;
}> = ({ e, me, uid, names, isDesktop, onClose, onEdit, onDelete, onToggleRepaid }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cat = categoryOf(e.category);
  const editable = canEdit(e, uid, me);
  return (
    <Sheet
      title={e.title}
      onClose={onClose}
      isDesktop={isDesktop}
      footer={
        editable ? (
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 flex-1">Eliminare la spesa per tutti?</span>
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-10 px-4 rounded-xl bg-slate-800 text-sm font-semibold">
                Annulla
              </button>
              <button type="button" onClick={onDelete} className="h-10 px-4 rounded-xl bg-rose-500 text-white text-sm font-bold">
                Elimina
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 h-10 rounded-xl bg-slate-800 text-sm font-semibold flex items-center justify-center gap-1.5"
              >
                <Pencil className="w-4 h-4" /> Modifica
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Elimina spesa"
                className="h-10 w-12 rounded-xl bg-rose-500/15 text-rose-300 flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        ) : (
          <p className="text-[11px] text-slate-500 text-center">
            Può modificarla chi l'ha creata o chi ha pagato. Tu puoi segnare restituita la tua quota.
          </p>
        )
      }
    >
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-2xl shrink-0">{cat.emoji}</span>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-white font-mono">{formatEur(e.amountCents)}</div>
          <div className="text-[11px] text-slate-400">
            {e.currency !== 'EUR' && <>{formatOriginal(e.originalAmount, e.currency)} · </>}
            {formatDay(e.date)} · {cat.label}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2">
        <Dot color={names.color(e.paidBy)} />
        <span>
          Ha pagato <strong className="text-white">{names.name(e.paidBy)}</strong>
        </span>
        <span className="ml-auto text-[11px] text-slate-500">{e.splitMode === 'equal' ? 'parti uguali' : 'importi esatti'}</span>
      </div>
      {e.note && <p className="text-xs text-slate-300 whitespace-pre-wrap">{e.note}</p>}

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-400">Quote</p>
        {SLOTS.filter((s) => (e.shares[s] ?? 0) > 0).map((s) => {
          const cents = e.shares[s] ?? 0;
          const isPayer = s === e.paidBy;
          const repaid = !!e.repaid[s];
          const allowed = !isPayer && canMarkRepaid(e, s, me);
          return (
            <div key={s} className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-950/60 px-3 h-12">
              <Dot color={names.color(s)} />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{names.name(s)}</div>
                <div className="text-[10.5px] text-slate-500">
                  {isPayer ? 'Quota di chi ha pagato' : repaid ? 'Restituita' : `Deve a ${names.name(e.paidBy)}`}
                </div>
              </div>
              <span className="font-mono text-sm text-white">{formatEur(cents)}</span>
              {!isPayer &&
                (allowed ? (
                  <button
                    type="button"
                    onClick={() => onToggleRepaid(s, !repaid)}
                    aria-label={repaid ? 'Segna come non restituita' : 'Segna come restituita'}
                    className={`h-8 px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                      repaid ? 'bg-slate-800 text-slate-300' : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
                    {repaid ? <Undo2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    {repaid ? 'Annulla' : 'Restituita'}
                  </button>
                ) : (
                  <span
                    className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                      repaid ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {repaid ? 'Fatto' : 'Aperta'}
                  </span>
                ))}
            </div>
          );
        })}
      </div>
      {e.pending && (
        <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
          <CloudOff className="w-3.5 h-3.5" /> Salvata su questo dispositivo, in attesa di rete.
        </p>
      )}
    </Sheet>
  );
};

// ---------------------------------------------------------------------------
// Sezioni
// ---------------------------------------------------------------------------

const MyBalanceCard: React.FC<{
  me: TravelerSlotId | null;
  summary: Record<TravelerSlotId, PersonSummary>;
  total: number;
  count: number;
  /** Mia quota delle spese di oggi, in centesimi */
  todayShare: number;
  /** Budget giornaliero dal profilo, in euro */
  budgetEur: number;
}> = ({ me, summary, total, count, todayShare, budgetEur }) => {
  const mine = me ? summary[me] : null;
  const net = mine?.net ?? 0;
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-mono text-slate-400">Il tuo saldo</p>
          <p
            className={`text-2xl lg:text-3xl font-bold font-mono ${
              net > 0 ? 'text-emerald-400' : net < 0 ? 'text-amber-400' : 'text-slate-200'
            }`}
          >
            {net > 0 ? '+' : net < 0 ? '−' : ''}
            {formatEur(Math.abs(net))}
          </p>
          <p className="text-[11px] text-slate-400">
            {net > 0 ? 'Devi ricevere dagli altri' : net < 0 ? 'Devi restituire agli altri' : 'Sei in pari con tutti'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase tracking-wider font-mono text-slate-400">Spesa del gruppo</p>
          <p className="text-base font-bold text-white font-mono">{formatEur(total)}</p>
          <p className="text-[11px] text-slate-500">{count} {count === 1 ? 'spesa' : 'spese'}</p>
        </div>
      </div>
      {budgetEur > 0 && (
        <div className="mt-3" data-testid="today-budget">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Oggi (la tua quota)</span>
            <span className="font-mono">
              <span className={todayShare > budgetEur * 100 ? 'text-amber-300 font-bold' : 'text-slate-200 font-bold'}>{formatEur(todayShare)}</span>
              <span className="text-slate-500"> su {formatEur(budgetEur * 100)}</span>
            </span>
          </div>
          <div className="h-1.5 mt-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${todayShare > budgetEur * 100 ? 'bg-amber-400' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, (todayShare / (budgetEur * 100)) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {mine && (mine.owes > 0 || mine.toReceive > 0) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-mono">
          <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-2.5 py-1.5">
            <span className="text-slate-400">Devi dare </span>
            <span className="text-amber-300 font-bold">{formatEur(mine.owes)}</span>
          </div>
          <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-2.5 py-1.5">
            <span className="text-slate-400">Devi ricevere </span>
            <span className="text-emerald-300 font-bold">{formatEur(mine.toReceive)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const BalancesSection: React.FC<{
  balances: PairBalance[];
  me: TravelerSlotId | null;
  names: Names;
  onSettle: (b: PairBalance) => void;
}> = ({ balances, me, names, onSettle }) => {
  const [confirm, setConfirm] = useState<string | null>(null);
  const mine = balances.filter((b) => b.from === me || b.to === me);
  const others = balances.filter((b) => b.from !== me && b.to !== me);
  if (balances.length === 0) {
    return (
      <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-slate-800">
        <HandCoins className="w-8 h-8 mx-auto text-emerald-400/70" />
        <p className="mt-2 text-sm font-semibold text-white">Tutti in pari</p>
        <p className="text-xs text-slate-400">Nessuno deve niente a nessuno.</p>
      </div>
    );
  }
  const row = (b: PairBalance) => {
    const key = `${b.from}-${b.to}`;
    const iOwe = b.from === me;
    const owedToMe = b.to === me;
    const involved = iOwe || owedToMe;
    const label = b.cents === 0 ? 'In pari (quote incrociate)' : iOwe ? `Devi dare a ${names.fullName(b.to)}` : owedToMe ? `${names.fullName(b.from)} ti deve` : null;
    return (
      <div key={key} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Dot color={names.color(b.from)} />
          <span className="text-sm truncate max-w-[30%]">{names.name(b.from)}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <Dot color={names.color(b.to)} />
          <span className="text-sm truncate max-w-[30%]">{names.name(b.to)}</span>
          <span
            className={`ml-auto font-mono font-bold text-sm ${iOwe ? 'text-amber-300' : owedToMe ? 'text-emerald-300' : 'text-slate-200'}`}
          >
            {formatEur(b.cents)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-[10.5px] text-slate-500 truncate">
            {label ? `${label} · ` : ''}
            {b.debts.length} {b.debts.length === 1 ? 'quota aperta' : 'quote aperte'}
          </span>
          {involved && confirm !== key && (
            <button
              type="button"
              onClick={() => setConfirm(key)}
              className="h-7 px-3 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-bold shrink-0"
            >
              {b.cents === 0 ? 'Chiudi' : 'Salda'}
            </button>
          )}
        </div>
        {confirm === key && (
          <div className="mt-2 rounded-lg bg-slate-900 border border-emerald-500/40 p-2.5 space-y-2">
            <p className="text-xs text-slate-200">
              {b.cents === 0
                ? `Chiudere le quote incrociate con ${names.fullName(iOwe ? b.to : b.from)}?`
                : iOwe
                  ? `Hai dato ${formatEur(b.cents)} a ${names.fullName(b.to)}? Le ${b.debts.length} quote tra voi risulteranno restituite.`
                  : `Hai ricevuto ${formatEur(b.cents)} da ${names.fullName(b.from)}? Le ${b.debts.length} quote tra voi risulteranno restituite.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirm(null)} className="h-8 px-3 rounded-lg bg-slate-800 text-xs font-semibold">
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  onSettle(b);
                }}
                className="h-8 px-3 rounded-lg bg-emerald-500 text-slate-950 text-xs font-bold"
              >
                Conferma
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="space-y-3">
      {mine.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider font-mono text-slate-400">Tra te e gli altri</p>
          {mine.map(row)}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider font-mono text-slate-400">Tra gli altri</p>
          {others.map(row)}
        </div>
      )}
    </div>
  );
};

const SummarySection: React.FC<{
  summary: Record<TravelerSlotId, PersonSummary>;
  expenses: Expense[];
  names: Names;
  me: TravelerSlotId | null;
  compact?: boolean;
}> = ({ summary, expenses, names, me, compact }) => {
  const total = expenses.reduce((acc, e) => acc + e.amountCents, 0);
  const byCat = EXPENSE_CATEGORIES.map((c) => ({
    ...c,
    cents: expenses.filter((e) => e.category === c.id).reduce((acc, e) => acc + e.amountCents, 0)
  }))
    .filter((c) => c.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const line = (label: string, v: number, cls = 'text-slate-200') => (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${cls}`}>{formatEur(v)}</span>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {SLOTS.map((s) => {
          const p = summary[s];
          return (
            <div key={s} className={`rounded-xl border bg-slate-950/60 p-2.5 text-[11px] space-y-0.5 ${s === me ? 'border-emerald-500/40' : 'border-slate-800'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Dot color={names.color(s)} />
                <span className="font-semibold text-sm text-white truncate">{names.fullName(s)}</span>
                <span
                  className={`ml-auto font-mono font-bold text-xs ${p.net > 0 ? 'text-emerald-300' : p.net < 0 ? 'text-amber-300' : 'text-slate-400'}`}
                >
                  {p.net > 0 ? '+' : p.net < 0 ? '−' : ''}
                  {formatEur(Math.abs(p.net))}
                </span>
              </div>
              {line('Ha pagato', p.paid)}
              {line('Sua quota', p.share)}
              {line('Deve ancora', p.owes, p.owes > 0 ? 'text-amber-300' : 'text-slate-500')}
              {line('Ha restituito', p.repaidOut, 'text-slate-300')}
              {line('Deve ricevere', p.toReceive, p.toReceive > 0 ? 'text-emerald-300' : 'text-slate-500')}
              {line('Ha ricevuto', p.received, 'text-slate-300')}
            </div>
          );
        })}
      </div>
      {byCat.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider font-mono text-slate-400">Per categoria</p>
          {byCat.map((c) => (
            <div key={c.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span>
                  {c.emoji} {c.label}
                </span>
                <span className="font-mono text-slate-200">{formatEur(c.cents)}</span>
              </div>
              <div className="h-1.5 mt-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-emerald-500/80 rounded-full" style={{ width: `${(c.cents / total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Prima che Pietro riparta (7-10 marzo) e dopo, se restano conti aperti con lui */
const LeaverBanner: React.FC<{ balances: PairBalance[]; me: TravelerSlotId | null; names: Names; onOpen?: () => void }> = ({
  balances,
  me,
  names,
  onOpen
}) => {
  const today = seoulDateIso(nowOrSim());
  if (today < '2027-03-07' || today > '2027-03-21') return null;
  const his = balances.filter((b) => (b.from === LEAVER_SLOT || b.to === LEAVER_SLOT) && b.cents > 0);
  if (his.length === 0) return null;
  const gone = today >= LEAVER_DEPARTURE_DAY;
  const iAmLeaver = me === LEAVER_SLOT;
  const who = names.fullName(LEAVER_SLOT);
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5" data-testid="leaver-banner">
      <p className="text-sm font-bold text-amber-100 flex items-center gap-2">
        <PlaneTakeoff className="w-4 h-4 text-amber-300" />
        {iAmLeaver
          ? gone ? 'Sei ripartito con conti ancora aperti' : 'Riparti il 10 marzo: chiudi i conti prima'
          : gone ? `${who} è ripartito con conti ancora aperti` : `${who} riparte il 10 marzo: chiudete i conti con lui`}
      </p>
      <ul className="mt-2 space-y-1">
        {his.map((b) => (
          <li key={`${b.from}-${b.to}`} className="flex items-center gap-2 text-xs text-amber-50">
            <Dot color={names.color(b.from)} className="w-2 h-2" />
            <span>{names.name(b.from)}</span>
            <ArrowRight className="w-3 h-3 text-amber-300/70" />
            <Dot color={names.color(b.to)} className="w-2 h-2" />
            <span>{names.name(b.to)}</span>
            <span className="ml-auto font-mono font-bold">{formatEur(b.cents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-amber-200/80">
        {gone ? 'Da lontano: bonifico, Revolut o PayPal, poi segnate “Salda”.' : 'Dopo il pagamento tocca “Salda” nei saldi: le quote risulteranno restituite.'}
      </p>
      {onOpen && (
        <button type="button" onClick={onOpen} className="mt-2 h-8 px-3 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold">
          Vai ai saldi
        </button>
      )}
    </div>
  );
};

function filterExpenses(list: Expense[], filter: ListFilter, me: TravelerSlotId | null, query: string): Expense[] {
  const q = query.trim().toLowerCase();
  return list.filter((e) => {
    if (q && !e.title.toLowerCase().includes(q) && !e.note.toLowerCase().includes(q)) return false;
    if (filter === 'open') return debtsOf(e).some((d) => !d.repaid);
    if (filter === 'mine') return !!me && (e.paidBy === me || (e.shares[me] ?? 0) > 0);
    return true;
  });
}

const FilterChips: React.FC<{ value: ListFilter; onChange: (f: ListFilter) => void }> = ({ value, onChange }) => (
  <div className="flex gap-1.5" role="group" aria-label="Filtro spese">
    {(
      [
        ['all', 'Tutte'],
        ['open', 'Da saldare'],
        ['mine', 'Mie']
      ] as const
    ).map(([id, label]) => (
      <button
        key={id}
        type="button"
        onClick={() => onChange(id)}
        aria-pressed={value === id}
        className={`h-8 px-3 rounded-full text-xs font-semibold border ${
          value === id ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);

const EmptyList: React.FC<{ filtered: boolean; onAdd: () => void }> = ({ filtered, onAdd }) => (
  <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-800">
    <Receipt className="w-8 h-8 mx-auto text-slate-500" />
    <p className="mt-2 text-sm font-semibold text-white">{filtered ? 'Nessuna spesa con questo filtro' : 'Ancora nessuna spesa'}</p>
    {!filtered && (
      <>
        <p className="text-xs text-slate-400 mt-0.5">Quando qualcuno paga per gli altri, registralo qui.</p>
        <button type="button" onClick={onAdd} className="mt-3 h-9 px-4 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold">
          Aggiungi la prima spesa
        </button>
      </>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Vista principale
// ---------------------------------------------------------------------------

export const ExpensesView: React.FC = () => {
  const { user, travelers } = useAuth();
  const uid = user?.id ?? '';
  const me: TravelerSlotId | null = user && isSlot(user.travelerId) ? user.travelerId : null;
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const names = useNames(travelers, me);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [rates, setRates] = useState<LiveExchangeRates>(FALLBACK_RATES);

  const [tab, setTab] = useState<MobileTab>('balances');
  const [filter, setFilter] = useState<ListFilter>('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<{ editing: Expense | null; prefill?: QuickDraft | null } | null>(null);
  // Spesa veloce: dal "+" o dalla scorciatoia dell'icona (?add=1)
  const [quick, setQuick] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('add') === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has('add')) {
        url.searchParams.delete('add');
        window.history.replaceState(window.history.state, '', url.toString());
      }
    } catch {
      /* niente */
    }
  }, []);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(
    () =>
      watchExpenses(
        (snap) => {
          setExpenses(snap.expenses);
          setFromCache(snap.fromCache);
          setLoaded(true);
          setLoadError(null);
        },
        (msg) => {
          setLoadError(msg);
          setLoaded(true);
        }
      ),
    []
  );

  useEffect(() => {
    let alive = true;
    getLiveExchangeRates()
      .then((r) => alive && setRates(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const summary = useMemo(() => summarize(expenses), [expenses]);
  const balances = useMemo(() => pairBalances(expenses), [expenses]);
  const total = useMemo(() => expenses.reduce((acc, e) => acc + e.amountCents, 0), [expenses]);
  const visible = useMemo(() => filterExpenses(expenses, filter, me, query), [expenses, filter, me, query]);
  const detail = detailId ? expenses.find((e) => e.id === detailId) ?? null : null;
  const openCount = balances.filter((b) => b.from === me || b.to === me).length;
  const recents = useMemo(() => recentTitles(expenses, uid, me), [expenses, uid, me]);
  const todayShare = useMemo(() => {
    if (!me) return 0;
    const d = todayIso();
    return expenses.filter((e) => e.date === d).reduce((acc, e) => acc + (e.shares[me] ?? 0), 0);
  }, [expenses, me]);
  const budgetEur = Number((user as { dailyBudgetGoal?: number } | null)?.dailyBudgetGoal) || 0;

  // Le scritture compaiono subito (copia locale); un rifiuto del cloud arriva dopo e si segnala
  const report = (p: Promise<void>, okText: string) => {
    setToast({ text: okText, ok: true });
    p.catch((err) => setToast({ text: friendlyExpenseError(err), ok: false }));
  };

  const submitForm = (input: ExpenseInput) => {
    const editing = form?.editing ?? null;
    setForm(null);
    try {
      if (editing) report(updateExpense(editing, input), 'Spesa aggiornata');
      else report(addExpense(input, uid).done, 'Spesa aggiunta');
    } catch (err) {
      setToast({ text: friendlyExpenseError(err), ok: false });
    }
  };

  const openAdd = () => setQuick(true);
  const openFullForm = () => setForm({ editing: null });

  // Lista raggruppata per giorno (telefono)
  const groups = useMemo(() => {
    const out: { date: string; items: Expense[]; cents: number }[] = [];
    for (const e of visible) {
      const last = out[out.length - 1];
      if (last && last.date === e.date) {
        last.items.push(e);
        last.cents += e.amountCents;
      } else out.push({ date: e.date, items: [e], cents: e.amountCents });
    }
    return out;
  }, [visible]);

  const statusBanner = (
    <>
      {loadError && (
        <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex gap-2">
          <CircleAlert className="w-4 h-4 shrink-0" /> {loadError}
        </div>
      )}
      {!loadError && loaded && fromCache && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-400 flex items-center gap-2">
          <CloudOff className="w-3.5 h-3.5" /> Senza rete: vedi la copia sul dispositivo, le modifiche partono al ritorno della connessione.
        </div>
      )}
    </>
  );

  const sheets = (
    <>
      {quick && !form && (
        <Sheet title="Spesa veloce" onClose={() => setQuick(false)} isDesktop={isDesktop}>
          <QuickExpenseBody
            me={me}
            travelers={travelers}
            rates={rates}
            recents={recents}
            nameOf={names.name}
            onSubmit={(input) => {
              setQuick(false);
              submitForm(input);
            }}
            onMore={(draft) => {
              setQuick(false);
              setForm({ editing: null, prefill: draft });
            }}
          />
        </Sheet>
      )}
      {form && (
        <ExpenseForm
          initial={form.editing}
          prefill={form.prefill}
          me={me}
          travelers={travelers}
          names={names}
          rates={rates}
          isDesktop={isDesktop}
          onCancel={() => setForm(null)}
          onSubmit={submitForm}
        />
      )}
      {detail && !form && (
        <ExpenseDetail
          e={detail}
          me={me}
          uid={uid}
          names={names}
          isDesktop={isDesktop}
          onClose={() => setDetailId(null)}
          onEdit={() => setForm({ editing: detail })}
          onDelete={() => {
            setDetailId(null);
            report(deleteExpense(detail.id), 'Spesa eliminata');
          }}
          onToggleRepaid={(slot, repaid) =>
            report(setRepaid(detail.id, slot, repaid, uid), repaid ? 'Quota segnata come restituita' : 'Quota di nuovo aperta')
          }
        />
      )}
      {toast &&
        createPortal(
          <div
            role="status"
            className={`fixed left-1/2 -translate-x-1/2 z-[10001] px-4 py-2 rounded-xl text-xs font-semibold shadow-xl max-w-[90vw] ${
              toast.ok ? 'bg-emerald-500 text-slate-950' : 'bg-amber-400 text-slate-950'
            } ${isDesktop ? 'bottom-6' : 'top-[calc(env(safe-area-inset-top)+0.75rem)]'}`}
          >
            {toast.text}
          </div>,
          document.body
        )}
    </>
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> Carico le spese…
      </div>
    );
  }

  const settle = (b: PairBalance) => report(settlePair(b, uid), 'Saldato: quote segnate come restituite');

  // ------------------------------------------------------------------- telefono
  if (!isDesktop) {
    return (
      <div className="space-y-3 pb-20">
        {statusBanner}
        <MyBalanceCard me={me} summary={summary} total={total} count={expenses.length} todayShare={todayShare} budgetEur={budgetEur} />
        <LeaverBanner balances={balances} me={me} names={names} onOpen={() => setTab('balances')} />
        <CurrencyConverter rates={rates} />

        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800" role="tablist">
          {(
            [
              ['balances', 'Saldi', openCount],
              ['list', 'Spese', expenses.length],
              ['summary', 'Riepilogo', 0]
            ] as const
          ).map(([id, label, badge]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 ${
                tab === id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
              }`}
            >
              {label}
              {badge > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full ${tab === id ? 'bg-slate-950/20' : 'bg-slate-800 text-slate-300'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'balances' && <BalancesSection balances={balances} me={me} names={names} onSettle={settle} />}

        {tab === 'list' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FilterChips value={filter} onChange={setFilter} />
            </div>
            {expenses.length > 6 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(ev) => setQuery(ev.target.value)}
                  placeholder="Cerca spesa…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
            {groups.length === 0 ? (
              <EmptyList filtered={expenses.length > 0} onAdd={openAdd} />
            ) : (
              groups.map((g) => (
                <div key={g.date}>
                  <div className="flex items-center justify-between px-1 mb-1">
                    <span className="text-[10.5px] uppercase tracking-wider font-mono text-slate-400">{formatDay(g.date)}</span>
                    <span className="text-[10.5px] font-mono text-slate-500">{formatEur(g.cents)}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 divide-y divide-slate-800/80 overflow-hidden">
                    {g.items.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => setDetailId(e.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left active:bg-slate-800/60"
                      >
                        <span className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-lg shrink-0">
                          {categoryOf(e.category).emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white truncate flex items-center gap-1.5">
                            {e.title}
                            {e.pending && <CloudOff className="w-3 h-3 text-amber-300 shrink-0" />}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                            <Dot color={names.color(e.paidBy)} className="w-2 h-2" />
                            {names.name(e.paidBy)} ha pagato
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="font-mono text-sm font-bold text-white">{formatEur(e.amountCents)}</div>
                          <StatusPill e={e} me={me} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'summary' && <SummarySection summary={summary} expenses={expenses} names={names} me={me} />}

        <button
          type="button"
          onClick={openAdd}
          aria-label="Aggiungi spesa"
          data-testid="expense-fab"
          className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[55] h-14 pl-4 pr-5 rounded-full bg-emerald-500 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-950/50 flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} /> Spesa
        </button>

        {sheets}
      </div>
    );
  }

  // ------------------------------------------------------------------- desktop
  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Wallet className="w-6 h-6 text-emerald-400" /> Spese del gruppo
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Chi anticipa per gli altri lo registra qui: l'app calcola chi deve quanto a chi e tiene traccia delle quote restituite.
            Tutti i partecipanti vedono gli stessi dati in tempo reale.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openFullForm}
            className="h-10 px-4 rounded-xl bg-slate-800 text-slate-200 font-semibold text-sm flex items-center gap-1.5 hover:bg-slate-700"
          >
            <Pencil className="w-4 h-4" /> Spesa dettagliata
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="h-10 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm flex items-center gap-1.5 hover:bg-emerald-400"
            data-testid="expense-quick-open"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Spesa veloce
          </button>
        </div>
      </div>
      {statusBanner}

      <div className="grid grid-cols-[minmax(320px,380px)_1fr] gap-6 items-start">
        <div className="space-y-5">
          <MyBalanceCard me={me} summary={summary} total={total} count={expenses.length} todayShare={todayShare} budgetEur={budgetEur} />
          <LeaverBanner balances={balances} me={me} names={names} />
          <CurrencyConverter rates={rates} />
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">Saldi</h3>
            <BalancesSection balances={balances} me={me} names={names} onSettle={settle} />
          </section>
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">Riepilogo per persona</h3>
            <SummarySection summary={summary} expenses={expenses} names={names} me={me} compact />
          </section>
        </div>

        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <FilterChips value={filter} onChange={setFilter} />
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                placeholder="Cerca spesa…"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyList filtered={expenses.length > 0} onAdd={openAdd} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider font-mono text-slate-500 text-left">
                  <th className="py-2 pr-3 font-medium">Data</th>
                  <th className="py-2 pr-3 font-medium">Descrizione</th>
                  <th className="py-2 pr-3 font-medium">Ha pagato</th>
                  <th className="py-2 pr-3 font-medium">Quote</th>
                  <th className="py-2 pr-3 font-medium text-right">Importo</th>
                  <th className="py-2 font-medium text-right">Per te</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {visible.map((e) => {
                  const debts = debtsOf(e);
                  const open = debts.filter((d) => !d.repaid).length;
                  return (
                    <tr key={e.id} onClick={() => setDetailId(e.id)} className="cursor-pointer hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 text-xs text-slate-400 whitespace-nowrap">{formatDay(e.date)}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span>{categoryOf(e.category).emoji}</span>
                          <span className="text-white truncate max-w-[260px]">{e.title}</span>
                          {e.pending && <CloudOff className="w-3 h-3 text-amber-300 shrink-0" />}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Dot color={names.color(e.paidBy)} /> {names.name(e.paidBy)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1">
                          {SLOTS.filter((s) => (e.shares[s] ?? 0) > 0).map((s) => {
                            const isPayer = s === e.paidBy;
                            const done = isPayer || !!e.repaid[s];
                            return (
                              <span
                                key={s}
                                title={`${names.fullName(s)}: ${formatEur(e.shares[s] ?? 0)}${isPayer ? ' (ha pagato)' : done ? ' · restituita' : ' · aperta'}`}
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${done ? '' : 'opacity-40'}`}
                                style={{ borderColor: names.color(s) }}
                              >
                                {done && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                              </span>
                            );
                          })}
                          {debts.length > 0 && <span className="text-[10.5px] text-slate-500 ml-1">{open > 0 ? `${open} ${open === 1 ? "aperta" : "aperte"}` : "saldata"}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                        <div className="font-mono font-bold text-white">{formatEur(e.amountCents)}</div>
                        {e.currency !== 'EUR' && <div className="text-[10.5px] text-slate-500 font-mono">{formatOriginal(e.originalAmount, e.currency)}</div>}
                      </td>
                      <td className="py-2.5 text-right">
                        <StatusPill e={e} me={me} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
      {sheets}
    </div>
  );
};
