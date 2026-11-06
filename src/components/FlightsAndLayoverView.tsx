import React, { useState } from 'react';
import { FLIGHTS_SCHEDULE, BEIJING_TRANSIT_BUDGET, FLIGHTS_BOOKING_URL } from '../data/tripData';
import { 
  Plane, Clock, MapPin, AlertTriangle, ShieldCheck, 
  CreditCard, Wifi, Thermometer, Luggage, CheckCircle2, ChevronRight, FileText, ExternalLink, Users, ShoppingBag
} from 'lucide-react';
import { FoldText } from './mobile/FoldText';
import { useMediaQuery } from '../pwa';
import { MobileVoli } from './mobile/MobileVoli';
import './mobile/mobile.css';

export const FlightsAndLayoverView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'flights' | 'beijing_guide' | 'malpensa'>('flights');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const desktopTabs: [typeof activeTab, string][] = [
    ['flights', 'Voli e biglietti Air China'],
    ['beijing_guide', 'Scalo a Pechino (240 ore)'],
    ['malpensa', '1 marzo: ritrovo a Malpensa'],
  ];

  const desktopNav = (
    <div className="flex items-end justify-between border-b border-slate-800/80">
      <div className="flex gap-8">
        {desktopTabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`pb-3 -mb-px border-b-2 text-sm font-semibold transition-colors ${
              activeTab === id ? 'border-cyan-400 text-white' : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <a
        href={FLIGHTS_BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="pb-3 text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
        title="Apri i voli selezionati su GoToGate in una nuova scheda"
      >
        Voli su GoToGate
      </a>
    </div>
  );

  const renderLeg = (leg: (typeof FLIGHTS_SCHEDULE)[number]) => (
    <li key={leg.id} className="py-5 border-t border-slate-800/80 first:border-t-0 space-y-3">
      <div className="flex items-baseline justify-between text-sm text-slate-400">
        <span>{leg.flightNumber} · {leg.departureDate}</span>
        <span>{leg.duration}</span>
      </div>
      <div className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-3 items-baseline">
        <span className="text-3xl font-semibold text-white tabular-nums leading-none">{leg.departureTime}</span>
        <span className="text-sm text-slate-300">
          <strong className="text-white">{leg.departureAirportCode}</strong> {leg.departureAirport}
          <span className="text-slate-500"> · Terminal {leg.departureTerminal}</span>
        </span>
        <span className="text-3xl font-semibold text-white tabular-nums leading-none">{leg.arrivalTime}</span>
        <span className="text-sm text-slate-300">
          <strong className="text-white">{leg.arrivalAirportCode}</strong> {leg.arrivalAirport}
          <span className="text-slate-500"> · Terminal {leg.arrivalTerminal}</span>
        </span>
      </div>
      {leg.layoverNotice && <p className="text-sm text-slate-300">{leg.layoverNotice}</p>}
      <p className="text-sm text-slate-400">{leg.baggageInfo}</p>
    </li>
  );

  const desktopFlights = (
    <div className="space-y-12 animate-in fade-in duration-200">
      <section className="grid grid-cols-2 divide-x divide-slate-800/80">
        <div className="pr-10 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Andata, 1-2 marzo</h2>
            <p className="text-sm text-slate-400 mt-1">Milano → Seul con Air China, scalo a Pechino</p>
          </div>
          <ul>{FLIGHTS_SCHEDULE.slice(0, 2).map(renderLeg)}</ul>
          <div className="border-l-2 border-slate-700 pl-4 space-y-1 text-sm text-slate-300">
            <p className="font-semibold text-white">Promemoria</p>
            <p>Ritrovo al Terminal 1 di Malpensa entro le 10:00, davanti ai banchi Air China.</p>
            <p>Chiedere valigie etichettate fino a Seul (ICN) e carte d'imbarco di entrambi i tratti.</p>
          </div>
        </div>

        <div className="pl-10 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Rientro dei tre, 19-20 marzo</h2>
            <p className="text-sm text-slate-400 mt-1">Seul → Pechino → Milano, con 12 ore di scalo a Pechino</p>
          </div>
          <ul>{FLIGHTS_SCHEDULE.slice(2, 4).map(renderLeg)}</ul>
          <div className="border-l-2 border-rose-400/70 pl-4 space-y-1 text-sm text-slate-300">
            <p className="font-semibold text-white">Regola d'oro del rientro a Pechino</p>
            <p>Partenza da Qianmen centro alle 21:15, senza ritardi.</p>
            <p>Arrivo al T3 entro le 22:45 per il decollo delle 02:15 per Milano Malpensa.</p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800/80 pt-10 space-y-6">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold text-white">10 marzo: Pietro rientra a Milano</h2>
            <p className="text-sm text-slate-400 mt-1">Incheon 11:10 → Milano Malpensa, arrivo alle 6:30 dell'11 marzo · 8 notti (2-9 marzo)</p>
          </div>
          <p className="text-sm text-slate-400">Quota affitto di Pietro: <strong className="text-white">50-88 €</strong></p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-800/80">
          <div className="pr-8 space-y-2">
            <h3 className="text-base font-semibold text-white">Check-out e partenza per l'aeroporto</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Lasciare l'alloggio verso le <strong className="text-white">5:45-6:00</strong> per essere a Incheon circa <strong className="text-white">3 ore prima</strong> del volo delle 11:10. Il primo AREX parte verso le 5:30 (da verificare); alternativa taxi o bus aeroporto.
            </p>
          </div>
          <div className="px-8 space-y-2">
            <h3 className="text-base font-semibold text-white">Saluto alla stazione</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Gli altri amici accompagnano Pietro alla stazione da cui parte per l'aeroporto e lo salutano lì; poi chi resta torna a dormire e fa colazione con calma. La sera prima, il 9 marzo, c'è l'ultima uscita in quattro.
            </p>
          </div>
          <div className="pl-8 space-y-2">
            <h3 className="text-base font-semibold text-white">Alloggio e chiavi</h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Avvisare l'host Enko Stay che da mercoledì 10 marzo restano meno ospiti (prezzo invariato, da confermare). Verificare che Pietro non lasci oggetti e che le chiavi o i codici restino al gruppo.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800/80 pt-10">
        <div className="grid grid-cols-3 divide-x divide-slate-800/80">
          <div className="pr-8 space-y-2">
            <h3 className="text-base font-semibold text-white">Bagaglio in stiva: 23 kg</h3>
            <p className="text-sm text-slate-300 leading-relaxed">Pesare le valigie il 18 marzo. Superare i 23 kg comporta tariffe extra salate.</p>
          </div>
          <div className="px-8 space-y-2">
            <h3 className="text-base font-semibold text-white">Power bank: marchio 3C</h3>
            <p className="text-sm text-slate-300 leading-relaxed">In Cina e in aereo sono severissimi: power bank solo nello zaino a mano e rigorosamente marcati 3C.</p>
          </div>
          <div className="pl-8 space-y-2">
            <h3 className="text-base font-semibold text-white">Fuso orario</h3>
            <p className="text-sm text-slate-300 leading-relaxed">Seul: UTC+9 (+8h rispetto a Milano). Pechino: UTC+8 (+7h). All'atterraggio a Pechino spostare l'orologio indietro di 1 ora.</p>
          </div>
        </div>
      </section>
    </div>
  );


  return (
    <div className="space-y-6">
      {/* Navigation Sub-Tabs & Direct GoToGate Action */}
      {isDesktop ? desktopNav : (
        <div className="ms-seg" role="tablist" aria-label="Sezioni voli" style={{ margin: '-20px -20px 16px', padding: '0 20px' }}>
          {([['flights', 'Voli'], ['beijing_guide', 'Scalo a Pechino'], ['malpensa', 'Ritrovo 1 marzo']] as [typeof activeTab, string][]).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)}>{label}</button>
          ))}
        </div>
      )}

      {/* Tab 1: Flights Schedule & Cards */}
      {activeTab === 'flights' && (isDesktop ? desktopFlights : (<MobileVoli />))}

      {/* Tab 2: Deep Guide for Beijing 240h Transit */}
      {activeTab === 'beijing_guide' && (
        <div className="space-y-6 animate-in fade-in duration-200 desk-flat-flights">
          {/* Header intro */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl"></span>
                <h3 className="text-lg font-bold text-white font-display">
                  19 Marzo: Pomeriggio & Notte a Pechino (Transito 240 ore)
                </h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/40">
                Ore Pechino: 14:20 - 02:15
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              L'idea è uscire dall'aeroporto sfruttando il programma di transito senza visto di 240 ore per i cittadini italiani, fare una serata memorabile nel centro storico di Pechino (via pedonale di Qianmen, cena imperiale con anatra laccata e vista su Piazza Tiananmen illuminata) e rientrare al Terminal 3 con largo margine.
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20">
              <span className="text-xs text-amber-200/80">
                Scalo programmato con volo Air China CA 124 (ICN 13:10) e CA 949 (PEK 02:15 per MXP)
              </span>
              <a
                href={FLIGHTS_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40 transition-colors"
              >
                <Plane className="w-3.5 h-3.5" />
                <span>Vedi Voli su GoToGate</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Step-by-step breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
                Procedura all'Arrivo al Terminal 3 (Passo per Passo)
              </h4>

              <div className="space-y-3">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="text-xs space-y-1">
                    <h5 className="font-bold text-white">Al check-in di Incheon (19 marzo mattina):</h5>
                    <p className="text-slate-300">
                      Dire ad Air China che userete il transito 240h senza visto a Pechino. Mostrare la prenotazione Pechino-Milano. Chiedere che le valigie da 23kg siano etichettate ed imbarcate fino a Milano MXP (così a Pechino si esce solo con lo zaino leggero!).
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="text-xs space-y-1">
                    <h5 className="font-bold text-white">Dopo l'atterraggio a PEK (T3):</h5>
                    <p className="text-slate-300 font-medium text-red-300">
                      ATTENZIONE: NON seguire i cartelli "International Transfer" (che portano nella zona transiti senza poter uscire). Seguire le indicazioni "240-hour Visa-free Transit" nell'area dei controlli di frontiera.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="text-xs space-y-1">
                    <h5 className="font-bold text-white">Banco Transito 240h:</h5>
                    <p className="text-slate-300">
                      Mostrare passaporto, carta d'imbarco o prenotazione Pechino-Milano, QR code della carta d'arrivo compilata online (s.nia.gov.cn) ed eventuale indirizzo. L'agente rilascia il permesso d'ingresso temporaneo (foglio a parte con data limite, da conservare assolutamente!).
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div className="text-xs space-y-1">
                    <h5 className="font-bold text-white">Controlli passaporti & Uscita:</h5>
                    <p className="text-slate-300">
                      Fila per stranieri, timbro d'ingresso, impronte. Ritiro valigie solo se non vanno a Milano (in tal caso lasciarle al deposito bagagli del T3 per 20-40 CNY). Uscita nella hall arrivi.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    5
                  </div>
                  <div className="text-xs space-y-1">
                    <h5 className="font-bold text-white">Trasporti verso Qianmen:</h5>
                    <p className="text-slate-300">
                      Airport Express (25 CNY, 20-25 min) fino a Dongzhimen. Da lì metro Linea 2 fino alla stazione di Qianmen (circa 3 CNY).
                    </p>
                  </div>
                </div>

                <div className="bg-red-950/30 border border-red-500/40 p-4 rounded-xl flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-500 text-slate-950 font-bold font-mono text-xs flex items-center justify-center shrink-0">
                    6
                  </div>
                  <div className="text-xs space-y-1">
                    <h5 className="font-bold text-red-200 uppercase">Rientro Tassativo in Aeroporto (Ore 21:15):</h5>
                    <p className="text-red-300">
                      La partenza dal centro città verso l'aeroporto DEVE avvenire al massimo alle 21:15. Arrivo al T3 entro le 22:45. Non rischiare per nessun motivo: l'ultimo Airport Express è alle 22:30 circa (piano B: taxi/Didi 100-150 CNY).
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Practical China Advice & Budget */}
            <div className="space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  Stima Spese Scalo a Persona
                </h4>
                <div className="divide-y divide-slate-800 text-xs">
                  {BEIJING_TRANSIT_BUDGET.map((b, idx) => (
                    <div key={idx} className="py-2 flex items-center justify-between">
                      <div>
                        <div className="text-slate-200 font-medium">{b.item}</div>
                        <div className="text-[10px] text-slate-400">{b.notes}</div>
                      </div>
                      <div className="text-right shrink-0 ml-2 font-mono">
                        <div className="text-amber-400 font-bold">{b.cny}</div>
                        <div className="text-[10px] text-slate-400">~{b.eur}</div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 flex items-center justify-between font-bold">
                    <span className="text-white">Totale a persona:</span>
                    <span className="text-amber-300 font-mono">190 - 310 CNY (~25 - 40 €)</span>
                  </div>
                </div>
              </div>

              {/* Crucial China rules */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                <h4 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-xs">
                  Internet, Pagamenti & Clima
                </h4>
                <div className="space-y-2 text-slate-300">
                  <p>• <strong>Firewall:</strong> Google, WhatsApp e Instagram sono bloccati. Usare eSIM o roaming dati con IP italiano.</p>
                  <p>• <strong>Pagamenti:</strong> Alipay (Tour Pass) o WeChat Pay collegati a carta Visa/Mastercard. Tenere 200-300 CNY in contanti (circa 7,50 CNY per 1 €).</p>
                  <p>• <strong>Clima:</strong> A Pechino la sera fa freddo a marzo (0 - 8 °C). Portare una giacca vera nello zaino!</p>
                  <p>• <strong>Tiananmen:</strong> Richiede prenotazione obbligatoria online con numero di passaporto con almeno 24h di anticipo.</p>
                </div>
              </div>

              {/* Backup Plan */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs space-y-1 text-slate-400">
                <span className="font-bold text-slate-300">Piano di Riserva:</span>
                <p>Se il permesso 240h non viene concesso per code o restrizioni doganali: si rimane nella zona transiti internazionali. Air China offre un hotel gratuito per scali lunghi (da prenotare almeno 24h prima se idonei).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Malpensa Meeting 1 March */}
      {activeTab === 'malpensa' && (
        <div className="space-y-6 animate-in fade-in duration-200 desk-flat-flights">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold lg:hidden">
                1 MAR
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  1 Marzo 2027: Ritrovo a Milano Malpensa
                </h3>
                <p className="text-xs text-slate-400">
                  Obiettivo: trovarsi tutti insieme al Terminal 1 entro le 10:00 (davanti ai banchi check-in Air China)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Da Milano Centrale (Treno Malpensa Express)
                </h4>
                <p className="text-slate-300">
                  Biglietto circa 15 € (consigliato acquistarlo in anticipo sull'app Trenord). Il viaggio dura circa 50 minuti.
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-slate-200 space-y-1">
                  <div>• Treno 1: 08:25 (arrivo a T1 verso le 09:16)</div>
                  <div>• Treno 2: 08:55 (arrivo a T1 verso le 09:46)</div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <Plane className="w-4 h-4" />
                  Chi arriva in aereo a Malpensa
                </h4>
                <p className="text-slate-300">
                  Chi atterra a Malpensa con voli nazionali o low-cost (es. Wizz Air che opera dal T1) ritira eventuale bagaglio in stiva e sale a piedi alle partenze T1.
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-slate-300">
                  Condividere in chat l'orario di atterraggio e il numero di cellulare attivo.
                </div>
              </div>
            </div>

            {/* Checklist of 4 golden rules */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Le 4 Regole d'Oro per la Partenza:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/60 text-slate-300">
                  <strong className="text-white block mb-0.5">1. Arrivo al T1 entro le 10:00</strong>
                  Massima puntualità davanti ai banchi Air China per iniziare insieme le procedure.
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/60 text-slate-300">
                  <strong className="text-white block mb-0.5">2. Avvisare subito in caso di ritardo</strong>
                  Se un treno o mezzo ritarda, comunicare tempestivamente sul gruppo WhatsApp.
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/60 text-slate-300">
                  <strong className="text-white block mb-0.5">3. Chiusura banchi Air China</strong>
                  Il banco chiude circa 60 minuti prima del volo (11:30), ma conviene essere registrati prima delle 10:30.
                </div>
                <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/60 text-slate-300">
                  <strong className="text-white block mb-0.5">4. Verifica Terminal</strong>
                  Se la prenotazione definitiva indica Terminal 2 (T2), il ritrovo di gruppo si sposta al T2.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
