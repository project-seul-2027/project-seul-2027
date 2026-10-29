import React, { useState, useEffect } from 'react';
import { 
  PDF_BUDGET_ESTIMATES, EXCHANGE_RATES as STATIC_RATES 
} from '../data/tripData';
import { getLiveExchangeRates, LiveExchangeRates, FALLBACK_RATES } from '../services/currencyService';
import { 
  Calculator, ArrowRightLeft, RefreshCw, PiggyBank
} from 'lucide-react';

export const BudgetTrackerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'estimates' | 'saver_tips' | 'converter'>('estimates');

  // Live Exchange Rates state
  const [rates, setRates] = useState<LiveExchangeRates>(FALLBACK_RATES);
  const [isLoadingRates, setIsLoadingRates] = useState(false);

  // Currency Converter state
  const [convertAmount, setConvertAmount] = useState<number>(10000);
  const [convertFrom, setConvertFrom] = useState<'KRW' | 'EUR' | 'CNY'>('KRW');

  // Fetch live exchange rates on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingRates(true);
    getLiveExchangeRates()
      .then((live) => {
        if (isMounted) {
          setRates(live);
          setIsLoadingRates(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingRates(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRefreshRates = async () => {
    setIsLoadingRates(true);
    const updated = await getLiveExchangeRates(true);
    setRates(updated);
    setIsLoadingRates(false);
  };

  return (
    <div className="space-y-6">
      {/* Live Exchange Rate Indicator Strip */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="text-xs">
            <span className="font-bold text-white">Tasso di cambio live online:</span>{' '}
            <span className="text-slate-300">
              1 € = <strong className="text-cyan-400 font-mono">{rates.KRW} ₩</strong> · 1 € ={' '}
              <strong className="text-amber-400 font-mono">{rates.CNY} ¥</strong>
            </span>
            <span className="text-slate-500 ml-2 font-mono text-[11px]">
              (Aggiornato: {rates.lastUpdatedDate} ore {rates.lastUpdatedTime})
            </span>
          </div>
        </div>

        <button
          onClick={handleRefreshRates}
          disabled={isLoadingRates}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 hover:text-white border border-slate-700/80 flex items-center gap-1.5 self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRates ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Aggiorna Cambio Live</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('estimates')}
          className={`px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center leading-tight transition-all ${
            activeTab === 'estimates'
              ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>Preventivo</span>
        </button>

        <button
          onClick={() => setActiveTab('saver_tips')}
          className={`px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center leading-tight transition-all ${
            activeTab === 'saver_tips'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <PiggyBank className="w-3.5 h-3.5" />
          <span>Risparmio</span>
        </button>

        <button
          onClick={() => setActiveTab('converter')}
          className={`px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-center leading-tight transition-all ${
            activeTab === 'converter'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>Convertitore</span>
        </button>
      </div>

      {/* Tab 1: Preventivo (PDF) */}
      {activeTab === 'estimates' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-purple-400" />
                Preventivo Ufficiale dal PDF (Seul 2027)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Stima calcolata sul documento per 17 notti (Pietro per 8 notti dal 2 al 9 marzo, gli altri 3 per tutte le 17 notti fino al 19 marzo). Voci suddivise per persona e totali di gruppo.
              </p>
            </div>

            {/* Ripartizione Affitto Alloggi Enko Stay */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                  <PiggyBank className="w-4 h-4 text-cyan-400" />
                  Ripartizione Affitto Fissata nel PDF (Pietro 8 notti vs Altri 3 per 17 notti)
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  Formula: <span className="text-white font-semibold">Costo notte / n° persone</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>Opzione A: Myeongdong</span>
                    <span className="font-mono text-emerald-400 font-bold">424 €</span>
                  </div>
                  <div className="text-[11px] text-slate-400">~25 € / notte</div>
                  <div className="pt-1 border-t border-slate-800/80 flex justify-between font-mono">
                    <span className="text-purple-300">Pietro (8n): <strong>50 €</strong></span>
                    <span className="text-cyan-300">Ognuno dei 3: <strong>125 €</strong></span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>Opzione B: Stazione Seul</span>
                    <span className="font-mono text-sky-400 font-bold">659 €</span>
                  </div>
                  <div className="text-[11px] text-slate-400">~39 € / notte</div>
                  <div className="pt-1 border-t border-slate-800/80 flex justify-between font-mono">
                    <span className="text-purple-300">Pietro (8n): <strong>78 €</strong></span>
                    <span className="text-cyan-300">Ognuno dei 3: <strong>194 €</strong></span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>Opzione C: Mapo (Hongdae)</span>
                    <span className="font-mono text-pink-400 font-bold">748 €</span>
                  </div>
                  <div className="text-[11px] text-slate-400">~44 € / notte</div>
                  <div className="pt-1 border-t border-slate-800/80 flex justify-between font-mono">
                    <span className="text-purple-300">Pietro (8n): <strong>88 €</strong></span>
                    <span className="text-cyan-300">Ognuno dei 3: <strong>220 €</strong></span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>Opzione D: Sinseol-dong</span>
                    <span className="font-mono text-purple-400 font-bold">641 €</span>
                  </div>
                  <div className="text-[11px] text-slate-400">~38 € / notte</div>
                  <div className="pt-1 border-t border-slate-800/80 flex justify-between font-mono">
                    <span className="text-purple-300">Pietro (8n): <strong>75 €</strong></span>
                    <span className="text-cyan-300">Ognuno dei 3: <strong>189 €</strong></span>
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-800 text-xs">
              {PDF_BUDGET_ESTIMATES.map((item, idx) => (
                <div key={idx} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-bold text-white text-sm">{item.category}</div>
                    <p className="text-slate-300 leading-relaxed max-w-xl">{item.detail}</p>
                  </div>
                  <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center shrink-0 font-mono">
                    <span className="text-sm font-bold text-emerald-400">{item.totalPerPerson} / persona</span>
                    <span className="text-xs text-slate-400">Tot. gruppo: {item.groupTotal}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total summary banner */}
            <div className="mt-4 p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-bold text-emerald-300 text-sm block">
                  Budget Medio Conservativo Stimato a Persona:
                </span>
                <span className="text-slate-400">
                  Include alloggio, pasti economici, serate universitarie/pocha, trasporti T-Money, scalo Pechino (25-40 €) ed escursioni.
                </span>
              </div>
              <div className="text-right shrink-0 font-mono">
                <div className="text-xl font-bold text-emerald-400">~320 - 465 € / pers.</div>
                <div className="text-xs text-slate-400">≈ 1.280 - 1.860 € gruppo</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Guida Strategica al Risparmio (Budget Saver) */}
      {activeTab === 'saver_tips' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-base">
              <PiggyBank className="w-5 h-5" />
              <h3>Strategie & Trucchi per Risparmiare al Massimo a Seul</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Consigli pratici e verificati per godersi il viaggio senza spendere una fortuna, approfittando delle regole e usanze coreane:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-cyan-300">
                  <span>1.</span> Noleggio Hanbok = Palazzi Reali a Costo Zero
                </h4>
                <p className="text-slate-300">
                  Chi indossa l'abito tradizionale coreano (Hanbok) entra <strong>gratis</strong> in tutti i palazzi storici (Gyeongbokgung, Changdeokgung, Deoksugung). Il noleggio costa circa 10-12 € e permette di risparmiare sui singoli biglietti facendo foto spettacolari!
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-cyan-300">
                  <span>2.</span> Convenience Store Ramen & Birre sul Fiume Han
                </h4>
                <p className="text-slate-300">
                  Una delle cene più autentiche e divertenti di Seul: acquistare ramyeon, uova e formaggio nei CU o GS25 lungo il fiume Han, cucinarli con le macchinette automatiche sul posto e cenare al tramonto con vista skyline per meno di 3-4 € a persona.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-cyan-300">
                  <span>3.</span> Zone Universitarie (Sinchon & Kondae)
                </h4>
                <p className="text-slate-300">
                  Invece di uscire nei locali costosi di Gangnam o Itaewon, concentrate le serate a <strong>Sinchon</strong> (adiacente a Hongdae) e <strong>Kondae</strong>: i pocha, i pub e le grigliate BBQ per studenti costano il 35-45% in meno e sono frequentatissimi da ragazzi del posto.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-cyan-300">
                  <span>4.</span> T-Money: Trasferimenti Gratuiti Metro-Bus
                </h4>
                <p className="text-slate-300">
                  Se cambiate mezzo tra metro e bus (o viceversa) entro 30 minuti, il secondo tragitto è <strong>gratuito o scontatissimo</strong>! Ricordatevi sempre di passare la carta sia in entrata che in uscita dal bus e dai tornelli della metro.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-cyan-300">
                  <span>5.</span> Trekking Gratuiti: Bukhansan & Namsan
                </h4>
                <p className="text-slate-300">
                  I parchi nazionali e le vette montane di Seul sono aperti al pubblico e 100% gratuiti. La salita a piedi al monte Namsan attraverso i sentieri alberati non costa nulla (si evita la costosa funivia a pagamento).
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-cyan-300">
                  <span>6.</span> Tax Refund Immediato con Passaporto
                </h4>
                <p className="text-slate-300">
                  Da Olive Young e nei negozi contrassegnati da "Immediate Tax Refund", mostrando il passaporto fisico alla cassa per acquisti superiori a 30.000 KRW, l'IVA del 7-8% viene scalata direttamente dal conto senza dover fare code in aeroporto.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Quick Currency Converter */}
      {activeTab === 'converter' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="max-w-xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-amber-400" />
                Convertitore Live (Dati Online)
              </h3>
              <p className="text-xs text-slate-400">
                Cambio in tempo reale: 1 € = {rates.KRW} ₩ · 1 € = {rates.CNY} ¥ (aggiornato oggi)
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <label className="text-xs text-slate-400 font-medium block">Inserisci importo da convertire:</label>
              <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                <input
                  type="number"
                  value={convertAmount || ''}
                  onChange={(e) => setConvertAmount(Number(e.target.value))}
                  className="w-full sm:flex-1 min-w-0 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-base focus:outline-none focus:border-cyan-500"
                />
                <select
                  value={convertFrom}
                  onChange={(e) => setConvertFrom(e.target.value as any)}
                  className="w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="KRW">KRW · Won (₩)</option>
                  <option value="EUR">EUR · Euro (€)</option>
                  <option value="CNY">CNY · Yuan (¥)</option>
                </select>
              </div>
            </div>

            {/* Risultati: sopra 1 miliardo il numero si abbrevia (es. 673 Mrd €), il valore intero resta nel suggerimento */}
            {(() => {
              const eurVal = convertFrom === 'EUR' ? convertAmount : convertFrom === 'KRW' ? convertAmount / rates.KRW : convertAmount / rates.CNY;
              const krwVal = convertFrom === 'KRW' ? convertAmount : convertFrom === 'EUR' ? convertAmount * rates.KRW : (convertAmount / rates.CNY) * rates.KRW;
              const cnyVal = convertFrom === 'CNY' ? convertAmount : convertFrom === 'EUR' ? convertAmount * rates.CNY : (convertAmount / rates.KRW) * rates.CNY;
              const fmt = (v: number, dec: number, sign: string) => {
                if (!Number.isFinite(v)) return '—';
                const full = `${new Intl.NumberFormat('it-IT', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v)} ${sign}`;
                // 1 miliardo → "673 mld"; oltre mille miliardi → notazione scientifica, sempre corta
                const short = Math.abs(v) >= 1e12
                  ? `${new Intl.NumberFormat('it-IT', { notation: 'scientific', maximumFractionDigits: 2 }).format(v)} ${sign}`
                  : Math.abs(v) >= 1e9
                    ? `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(v / 1e9)} mld ${sign}`
                    : full;
                return { full, short };
              };
              const cells = [
                { label: 'Euro (EUR)', color: 'text-cyan-400', v: fmt(eurVal, 2, '€') },
                { label: 'Won (KRW)', color: 'text-amber-400', v: fmt(krwVal, 0, '₩') },
                { label: 'Yuan (CNY)', color: 'text-purple-400', v: fmt(cnyVal, 2, '¥') }
              ];
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 text-left sm:text-center">
                  {cells.map((c) => (
                    <div key={c.label} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 sm:block min-w-0">
                      <div className="text-[10px] text-slate-500 uppercase font-semibold shrink-0">{c.label}</div>
                      {typeof c.v === 'string' ? (
                        <div className={`text-[15px] sm:text-base xl:text-lg font-bold font-mono ${c.color} text-right sm:text-center sm:mt-1 min-w-0`}>{c.v}</div>
                      ) : (
                        <div
                          title={c.v.full}
                          className={`${c.v.short.length > 11 ? 'text-sm sm:text-[13px] xl:text-sm' : 'text-[15px] sm:text-base xl:text-lg'} font-bold font-mono ${c.color} text-right sm:text-center sm:mt-1 min-w-0 whitespace-nowrap`}
                        >
                          {c.v.short}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
