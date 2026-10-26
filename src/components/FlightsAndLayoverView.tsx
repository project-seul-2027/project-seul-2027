import React, { useState } from 'react';
import { FLIGHTS_SCHEDULE, BEIJING_TRANSIT_BUDGET, FLIGHTS_BOOKING_URL } from '../data/tripData';
import { 
  Plane, Clock, MapPin, AlertTriangle, ShieldCheck, 
  CreditCard, Wifi, Thermometer, Luggage, CheckCircle2, ChevronRight, FileText, ExternalLink, Users, ShoppingBag
} from 'lucide-react';

export const FlightsAndLayoverView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'flights' | 'beijing_guide' | 'malpensa'>('flights');

  return (
    <div className="space-y-6">
      {/* Navigation Sub-Tabs & Direct GoToGate Action */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2">
          <button
            onClick={() => setActiveTab('flights')}
            className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center justify-center sm:justify-start gap-2 transition-all min-w-0 ${
              activeTab === 'flights'
                ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Plane className="w-3.5 h-3.5" />
            <span>Voli & Biglietti Air China</span>
          </button>

          <button
            onClick={() => setActiveTab('beijing_guide')}
            className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center justify-center sm:justify-start gap-2 transition-all min-w-0 ${
              activeTab === 'beijing_guide'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span className="text-sm">🇨🇳</span>
            <span>Guida Scalo Pechino 240h</span>
          </button>

          <button
            onClick={() => setActiveTab('malpensa')}
            className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold flex items-center justify-center sm:justify-start gap-2 transition-all min-w-0 ${
              activeTab === 'malpensa'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>1 Marzo: Ritrovo Malpensa</span>
          </button>
        </div>

        {/* Quick Header CTA to GoToGate */}
        <a
          href={FLIGHTS_BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full sm:w-auto justify-center items-center gap-2 px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold text-sky-200 bg-sky-950/70 hover:bg-sky-900/80 border border-sky-500/40 hover:border-sky-400 shadow-md shadow-sky-950/40 transition-all hover:scale-[1.02] active:scale-[0.98] group"
          title="Apri i voli selezionati su GoToGate in una nuova scheda"
        >
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <Plane className="w-3.5 h-3.5 text-sky-400 transform rotate-45" />
          <span>Voli su GoToGate</span>
          <ExternalLink className="w-3.5 h-3.5 text-sky-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </a>
      </div>

      {/* Tab 1: Flights Schedule & Cards */}
      {activeTab === 'flights' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Main GoToGate Hero Booking Banner */}
          <div className="bg-gradient-to-r from-sky-950/80 via-slate-900 to-cyan-950/50 border border-sky-500/35 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="absolute top-0 right-0 w-96 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-2.5 relative z-10 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 font-mono text-[11px] font-bold border border-sky-500/40 flex items-center gap-1.5">
                  <Plane className="w-3.5 h-3.5 text-sky-400 transform rotate-45" />
                  GoToGate · Voli Selezionati
                </span>
                <span className="text-[11px] text-slate-300 font-mono bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800 max-w-full break-words leading-relaxed">
                  Air China · Milano (MXP) ⇄ Seul (ICN) via Pechino
                </span>
              </div>

              <h3 className="text-base sm:text-xl font-bold text-white font-display tracking-tight">
                Prenotazione Ufficiale Voli di Gruppo (1 - 19/20 Marzo 2027)
              </h3>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Abbiamo impostato la combinazione esatta dei voli concordata: <strong>Andata 1 Mar</strong> ore 12:30 da Malpensa con scalo a Pechino e arrivo a Seul il 2 Mar, e <strong>Ritorno 19 Mar</strong> ore 13:10 con scalo epico di 12 ore a Pechino per l'anatra laccata a Qianmen e rientro a Malpensa la mattina del 20 Mar.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-300 font-medium">
                <span className="flex items-center gap-1 bg-slate-950/50 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Luggage className="w-3.5 h-3.5 text-cyan-400" />
                  Bagaglio da stiva 23 kg incluso
                </span>
                <span className="flex items-center gap-1 bg-slate-950/50 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  Scalo lungo Pechino (14:20 ➔ 02:15)
                </span>
              </div>
            </div>

            <div className="shrink-0 relative z-10 flex flex-col sm:flex-row lg:flex-col gap-2">
              <a
                href={FLIGHTS_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-cyan-500 hover:from-sky-400 hover:via-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-xl shadow-sky-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] group"
              >
                <Plane className="w-4 h-4 transform rotate-45 group-hover:scale-110 transition-transform" />
                <span>Apri Voli su GoToGate</span>
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
              <span className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1.5 font-mono">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Configurazione e date pronte all'acquisto
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Outbound Journey */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Plane className="w-4 h-4 transform rotate-45" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Volo di Andata
                    </h3>
                    <p className="text-xs text-slate-400">1 - 2 Marzo 2027 · Milano ➔ Seul</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={FLIGHTS_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold border border-sky-500/30 flex items-center gap-1 transition-colors"
                    title="Vedi su GoToGate"
                  >
                    <span>GoToGate</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-cyan-300 font-semibold border border-slate-700">
                    Air China
                  </span>
                </div>
              </div>

              {/* Flight legs */}
              <div className="space-y-4">
                {FLIGHTS_SCHEDULE.slice(0, 2).map((leg) => (
                  <div key={leg.id} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>{leg.flightNumber}</span>
                      <span>{leg.departureDate}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black font-mono text-white">
                          {leg.departureAirportCode}
                        </div>
                        <div className="text-xs text-slate-400">{leg.departureAirport}</div>
                        <div className="text-sm font-bold text-cyan-400 mt-1 font-mono">
                          {leg.departureTime}
                        </div>
                        <div className="text-[11px] text-slate-500">Terminal {leg.departureTerminal}</div>
                      </div>

                      <div className="flex flex-col items-center px-4">
                        <span className="text-[10px] text-slate-500 font-mono mb-1">{leg.duration}</span>
                        <div className="w-24 sm:w-32 h-[2px] bg-slate-700 relative flex items-center justify-center">
                          <Plane className="w-3.5 h-3.5 text-cyan-400 bg-slate-950 px-0.5" />
                        </div>
                        {leg.layoverNotice && (
                          <span className="text-[10px] text-amber-400 mt-1 font-medium text-center">
                            {leg.layoverNotice}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black font-mono text-white">
                          {leg.arrivalAirportCode}
                        </div>
                        <div className="text-xs text-slate-400">{leg.arrivalAirport}</div>
                        <div className="text-sm font-bold text-cyan-400 mt-1 font-mono">
                          {leg.arrivalTime}
                        </div>
                        <div className="text-[11px] text-slate-500">Terminal {leg.arrivalTerminal}</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Luggage className="w-3.5 h-3.5 text-slate-400" />
                        {leg.baggageInfo}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Golden rules box */}
              <div className="p-3 bg-cyan-950/20 border border-cyan-500/20 rounded-xl text-xs text-cyan-200/90 space-y-1">
                <div className="font-semibold text-cyan-300">💡 Promemoria Andata:</div>
                <p>• Ritrovo al Terminal 1 di Malpensa entro le 10:00 (davanti ai banchi Air China).</p>
                <p>• Chiedere valigie etichettate fino a Seul (ICN) e carte d'imbarco di entrambi i tratti.</p>
              </div>
            </div>

            {/* Inbound Journey & Layover (Remaining 3 travelers) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <Plane className="w-4 h-4 transform -rotate-45" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Rientro Gruppo (3 Persone) + Scalo Pechino
                    </h3>
                    <p className="text-xs text-slate-400">19 - 20 Marzo 2027 · Seul ➔ Pechino ➔ Milano</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={FLIGHTS_BOOKING_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 flex items-center gap-1 transition-colors"
                    title="Vedi su GoToGate"
                  >
                    <span>GoToGate</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40">
                    Scalo 12h PEK
                  </span>
                </div>
              </div>

              {/* Flight legs */}
              <div className="space-y-4">
                {FLIGHTS_SCHEDULE.slice(2, 4).map((leg) => (
                  <div key={leg.id} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>{leg.flightNumber}</span>
                      <span>{leg.departureDate}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xl font-black font-mono text-white">
                          {leg.departureAirportCode}
                        </div>
                        <div className="text-xs text-slate-400">{leg.departureAirport}</div>
                        <div className="text-sm font-bold text-amber-400 mt-1 font-mono">
                          {leg.departureTime}
                        </div>
                        <div className="text-[11px] text-slate-500">Terminal {leg.departureTerminal}</div>
                      </div>

                      <div className="flex flex-col items-center px-4">
                        <span className="text-[10px] text-slate-500 font-mono mb-1">{leg.duration}</span>
                        <div className="w-24 sm:w-32 h-[2px] bg-slate-700 relative flex items-center justify-center">
                          <Plane className="w-3.5 h-3.5 text-amber-400 bg-slate-950 px-0.5" />
                        </div>
                        {leg.layoverNotice && (
                          <span className="text-[10px] text-amber-300 mt-1 font-medium text-center">
                            {leg.layoverNotice}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-xl font-black font-mono text-white">
                          {leg.arrivalAirportCode}
                        </div>
                        <div className="text-xs text-slate-400">{leg.arrivalAirport}</div>
                        <div className="text-sm font-bold text-amber-400 mt-1 font-mono">
                          {leg.arrivalTime}
                        </div>
                        <div className="text-[11px] text-slate-500">Terminal {leg.arrivalTerminal}</div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Luggage className="w-3.5 h-3.5 text-slate-400" />
                        {leg.baggageInfo}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Return rules box */}
              <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 space-y-1">
                <div className="font-semibold text-amber-300">⚠️ Regola d'oro Rientro a Pechino:</div>
                <p>• Partenza da Qianmen centro ore 21:15 TASSATIVO.</p>
                <p>• Arrivo al T3 entro le 22:45 per il decollo alle 02:15 per Milano Malpensa.</p>
              </div>
            </div>
          </div>

          {/* Pietro Early Departure Card - 8 March */}
          <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm">
                  8 MAR
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                      Rientro Anticipato di Pietro a Milano
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/40">
                      6 Notti (2-7 Mar)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Partenza da Seul (Incheon o Gimpo in base al biglietto acquistato) ➔ Milano Malpensa
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-300 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800 font-mono">
                Quota affitto Pietro: <strong className="text-purple-400">37 - 66 €</strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  Check-out & Partenza per Aeroporto
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Sveglia la mattina presto e colazione insieme. Lasciare l'alloggio con circa <strong>4 - 4,5 ore di anticipo</strong> rispetto all'orario del volo per avere ampio margine con i trasporti verso Incheon o Gimpo.
                </p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  Saluto alla Stazione
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Gli altri amici accompagnano Pietro alla stazione più vicina da cui parte per l'aeroporto (es. fermata AREX di Hongdae, Seoul Station o fermata bus) e lo salutano lì, rientrando poi con calma.
                </p>
              </div>

              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                <div className="font-bold text-purple-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  Gestione Alloggio & Chiavi
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Avvisare formalmente l'host Enko Stay che da domenica 8 marzo l'appartamento sarà occupato solo da 3 persone. Verificare che Pietro non lasci oggetti e che le chiavi/codici restino al gruppo.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Baggage & General Flight Rules */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
              <Luggage className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-white">Bagaglio in Stiva: 23 kg</h4>
                <p className="text-slate-400">Pesare le valigie il 18 marzo. Superare i 23 kg comporta tariffe extra salate.</p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-white">Power Bank: Marchio 3C</h4>
                <p className="text-slate-400">In Cina e in aereo sono severissimi: power bank solo nello zaino a mano e rigorosamente marcati 3C.</p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
              <Clock className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h4 className="font-bold text-white">Fuso Orario</h4>
                <p className="text-slate-400">Seul: UTC+9 (+8h rispetto a Milano). Pechino: UTC+8 (+7h). All'atterraggio a Pechino spostare 1 ora indietro.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Deep Guide for Beijing 240h Transit */}
      {activeTab === 'beijing_guide' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header intro */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇨🇳</span>
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
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
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
                  <Wifi className="w-3.5 h-3.5 text-cyan-400" />
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
                <span className="font-bold text-slate-300">🛡️ Piano di Riserva:</span>
                <p>Se il permesso 240h non viene concesso per code o restrizioni doganali: si rimane nella zona transiti internazionali. Air China offre un hotel gratuito per scali lunghi (da prenotare almeno 24h prima se idonei).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Malpensa Meeting 1 March */}
      {activeTab === 'malpensa' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
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
