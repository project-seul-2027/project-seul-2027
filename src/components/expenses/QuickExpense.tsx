import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Check, CircleAlert, PlaneTakeoff, SlidersHorizontal } from 'lucide-react';
import type { TravelerSlotId } from '../../shared/travelerProfile';
import type { Traveler } from '../../data/tripData';
import type { LiveExchangeRates } from '../../services/currencyService';
import { LEAVER_SLOT, presentSlots } from '../../shared/tripPresence';
import {
  CURRENCY_SYMBOL, formatEur, sharesFromInput, toEurCents, todayIso, validateInput,
  type Expense, type ExpenseCategory, type ExpenseCurrency, type ExpenseInput
} from '../../types/expenses';

/**
 * Spesa veloce: importo, cosa (un tocco) e salva. Paga chi la inserisce, si divide in parti uguali
 * tra chi è in viaggio quel giorno (dal 10 marzo senza chi è già ripartito).
 */

export interface QuickPreset {
  id: string;
  label: string;
  emoji: string;
  category: ExpenseCategory;
}

export const QUICK_PRESETS: QuickPreset[] = [
  { id: 'taxi', label: 'Taxi', emoji: '🚕', category: 'transport' },
  { id: 'metro', label: 'Ricarica T-money', emoji: '🚇', category: 'transport' },
  { id: 'cafe', label: 'Caffè', emoji: '☕', category: 'food' },
  { id: 'lunch', label: 'Pranzo', emoji: '🍜', category: 'food' },
  { id: 'dinner', label: 'Cena', emoji: '🍖', category: 'food' },
  { id: 'store', label: 'Minimarket', emoji: '🏪', category: 'food' },
  { id: 'tickets', label: 'Ingressi', emoji: '🎟️', category: 'activity' },
  { id: 'shop', label: 'Shopping', emoji: '🛍️', category: 'shopping' }
];

export function parseAmountText(raw: string): number {
  const cleaned = raw.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : NaN;
}

export interface RecentTitle {
  title: string;
  category: ExpenseCategory;
  currency: ExpenseCurrency;
}

/** Ultime descrizioni usate da me, senza doppioni né quelle già tra i pulsanti */
export function recentTitles(expenses: Expense[], uid: string, me: TravelerSlotId | null, max = 4): RecentTitle[] {
  const seen = new Set<string>();
  const out: RecentTitle[] = [];
  const mine = expenses
    .filter((e) => e.createdBy === uid || e.paidBy === me)
    .sort((a, b) => (b.createdAt ?? Number.MAX_SAFE_INTEGER) - (a.createdAt ?? Number.MAX_SAFE_INTEGER));
  for (const e of mine) {
    const k = e.title.trim().toLowerCase();
    if (!k || seen.has(k) || QUICK_PRESETS.some((p) => p.label.toLowerCase() === k)) continue;
    seen.add(k);
    out.push({ title: e.title, category: e.category, currency: e.currency });
    if (out.length >= max) break;
  }
  return out;
}

export interface QuickDraft {
  title: string;
  category: ExpenseCategory;
  currency: ExpenseCurrency;
  amount: number;
  participants: TravelerSlotId[];
  /** La lista è stata cambiata a mano (altrimenti si ricalcola con la data) */
  peopleTouched: boolean;
}

export const QuickExpenseBody: React.FC<{
  me: TravelerSlotId | null;
  travelers: Traveler[];
  rates: LiveExchangeRates;
  recents: RecentTitle[];
  nameOf: (s: TravelerSlotId) => string;
  onSubmit: (input: ExpenseInput) => void;
  onMore: (draft: QuickDraft) => void;
}> = ({ me, travelers, rates, recents, nameOf, onSubmit, onMore }) => {
  const date = todayIso();
  const present = useMemo(() => presentSlots(date), [date]);
  const [amountText, setAmountText] = useState('');
  const [currency, setCurrency] = useState<ExpenseCurrency>('KRW');
  const [preset, setPreset] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [participants, setParticipants] = useState<TravelerSlotId[]>(present);
  const [peopleTouched, setPeopleTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseAmountText(amountText);
  const rate = currency === 'EUR' ? 1 : rates[currency];
  const cents = amount > 0 ? toEurCents(amount, rate) : 0;
  const payer: TravelerSlotId = me ?? 't1';
  const leaverGone = !present.includes(LEAVER_SLOT);

  const input = (): ExpenseInput => ({
    title: title.trim(),
    category,
    date,
    currency,
    originalAmount: amount,
    rate,
    paidBy: payer,
    splitMode: 'equal',
    participants,
    exactAmounts: {},
    note: ''
  });
  const share = cents > 0 && participants.includes(payer) ? sharesFromInput(input())[payer] ?? 0 : 0;

  const pick = (p: { title: string; category: ExpenseCategory; currency?: ExpenseCurrency }, id: string) => {
    setPreset(id);
    setTitle(p.title);
    setCategory(p.category);
    if (p.currency) setCurrency(p.currency);
    setError(null);
  };

  const save = () => {
    if (!title.trim()) return setError('Scegli cosa hai pagato o scrivi una descrizione.');
    const err = validateInput(input());
    if (err) return setError(err);
    onSubmit(input());
  };

  const toggle = (s: TravelerSlotId) => {
    setPeopleTouched(true);
    setParticipants((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const chipOn = 'bg-emerald-500/15 border-emerald-500/60 text-emerald-100';
  const chipOff = 'bg-slate-950 border-slate-800 text-slate-300';

  return (
    <div className="space-y-4" data-testid="quick-expense">
      <div>
        <div className="flex items-stretch gap-2">
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0"
            value={amountText}
            onChange={(ev) => {
              setAmountText(ev.target.value);
              setError(null);
            }}
            aria-label="Importo"
            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 h-16 text-3xl font-bold font-mono text-white focus:outline-none focus:border-emerald-500"
            data-testid="quick-amount"
          />
          <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1 shrink-0" role="group" aria-label="Valuta">
            {(['KRW', 'EUR'] as ExpenseCurrency[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                aria-pressed={currency === c}
                className={`w-12 rounded-lg text-base font-bold ${currency === c ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'}`}
              >
                {CURRENCY_SYMBOL[c]}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-[11px] font-mono text-slate-400 min-h-[1rem]">
          {cents > 0 && currency !== 'EUR' && <span className="text-emerald-300 font-bold">≈ {formatEur(cents)}</span>}
          {share > 0 && participants.length > 1 && <span> · la tua quota {formatEur(share)}</span>}
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 mb-1.5">Cosa</p>
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick({ title: p.label, category: p.category }, p.id)}
              aria-pressed={preset === p.id}
              className={`min-h-[60px] rounded-xl border flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold leading-tight px-1 text-center ${
                preset === p.id ? chipOn : chipOff
              }`}
              data-testid={`quick-${p.id}`}
            >
              <span className="text-xl leading-none">{p.emoji}</span>
              {p.label}
            </button>
          ))}
        </div>
        {recents.length > 0 && (
          <div className="mt-2 flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-0.5">
            {recents.map((r, i) => (
              <button
                key={r.title}
                type="button"
                onClick={() => pick(r, `recent-${i}`)}
                aria-pressed={preset === `recent-${i}`}
                className={`shrink-0 h-9 px-3 rounded-full text-xs font-semibold border ${preset === `recent-${i}` ? chipOn : chipOff}`}
              >
                ↺ {r.title}
              </button>
            ))}
          </div>
        )}
        <input
          value={title}
          maxLength={80}
          onChange={(ev) => {
            setTitle(ev.target.value);
            setPreset(null);
            setError(null);
          }}
          placeholder="…oppure scrivi (es. Cena BBQ a Hongdae)"
          aria-label="Descrizione"
          className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-xl px-3 h-11 text-sm text-white focus:outline-none focus:border-emerald-500"
          data-testid="quick-title"
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 mb-1.5">Hai pagato tu, diviso in parti uguali tra</p>
        <div className="flex flex-wrap gap-1.5">
          {travelers.map((t) => {
            const s = t.id as TravelerSlotId;
            const on = participants.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                aria-pressed={on}
                className={`h-9 px-3 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${
                  on ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 line-through'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                {nameOf(s)}
                {on && <Check className="w-3 h-3" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        {leaverGone && (
          <p className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1.5">
            <PlaneTakeoff className="w-3.5 h-3.5" /> {nameOf(LEAVER_SLOT)} è già ripartito: escluso in automatico.
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-amber-300 flex items-start gap-1.5">
          <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-px" /> {error}
        </p>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          onClick={() => onMore({ title: title.trim(), category, currency, amount: amount > 0 ? amount : 0, participants, peopleTouched })}
          className="h-12 px-3.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5"
          data-testid="quick-more"
        >
          <SlidersHorizontal className="w-4 h-4" /> Più opzioni
        </button>
        <button
          type="button"
          onClick={save}
          className="h-12 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm active:scale-[0.99] transition-transform"
          data-testid="quick-save"
        >
          Salva spesa
        </button>
      </div>
    </div>
  );
};

/** Convertitore rapido won ⇄ euro con il cambio del giorno */
export const CurrencyConverter: React.FC<{ rates: LiveExchangeRates }> = ({ rates }) => {
  const [text, setText] = useState('10000');
  const [fromKrw, setFromKrw] = useState(true);
  const v = parseAmountText(text);
  const out = !(v > 0)
    ? '—'
    : fromKrw
      ? formatEur(Math.round((v / rates.KRW) * 100))
      : `₩${Math.round(v * rates.KRW).toLocaleString('it-IT')}`;
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3" data-testid="converter">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-slate-400 w-4 text-center">{fromKrw ? '₩' : '€'}</span>
        <input
          inputMode="decimal"
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          aria-label={fromKrw ? 'Importo in won' : 'Importo in euro'}
          className="min-w-0 flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 h-10 font-mono text-white focus:outline-none focus:border-emerald-500"
          data-testid="converter-input"
        />
        <button
          type="button"
          onClick={() => setFromKrw((x) => !x)}
          aria-label="Inverti valute"
          className="w-10 h-10 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center shrink-0"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
        <span className="font-mono font-bold text-emerald-300 text-right min-w-[5.5rem]" data-testid="converter-out">
          {out}
        </span>
      </div>
      <p className="mt-1.5 text-[10.5px] text-slate-500 font-mono">
        1 € = {rates.KRW.toLocaleString('it-IT', { maximumFractionDigits: 1 })} ₩ ·{' '}
        {rates.isLive ? `cambio del ${rates.lastUpdatedDate}` : 'cambio di riserva (senza rete)'}
      </p>
    </div>
  );
};
