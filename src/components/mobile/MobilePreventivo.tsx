import React, { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw, X } from 'lucide-react';
import {
  BEIJING_TRANSIT_BUDGET,
  PDF_BUDGET_ESTIMATES,
  formatAccommodationEur,
  type AccommodationOption
} from '../../data/tripData';
import type { LiveExchangeRates } from '../../services/currencyService';
import { useAuth } from '../../auth/AuthContext';
import { useSeoulHome } from '../../services/homeInfoService';
import './mobile.css';

type SubTab = 'estimates' | 'converter' | 'saver_tips';
type Currency = 'KRW' | 'EUR' | 'CNY';

interface MobilePreventivoProps {
  accommodations: AccommodationOption[];
  rates: LiveExchangeRates;
  isLoadingRates: boolean;
  onRefreshRates: () => void;
}

interface ParsedBudgetRow {
  id: string;
  title: string;
  shortNote: string;
  detail: string;
  perPersonLabel: string;
  groupLabel: string;
  minEur: number;
  maxEur: number;
  midEur: number;
  groupKey: 'nightlife' | 'food' | 'other';
  dotColor: string;
  isBeijing?: boolean;
}

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';
const HEADING_FONT: React.CSSProperties = { fontFamily: "'Outfit', system-ui, sans-serif" };

function parseRange(raw: string): { min: number; max: number } {
  const nums = (raw.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(/\./g, '').replace(',', '.')));
  if (nums.length === 0) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: nums[0], max: nums[1] };
}

function cleanCategoryMeta(category: string): {
  id: string;
  title: string;
  shortNote: string;
  groupKey: 'nightlife' | 'food' | 'other';
  dotColor: string;
  isBeijing?: boolean;
} {
  const low = category.toLowerCase();
  if (low.includes('serate') || low.includes('nightlife')) {
    return {
      id: 'nightlife',
      title: 'Serate e uscite',
      shortNote: 'Circa 16 serate tra Sinchon, Kondae e Hongdae',
      groupKey: 'nightlife',
      dotColor: '#f472b6'
    };
  }
  if (low.includes('cibo') || low.includes('mercati')) {
    return {
      id: 'food',
      title: 'Cibo, mercati e spesa',
      shortNote: 'Colazioni a casa, street food e mercati',
      groupKey: 'food',
      dotColor: '#a78bfa'
    };
  }
  if (low.includes('trasporti')) {
    return {
      id: 'transport',
      title: 'Trasporti a Seul',
      shortNote: 'T-money metro/bus e treno AREX A/R',
      groupKey: 'other',
      dotColor: '#fbbf24'
    };
  }
  if (low.includes('attivit') || low.includes('ingressi')) {
    return {
      id: 'activities',
      title: 'Attività e ingressi',
      shortNote: 'Hanbok (palazzi gratis), parchi e noraebang',
      groupKey: 'other',
      dotColor: '#fbbf24'
    };
  }
  if (low.includes('pechino')) {
    return {
      id: 'beijing',
      title: 'Scalo a Pechino',
      shortNote: 'Airport Express, metro e cena a Qianmen',
      groupKey: 'other',
      dotColor: '#fbbf24',
      isBeijing: true
    };
  }
  return {
    id: 'daytrips',
    title: 'Gite fuori porta',
    shortNote: 'Treni/metro per Incheon e Suwon',
    groupKey: 'other',
    dotColor: '#fbbf24'
  };
}

const SAVER_TIPS: { id: string; title: string; badge: string; summary: string; detail: string }[] = [
  {
    id: 'hanbok',
    title: 'Hanbok nei palazzi reali',
    badge: 'Ingressi 0 €',
    summary: 'Con l’abito tradizionale entri gratis in tutti i palazzi storici.',
    detail:
      'Gyeongbokgung, Changdeokgung e Deoksugung azzerano il biglietto a chi indossa l’hanbok. Il noleggio costa circa 10–12 € e copre l’intera mattinata.'
  },
  {
    id: 'sinchon',
    title: 'Serate a Sinchon e Kondae',
    badge: '−35/45%',
    summary: 'Zone universitarie molto più economiche di Gangnam e Itaewon.',
    detail:
      'Pocha, grigliate BBQ e pub frequentati dagli studenti universitari costano oltre un terzo in meno rispetto ai club di Gangnam, pur restando attaccati a Hongdae.'
  },
  {
    id: 'han',
    title: 'Cena sul fiume Han',
    badge: '3–4 €',
    summary: 'Ramyeon cotto al momento nei CU o GS25 lungo il parco.',
    detail:
      'Nei convenience store sul fiume compri ramyeon, uovo e bevanda e usi le piastre automatiche gratuite all’esterno: cena completa vista skyline con pochi euro.'
  },
  {
    id: 'tmoney',
    title: 'Cambio metro–bus con T-money',
    badge: 'Corsa gratis',
    summary: 'Secondo mezzo gratuito o scontato cambiando entro 30 minuti.',
    detail:
      'Basta passare la T-money anche in uscita quando scendi dal bus o esci dai tornelli della metro: il sistema riconosce il trasbordo entro mezz’ora.'
  },
  {
    id: 'trek',
    title: 'Namsan e Bukhansan a piedi',
    badge: 'Gratis',
    summary: 'Parchi nazionali gratuiti ed eviti la funivia di Namsan.',
    detail:
      'La salita a piedi sui sentieri scalinati del monte Namsan impiega 35–40 minuti ed è gratuita; anche l’accesso al parco nazionale del Bukhansan non ha biglietto.'
  },
  {
    id: 'taxfree',
    title: 'Tax refund immediato in cassa',
    badge: '−7/8%',
    summary: 'Porta il passaporto fisico da Olive Young e nei negozi aderenti.',
    detail:
      'Sopra i 15.000 ₩ nei negozi con marchio Immediate Tax Refund ti scalano l’IVA direttamente sullo scontrino, senza fare fila ai chioschi di Incheon.'
  }
];

const QUICK_AMOUNTS: Record<Currency, number[]> = {
  KRW: [5000, 15000, 30000, 50000],
  EUR: [10, 25, 50, 100],
  CNY: [25, 50, 100, 200]
};

export const MobilePreventivo: React.FC<MobilePreventivoProps> = ({
  accommodations,
  rates,
  isLoadingRates,
  onRefreshRates
}) => {
  const { user } = useAuth();
  const { homeDoc } = useSeoulHome();

  const [tab, setTab] = useState<SubTab>('estimates');
  const defaultAccId = homeDoc.confirmedAccId ?? user?.accommodationPreference ?? 'acc_c';
  const [selectedAccId, setSelectedAccId] = useState<string>(defaultAccId);
  const [stayMode, setStayMode] = useState<'17n' | '8n'>(() => (user?.travelerId === 't1' ? '8n' : '17n'));
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [openTipId, setOpenTipId] = useState<string | null>(null);

  // Convertitore
  const [fromCur, setFromCur] = useState<Currency>('KRW');
  const [amountInput, setAmountInput] = useState<string>('15000');

  const selectedAcc = useMemo(
    () => accommodations.find((a) => a.id === selectedAccId) ?? accommodations[2] ?? accommodations[0],
    [accommodations, selectedAccId]
  );

  const parsedRows = useMemo<ParsedBudgetRow[]>(() => {
    return PDF_BUDGET_ESTIMATES.map((item) => {
      const meta = cleanCategoryMeta(item.category);
      const { min, max } = parseRange(item.totalPerPerson);
      return {
        id: meta.id,
        title: meta.title,
        shortNote: meta.shortNote,
        detail: item.detail,
        perPersonLabel: item.totalPerPerson.replace(/\s*-\s*/g, '–'),
        groupLabel: item.groupTotal.replace(/\s*-\s*/g, '–'),
        minEur: min,
        maxEur: max,
        midEur: Math.round((min + max) / 2),
        groupKey: meta.groupKey,
        dotColor: meta.dotColor,
        isBeijing: meta.isBeijing
      };
    }).sort((a, b) => b.midEur - a.midEur);
  }, []);

  const localTotals = useMemo(() => {
    const min = parsedRows.reduce((s, r) => s + r.minEur, 0);
    const max = parsedRows.reduce((s, r) => s + r.maxEur, 0);
    const groupMin = parsedRows.reduce((s, r) => s + parseRange(r.groupLabel).min, 0);
    const groupMax = parsedRows.reduce((s, r) => s + parseRange(r.groupLabel).max, 0);
    return { min, max, groupMin, groupMax };
  }, [parsedRows]);

  const rentForPerson = stayMode === '8n' ? selectedAcc.pietroCost8Nights : selectedAcc.other3Cost17Nights;
  const totalMin17 = Math.round(selectedAcc.other3Cost17Nights + localTotals.min);
  const totalMax17 = Math.round(selectedAcc.other3Cost17Nights + localTotals.max);
  const totalGroupMin = Math.round(selectedAcc.totalEur17Nights + localTotals.groupMin);
  const totalGroupMax = Math.round(selectedAcc.totalEur17Nights + localTotals.groupMax);
  const fmtInt = (n: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(Math.round(n));

  // Segmenti del grafico di composizione (basati sui valori medi a persona)
  const segments = useMemo(() => {
    const nightlifeMid = parsedRows.filter((r) => r.groupKey === 'nightlife').reduce((s, r) => s + r.midEur, 0);
    const foodMid = parsedRows.filter((r) => r.groupKey === 'food').reduce((s, r) => s + r.midEur, 0);
    const otherMid = parsedRows.filter((r) => r.groupKey === 'other').reduce((s, r) => s + r.midEur, 0);
    const sum = Math.max(1, rentForPerson + nightlifeMid + foodMid + otherMid);
    return [
      { id: 'rent', label: `Casa ${selectedAcc.code}`, value: rentForPerson, pct: Math.round((rentForPerson / sum) * 100), color: '#52d9e6', targetRow: 'rent' },
      { id: 'nightlife', label: 'Serate', value: nightlifeMid, pct: Math.round((nightlifeMid / sum) * 100), color: '#f472b6', targetRow: 'nightlife' },
      { id: 'food', label: 'Cibo e spesa', value: foodMid, pct: Math.round((foodMid / sum) * 100), color: '#a78bfa', targetRow: 'food' },
      { id: 'other', label: 'Spostamenti e visite', value: otherMid, pct: Math.max(1, 100 - Math.round((rentForPerson / sum) * 100) - Math.round((nightlifeMid / sum) * 100) - Math.round((foodMid / sum) * 100)), color: '#fbbf24', targetRow: 'transport' }
    ];
  }, [parsedRows, rentForPerson, selectedAcc.code]);

  const numericAmount = useMemo(() => {
    const clean = amountInput.replace(/\./g, '').replace(',', '.').trim();
    const n = Number(clean);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [amountInput]);

  const converted = useMemo(() => {
    const eur = fromCur === 'EUR' ? numericAmount : fromCur === 'KRW' ? numericAmount / rates.KRW : numericAmount / rates.CNY;
    const krw = fromCur === 'KRW' ? numericAmount : eur * rates.KRW;
    const cny = fromCur === 'CNY' ? numericAmount : eur * rates.CNY;
    const fmt = (v: number, dec: number, sym: string) => {
      if (!Number.isFinite(v)) return '—';
      if (Math.abs(v) >= 1e9) {
        return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(v / 1e9)} mld ${sym}`;
      }
      return `${new Intl.NumberFormat('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v)} ${sym}`;
    };
    return {
      EUR: fmt(eur, 2, '€'),
      KRW: fmt(krw, 0, '₩'),
      CNY: fmt(cny, 2, '¥')
    };
  }, [fromCur, numericAmount, rates.CNY, rates.KRW]);

  const switchCurrency = (next: Currency) => {
    setFromCur(next);
    setAmountInput(String(QUICK_AMOUNTS[next][1]));
  };

  return (
    <div className="pb-6 selection:bg-[#52d9e6]/25 selection:text-white" data-testid="mobile-preventivo">
      {/* Sotto-schede piatte coerenti con il resto dell'app */}
      <div role="tablist" aria-label="Sezioni preventivo" className="ms-seg">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'estimates'}
          onClick={() => setTab('estimates')}
          className={FOCUS_RING}
        >
          Stima
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'converter'}
          onClick={() => setTab('converter')}
          className={FOCUS_RING}
        >
          Convertitore
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'saver_tips'}
          onClick={() => setTab('saver_tips')}
          className={FOCUS_RING}
        >
          Risparmio
        </button>
      </div>

      {/* ================= TAB 1: STIMA ================= */}
      {tab === 'estimates' && (
        <div className="pt-5 space-y-6">
          {/* Selettori rapidi: durata soggiorno + opzione casa (target >= 44px) */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div style={{ borderRadius: 12, background: 'var(--ms-fill)' }} className="inline-flex p-1">
              <button
                type="button"
                onClick={() => setStayMode('17n')}
                aria-pressed={stayMode === '17n'}
                style={{ borderRadius: 9 }}
                className={`min-h-11 px-3.5 text-[13.5px] font-semibold transition-colors ${FOCUS_RING} ${
                  stayMode === '17n' ? 'bg-[#52d9e6] text-[#04242a]' : 'text-[#eaf0f6]/80'
                }`}
              >
                17 notti
              </button>
              <button
                type="button"
                onClick={() => setStayMode('8n')}
                aria-pressed={stayMode === '8n'}
                style={{ borderRadius: 9 }}
                className={`min-h-11 px-3.5 text-[13.5px] font-semibold transition-colors ${FOCUS_RING} ${
                  stayMode === '8n' ? 'bg-[#52d9e6] text-[#04242a]' : 'text-[#eaf0f6]/80'
                }`}
              >
                8 notti · Pietro
              </button>
            </div>

            <div style={{ borderRadius: 12, background: 'var(--ms-fill)' }} className="inline-flex items-center gap-0.5 p-1" role="group" aria-label="Opzione alloggio">
              {accommodations.map((acc) => {
                const active = acc.id === selectedAcc.id;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedAccId(acc.id)}
                    aria-pressed={active}
                    aria-label={`Alloggio ${acc.code}: ${acc.district}`}
                    style={{ borderRadius: 9 }}
                    className={`min-h-11 min-w-11 px-2.5 text-[13.5px] font-semibold tabular-nums transition-colors ${FOCUS_RING} ${
                      active ? 'bg-[#52d9e6] text-[#04242a]' : 'text-[#eaf0f6]/80'
                    }`}
                  >
                    {acc.code}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cifra chiave immediata */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              {stayMode === '17n' ? (
                <>
                  <p
                    className="text-[36px] sm:text-[42px] font-medium leading-[0.98] tracking-[-0.03em] text-[#eaf0f6] tabular-nums whitespace-nowrap"
                    style={HEADING_FONT}
                  >
                    {fmtInt(totalMin17)}–{fmtInt(totalMax17)} €
                  </p>
                  <p className="mt-2 text-[14px] text-[#97a5b9]">
                    a testa con casa {selectedAcc.code} ({selectedAcc.district.split(' ')[0]}) · voli esclusi
                  </p>
                </>
              ) : (
                <>
                  <p
                    className="text-[36px] sm:text-[42px] font-medium leading-[0.98] tracking-[-0.03em] text-[#eaf0f6] tabular-nums whitespace-nowrap"
                    style={HEADING_FONT}
                  >
                    {formatAccommodationEur(selectedAcc.pietroCost8Nights)}
                  </p>
                  <p className="mt-2 text-[14px] text-[#97a5b9]">
                    quota casa {selectedAcc.code} per 8 notti · più spese sul posto ({fmtInt(localTotals.min)}–{fmtInt(localTotals.max)} € su 17n)
                  </p>
                </>
              )}
            </div>
            <div className="text-right shrink-0 pb-0.5">
              <span className="block text-[15px] font-semibold text-[#eaf0f6] tabular-nums whitespace-nowrap" style={HEADING_FONT}>
                {fmtInt(totalGroupMin)}–{fmtInt(totalGroupMax)} €
              </span>
              <span className="block text-[12.5px] text-[#97a5b9]">gruppo intero</span>
            </div>
          </div>

          {/* Grafico di composizione proporzionale (interattivo) */}
          <div className="space-y-2.5">
            <div
              style={{ borderRadius: 999, background: 'var(--ms-fill)' }}
              className="flex h-3 w-full overflow-hidden gap-[2px]"
              role="img"
              aria-label={`Ripartizione media: ${segments.map((s) => `${s.label} ${s.pct}%`).join(', ')}`}
            >
              {segments.map((seg) => {
                const highlighted = openRowId === seg.targetRow;
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => setOpenRowId((cur) => (cur === seg.targetRow ? null : seg.targetRow))}
                    aria-label={`${seg.label}: ${seg.pct}%`}
                    style={{
                      flexGrow: Math.max(seg.value, 12),
                      flexBasis: 0,
                      backgroundColor: seg.color,
                      opacity: openRowId && !highlighted ? 0.42 : 1
                    }}
                    className="h-full transition-[flex-grow,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                  />
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-0.5">
              {segments.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => setOpenRowId((cur) => (cur === seg.targetRow ? null : seg.targetRow))}
                  className={`min-h-11 flex items-center justify-between gap-2 text-left text-[13px] ${FOCUS_RING}`}
                >
                  <span className="flex items-center gap-2 min-w-0 truncate text-[#97a5b9]">
                    <span
                      data-keep-style
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="truncate">{seg.label}</span>
                  </span>
                  <span className="font-semibold text-[#eaf0f6] tabular-nums shrink-0">{seg.pct}%</span>
                </button>
              ))}
            </div>
          </div>

          {/* Elenco voci ordinato per peso reale (dettagli a comparsa) */}
          <section className="border-t border-[rgba(234,240,246,0.11)]">
            {/* Voce Alloggio */}
            {(() => {
              const isOpen = openRowId === 'rent';
              return (
                <div className="border-b border-[rgba(234,240,246,0.11)]">
                  <button
                    type="button"
                    onClick={() => setOpenRowId(isOpen ? null : 'rent')}
                    aria-expanded={isOpen}
                    className={`w-full min-h-[58px] py-3 flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}
                  >
                    <span className="flex items-start gap-2.5 min-w-0">
                      <span data-keep-style className="w-2 h-2 rounded-full bg-[#52d9e6] shrink-0 mt-2" />
                      <span className="min-w-0">
                        <span className="block text-[16px] font-medium text-[#eaf0f6]" style={HEADING_FONT}>
                          Alloggio {selectedAcc.code} · {selectedAcc.district}
                        </span>
                        <span className="block text-[13px] text-[#97a5b9] truncate">
                          {formatAccommodationEur(selectedAcc.nightlyRateEur)}/notte · {stayMode === '8n' ? 'quota 8 notti' : 'quota 17 notti'}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[17px] font-medium text-[#eaf0f6] tabular-nums" style={HEADING_FONT}>
                        {formatAccommodationEur(rentForPerson)}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#97a5b9] transition-transform duration-200 motion-reduce:transition-none ${
                          isOpen ? 'rotate-180 text-[#52d9e6]' : ''
                        }`}
                      />
                    </span>
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-4 pl-4.5 space-y-2">
                        <p className="text-[13px] text-[#97a5b9]">
                          Confronto 17 notti Enko Stay (tocca per cambiare opzione):
                        </p>
                        <div className="divide-y divide-[rgba(234,240,246,0.08)]">
                          {accommodations.map((acc) => {
                            const active = acc.id === selectedAcc.id;
                            return (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => setSelectedAccId(acc.id)}
                                className={`w-full min-h-11 py-2 flex items-center justify-between gap-2 text-left text-[13.5px] ${FOCUS_RING}`}
                              >
                                <span className={`font-medium truncate ${active ? 'text-[#52d9e6]' : 'text-[#eaf0f6]'}`}>
                                  {acc.code} · {acc.district}
                                </span>
                                <span className="shrink-0 tabular-nums text-right">
                                  <span className="text-[#eaf0f6] font-semibold">
                                    {formatAccommodationEur(stayMode === '8n' ? acc.pietroCost8Nights : acc.other3Cost17Nights)}
                                  </span>
                                  <span className="text-[#97a5b9] text-[12px] ml-2">
                                    ({formatAccommodationEur(acc.totalEur17Nights)} tot.)
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Le 6 voci sul posto dal PDF */}
            {parsedRows.map((row) => {
              const isOpen = openRowId === row.id;
              return (
                <div key={row.id} className="border-b border-[rgba(234,240,246,0.11)]">
                  <button
                    type="button"
                    onClick={() => setOpenRowId(isOpen ? null : row.id)}
                    aria-expanded={isOpen}
                    className={`w-full min-h-[58px] py-3 flex items-center justify-between gap-3 text-left ${FOCUS_RING}`}
                  >
                    <span className="flex items-start gap-2.5 min-w-0">
                      <span
                        data-keep-style
                        className="w-2 h-2 rounded-full shrink-0 mt-2"
                        style={{ backgroundColor: row.dotColor }}
                      />
                      <span className="min-w-0">
                        <span className="block text-[16px] font-medium text-[#eaf0f6]" style={HEADING_FONT}>
                          {row.title}
                        </span>
                        <span className="block text-[13px] text-[#97a5b9] truncate">{row.shortNote}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[17px] font-medium text-[#eaf0f6] tabular-nums" style={HEADING_FONT}>
                        {row.perPersonLabel}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#97a5b9] transition-transform duration-200 motion-reduce:transition-none ${
                          isOpen ? 'rotate-180 text-[#52d9e6]' : ''
                        }`}
                      />
                    </span>
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="pb-4 pl-4.5 space-y-2.5 text-[14px] leading-relaxed text-[#c3cfdd]">
                        <p>{row.detail}</p>
                        <p className="text-[13px] text-[#97a5b9] tabular-nums">
                          Totale gruppo (4 persone): <strong className="text-[#eaf0f6] font-semibold">{row.groupLabel}</strong>
                        </p>
                        {row.isBeijing && (
                          <div className="pt-2 border-t border-[rgba(234,240,246,0.08)] space-y-1.5">
                            <p className="text-[12.5px] font-semibold text-[#eaf0f6]">Dettaglio serata a Pechino:</p>
                            {BEIJING_TRANSIT_BUDGET.map((b) => (
                              <div key={b.item} className="flex items-baseline justify-between gap-3 text-[13px]">
                                <span className="text-[#97a5b9] truncate">{b.item}</span>
                                <span className="shrink-0 tabular-nums text-[#eaf0f6]">
                                  {b.cny} <span className="text-[#97a5b9]">({b.eur})</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {/* ================= TAB 2: CONVERTITORE ================= */}
      {tab === 'converter' && (
        <div className="pt-5 space-y-5">
          {/* Scelta valuta di partenza */}
          <div style={{ borderRadius: 12, background: 'var(--ms-fill)' }} className="grid grid-cols-3 gap-1 p-1" role="group" aria-label="Valuta di partenza">
            {(
              [
                { id: 'KRW', label: '₩ Won' },
                { id: 'EUR', label: '€ Euro' },
                { id: 'CNY', label: '¥ Yuan' }
              ] as const
            ).map((c) => {
              const active = fromCur === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => switchCurrency(c.id)}
                  aria-pressed={active}
                  style={{ borderRadius: 9 }}
                  className={`min-h-11 text-[14px] font-semibold transition-colors ${FOCUS_RING} ${
                    active ? 'bg-[#52d9e6] text-[#04242a]' : 'text-[#eaf0f6]/80'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Campo importo grande e pulito */}
          <div className="border-b border-[rgba(234,240,246,0.24)] focus-within:border-[#52d9e6] pb-2 flex items-center gap-2 transition-colors">
            <input
              inputMode="decimal"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0"
              aria-label={`Importo in ${fromCur}`}
              style={{ ...HEADING_FONT, background: 'transparent' }}
              className="w-full min-w-0 text-[40px] font-medium leading-none tracking-[-0.02em] text-[#eaf0f6] caret-[#52d9e6] tabular-nums outline-none placeholder:text-[#97a5b9]/40"
            />
            {amountInput && (
              <button
                type="button"
                onClick={() => setAmountInput('')}
                aria-label="Azzera importo"
                className={`w-11 h-11 grid place-items-center text-[#97a5b9] shrink-0 ${FOCUS_RING}`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
            <span className="text-[20px] font-medium text-[#97a5b9] shrink-0" style={HEADING_FONT}>
              {fromCur === 'KRW' ? '₩' : fromCur === 'EUR' ? '€' : '¥'}
            </span>
          </div>

          {/* Tagli rapidi da strada */}
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS[fromCur].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmountInput(String(preset))}
                style={{ borderRadius: 12, background: 'var(--ms-fill)' }}
                className={`min-h-11 px-3.5 active:scale-[0.97] text-[13.5px] font-medium text-[#eaf0f6] tabular-nums transition-transform ${FOCUS_RING}`}
              >
                {new Intl.NumberFormat('it-IT').format(preset)} {fromCur === 'KRW' ? '₩' : fromCur === 'EUR' ? '€' : '¥'}
              </button>
            ))}
          </div>

          {/* Risultati nelle altre due valute */}
          <div className="divide-y divide-[rgba(234,240,246,0.11)] border-t border-b border-[rgba(234,240,246,0.11)]">
            {(
              [
                { id: 'EUR' as const, name: 'Euro', sub: 'Italia' },
                { id: 'KRW' as const, name: 'Won coreano', sub: 'Seul' },
                { id: 'CNY' as const, name: 'Yuan cinese', sub: 'Pechino' }
              ]
            )
              .filter((row) => row.id !== fromCur)
              .map((row) => (
                <div key={row.id} className="py-4 flex items-baseline justify-between gap-4">
                  <div>
                    <span className="block text-[15px] font-medium text-[#eaf0f6]">{row.name}</span>
                    <span className="block text-[12.5px] text-[#97a5b9]">{row.sub}</span>
                  </div>
                  <span
                    className="text-[28px] font-medium text-[#eaf0f6] tabular-nums text-right"
                    style={HEADING_FONT}
                  >
                    {converted[row.id]}
                  </span>
                </div>
              ))}
          </div>

          {/* Riga tasso live discreta con aggiorna */}
          <div className="flex items-center justify-between gap-3 text-[13px] text-[#97a5b9]">
            <span className="tabular-nums">
              1 € = <strong className="text-[#eaf0f6] font-semibold">{rates.KRW} ₩</strong> ·{' '}
              <strong className="text-[#eaf0f6] font-semibold">{rates.CNY} ¥</strong>
              <span className="block text-[12px] mt-0.5">
                Aggiornato {rates.lastUpdatedDate} alle {rates.lastUpdatedTime}
              </span>
            </span>
            <button
              type="button"
              onClick={onRefreshRates}
              disabled={isLoadingRates}
              data-keep-style
              className={`min-h-11 px-3.5 rounded-xl bg-[rgba(96,150,214,0.13)] text-[#eaf0f6] font-medium inline-flex items-center gap-2 shrink-0 disabled:opacity-50 ${FOCUS_RING}`}
            >
              <RefreshCw className={`w-4 h-4 text-[#52d9e6] ${isLoadingRates ? 'animate-spin' : ''}`} />
              Aggiorna
            </button>
          </div>
        </div>
      )}

      {/* ================= TAB 3: RISPARMIO ================= */}
      {tab === 'saver_tips' && (
        <div className="pt-2">
          <div className="divide-y divide-[rgba(234,240,246,0.11)]">
            {SAVER_TIPS.map((tip) => {
              const isOpen = openTipId === tip.id;
              return (
                <div key={tip.id}>
                  <button
                    type="button"
                    onClick={() => setOpenTipId(isOpen ? null : tip.id)}
                    aria-expanded={isOpen}
                    className={`w-full min-h-[60px] py-3.5 flex items-start justify-between gap-3 text-left ${FOCUS_RING}`}
                  >
                    <span className="min-w-0">
                      <span className="block text-[16.5px] font-medium text-[#eaf0f6]" style={HEADING_FONT}>
                        {tip.title}
                      </span>
                      <span className="block text-[13.5px] text-[#97a5b9] mt-0.5 leading-snug">{tip.summary}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0 pt-0.5">
                      <span className="text-[13px] font-semibold text-[#52d9e6] tabular-nums whitespace-nowrap">
                        {tip.badge}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#97a5b9] transition-transform duration-200 motion-reduce:transition-none ${
                          isOpen ? 'rotate-180 text-[#52d9e6]' : ''
                        }`}
                      />
                    </span>
                  </button>

                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                      isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="pb-4 text-[14.5px] leading-relaxed text-[#c3cfdd]">{tip.detail}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobilePreventivo;
