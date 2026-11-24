import React, { useEffect, useState } from 'react';
import { Maximize2, Volume2, Square } from 'lucide-react';
import type { ShowLine } from '../data/showLanguage';
import { FALLBACK_RATES, getLiveExchangeRates } from '../services/currencyService';
import { ITEM_COUNTS, KRW_PRESETS, PEOPLE_COUNTS, QUICK_COUNTER_PHRASES, krwToKorean } from '../utils/koreanNumbers';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';

interface KoreanPriceGuideProps {
  speechSupported: boolean;
  speakingId: string | null;
  onSpeak: (text: string, id: string) => void;
  onShow: (kicker: string, line: ShowLine, spoken?: string) => void;
}

/**
 * Micro-scheda per leggere e pronunciare al volo cifre in won (sino-coreano),
 * quantità per persone/pezzi (coreano nativo) e frasi lampo da cassa o tavolo.
 */
export const KoreanPriceGuide: React.FC<KoreanPriceGuideProps> = ({ speechSupported, speakingId, onSpeak, onShow }) => {
  const [krwText, setKrwText] = useState('15000');
  const [krwRate, setKrwRate] = useState(FALLBACK_RATES.KRW);
  const [countMode, setCountMode] = useState<'people' | 'items'>('people');
  const [countN, setCountN] = useState(4);

  useEffect(() => {
    let active = true;
    getLiveExchangeRates()
      .then((r) => {
        if (active && r.KRW > 0) setKrwRate(r.KRW);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const numericKrw = Number(krwText.replace(/[^\d]/g, ''));
  const parsedPrice = krwToKorean(numericKrw);
  const approxEur = numericKrw > 0 ? numericKrw / krwRate : 0;

  const counts = countMode === 'people' ? PEOPLE_COUNTS : ITEM_COUNTS;
  const activeCount = counts.find((c) => c.n === countN) ?? counts[0];
  const priceLine: ShowLine | null = parsedPrice
    ? {
        text: `${numericKrw.toLocaleString('ko-KR')}원 (${parsedPrice.hangul})`,
        rom: parsedPrice.rom,
        it: `${numericKrw.toLocaleString('it-IT')} ₩ · ≈ ${approxEur.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`
      }
    : null;

  return (
    <section className="rounded-xl bg-[#101c29] p-4 sm:p-5 space-y-5" data-keep-style data-testid="korean-price-guide">
      <div>
        <h3 className="font-display text-base font-semibold text-white">Prezzi e quantità al volo</h3>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
          In Corea i prezzi usano i numeri sino-coreani, mentre persone e pezzi usano quelli nativi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Cifre e prezzi */}
        <div className="space-y-3">
          <label htmlFor="krw-guide-input" className="block text-xs font-medium text-slate-300">
            Importo in won (KRW)
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">₩</span>
              <input
                id="krw-guide-input"
                type="text"
                inputMode="numeric"
                value={krwText}
                onChange={(e) => setKrwText(e.target.value.replace(/[^\d]/g, '').slice(0, 9))}
                placeholder="15000"
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 pl-8 pr-3 text-base font-semibold tabular-nums text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
                data-testid="price-guide-input"
              />
            </div>
            {approxEur > 0 && (
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[#52d9e6]">
                ≈ {approxEur.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {KRW_PRESETS.map((v) => {
              const active = numericKrw === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setKrwText(String(v))}
                  aria-pressed={active}
                  data-keep-style
                  className={`min-h-9 px-2.5 rounded-lg text-xs font-medium tabular-nums transition-colors ${FOCUS_RING} ${
                    active ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]'
                  }`}
                >
                  {v.toLocaleString('it-IT')}
                </button>
              );
            })}
          </div>

          {parsedPrice && priceLine && (
            <div className="rounded-xl bg-[#0a1119] px-3.5 py-3 flex items-center gap-3" data-keep-style data-testid="price-guide-output">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-white break-keep" lang="ko">{parsedPrice.hangul}</div>
                <div className="text-xs italic text-slate-400">{parsedPrice.rom}</div>
              </div>
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => onSpeak(parsedPrice.hangul, 'price-guide')}
                  aria-label="Ascolta importo in coreano"
                  aria-pressed={speakingId === 'price-guide'}
                  data-keep-style
                  className={`min-h-11 min-w-11 rounded-xl flex items-center justify-center transition-colors ${FOCUS_RING} ${
                    speakingId === 'price-guide' ? 'bg-[#52d9e6] text-[#04242a]' : 'bg-white/[0.07] text-slate-200 hover:bg-white/[0.12]'
                  }`}
                >
                  {speakingId === 'price-guide' ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => onShow('Importo', priceLine, parsedPrice.hangul)}
                aria-label="Mostra importo a schermo intero"
                data-keep-style
                className={`min-h-11 min-w-11 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-slate-200 flex items-center justify-center transition-colors ${FOCUS_RING}`}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Persone / Pezzi + frasi lampo */}
        <div className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300">Quantità</span>
              <div className="inline-flex rounded-lg bg-[#0a1119] p-0.5" role="group" aria-label="Tipo di quantità" data-keep-style>
                {(
                  [
                    ['people', 'Persone'],
                    ['items', 'Pezzi']
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCountMode(id)}
                    aria-pressed={countMode === id}
                    data-keep-style
                    className={`min-h-8 px-3 rounded-md text-xs font-medium transition-colors ${FOCUS_RING} ${
                      countMode === id ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {counts.map((c) => {
                const active = c.n === countN;
                return (
                  <button
                    key={c.n}
                    type="button"
                    onClick={() => setCountN(c.n)}
                    aria-pressed={active}
                    data-keep-style
                    className={`min-h-11 rounded-xl text-sm font-semibold tabular-nums transition-colors ${FOCUS_RING} ${
                      active ? 'bg-[#52d9e6] text-[#04242a]' : 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]'
                    }`}
                  >
                    {c.n}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl bg-[#0a1119] px-3.5 py-3 flex items-center gap-3" data-keep-style data-testid="count-guide-output">
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold text-white break-keep" lang="ko">{activeCount.phrase.text}</div>
                <div className="text-xs italic text-slate-400">{activeCount.phrase.rom}</div>
                <div className="text-xs text-slate-300 mt-0.5">{activeCount.phrase.it}</div>
              </div>
              {speechSupported && (
                <button
                  type="button"
                  onClick={() => onSpeak(activeCount.phrase.text, `count-${countMode}-${countN}`)}
                  aria-label={`Ascolta: ${activeCount.phrase.it}`}
                  aria-pressed={speakingId === `count-${countMode}-${countN}`}
                  data-keep-style
                  className={`min-h-11 min-w-11 rounded-xl flex items-center justify-center transition-colors ${FOCUS_RING} ${
                    speakingId === `count-${countMode}-${countN}` ? 'bg-[#52d9e6] text-[#04242a]' : 'bg-white/[0.07] text-slate-200 hover:bg-white/[0.12]'
                  }`}
                >
                  {speakingId === `count-${countMode}-${countN}` ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => onShow(countMode === 'people' ? 'Persone' : 'Quantità', activeCount.phrase)}
                aria-label={`Mostra: ${activeCount.phrase.it}`}
                data-keep-style
                className={`min-h-11 min-w-11 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-slate-200 flex items-center justify-center transition-colors ${FOCUS_RING}`}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Frasi lampo di cassa/tavolo */}
          <div>
            <div className="text-xs font-medium text-slate-300 mb-2">Frasi lampo</div>
            <div className="divide-y divide-white/[0.08] border-t border-white/[0.08]">
              {QUICK_COUNTER_PHRASES.map((phrase, idx) => {
                const id = `quick-ko-${idx}`;
                const active = speakingId === id;
                return (
                  <div key={phrase.text} className="py-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onShow('Al volo', phrase)}
                      className={`min-w-0 flex-1 text-left py-1 ${FOCUS_RING}`}
                    >
                      <span className="block text-sm font-semibold text-white">{phrase.it}</span>
                      <span className="block text-xs text-slate-400">
                        <span lang="ko" className="text-slate-200">{phrase.text}</span> · <span className="italic">{phrase.rom}</span>
                      </span>
                    </button>
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={() => onSpeak(phrase.text, id)}
                        aria-label={`Ascolta: ${phrase.it}`}
                        aria-pressed={active}
                        data-keep-style
                        className={`min-h-10 min-w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${FOCUS_RING} ${
                          active ? 'bg-[#52d9e6] text-[#04242a]' : 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.12]'
                        }`}
                      >
                        {active ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
