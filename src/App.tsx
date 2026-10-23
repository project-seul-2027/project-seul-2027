/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { TRIP_META } from './data/tripData';
import { OFFICIAL_METRO_SOURCES } from './data/seoulMetroOfficialData';
import { ItineraryView } from './components/ItineraryView';
import { InteractiveMap } from './components/InteractiveMap';
import { AccommodationsView } from './components/AccommodationsView';
import { FlightsAndLayoverView } from './components/FlightsAndLayoverView';
import { BudgetTrackerView } from './components/BudgetTrackerView';
import { PracticalGuideView } from './components/PracticalGuideView';
import { PdfViewerModal } from './components/PdfViewerModal';
import { GroupView } from './components/GroupView';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { useAuth } from './auth/AuthContext';
import { 
  Clock, Sparkles, Download, Home, Users, ChevronDown, CheckCircle, LogOut, Loader2, UserCog
} from 'lucide-react';

/**
 * Il sito è accessibile solo dopo l'accesso con Google (Firebase) e il completamento del profilo.
 */
export default function App() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
        Caricamento del viaggio…
      </div>
    );
  }
  if (status === 'signedOut') return <LoginScreen />;
  if (status === 'needsProfile') return <OnboardingScreen />;
  return <TripPortal />;
}

type Tab = 'itinerary' | 'accommodations' | 'map' | 'flights' | 'budget' | 'guide' | 'pdf' | 'group';

function TripPortal() {
  const { user, group, signOut } = useAuth();
  const currentUser = user!;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('itinerary');
  const [targetLocationId, setTargetLocationId] = useState<string | null>(null);
  const [targetDayFilter, setTargetDayFilter] = useState<number | null>(null);

  // Countdown timer to 1 March 2027 10:00:00 CET
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const targetDate = new Date('2027-03-01T10:00:00+01:00').getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handler to jump from itinerary/accommodations to map
  const handleViewOnMap = (locationId: string, dayNumber?: number) => {
    setTargetLocationId(locationId);
    if (dayNumber !== undefined) {
      setTargetDayFilter(dayNumber);
    }
    setActiveTab('map');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[#090d16]/95 border-b border-slate-800/80 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 2xl:gap-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => { setActiveTab('itinerary'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-2.5 text-left group shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20 text-sm">
            KR
          </div>
          <div className="whitespace-nowrap">
            <span className="font-display font-extrabold text-base tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              SEUL 2027
            </span>
            <span className="hidden sm:inline-block xl:hidden 2xl:inline-block text-[11px] text-slate-400 ml-2 font-mono">
              4 Amici · Pietro (6 notti) + 3 (17 notti)
            </span>
          </div>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden xl:flex items-center gap-3.5 2xl:gap-5 text-xs font-semibold text-slate-300">
          <button
            onClick={() => setActiveTab('itinerary')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'itinerary' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            Itinerario Completo
          </button>
          <button
            onClick={() => setActiveTab('accommodations')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1 ${
              activeTab === 'accommodations' ? 'text-blue-400 border-b-2 border-blue-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            <span>4 Alloggi a Confronto</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'map' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            Mappa Interattiva
          </button>
          <button
            onClick={() => setActiveTab('flights')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'flights' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            Voli & Scalo Pechino
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'budget' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            Preventivo (PDF)
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'guide' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            Guida & Checklist
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'pdf' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            PDF Viaggio
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`whitespace-nowrap transition-colors hover:text-white ${
              activeTab === 'group' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            Partecipanti
          </button>
        </nav>

        {/* Zone 3: Group Status & Actions (No login/accounts) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-500/50 transition-all text-xs"
            >
              <div className="w-7 h-7 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center text-[10px] overflow-hidden shrink-0">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <>
                    {currentUser.firstName.slice(0, 1)}
                    {currentUser.lastName.slice(0, 1)}
                  </>
                )}
              </div>
              <span className="hidden sm:block xl:hidden 2xl:block font-bold text-white max-w-[140px] truncate">
                {currentUser.displayName}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 space-y-1 z-50 text-xs"
              >
                <div className="border-b border-slate-800 pb-2 mb-1">
                  <div className="font-bold text-white">
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="text-slate-400 font-mono text-[11px] truncate">{currentUser.email}</div>
                  <div className="text-[10px] text-cyan-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Account Google · Posto {currentUser.travelerId.slice(1)}
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsProfileOpen(true);
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-1.5"
                >
                  <UserCog className="w-3.5 h-3.5" />
                  Il mio profilo viaggiatore
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setActiveTab('group');
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  Partecipanti ({group.length}/4)
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    signOut();
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-red-500/10 text-red-400 flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Esci
                </button>
              </div>
            )}
          </div>
          <a
            href={TRIP_META.pdfPath}
            download="Itinerario_Seul_2027.pdf"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Scarica PDF Ufficiale Aggiornato"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Mobile Tab Navigation Bar */}
      <div className="xl:hidden bg-slate-900 border-b border-slate-800 px-3 py-2 flex items-center overflow-x-auto gap-2 text-xs scrollbar-none">
        <button
          onClick={() => setActiveTab('itinerary')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
            activeTab === 'itinerary' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Itinerario
        </button>
        <button
          onClick={() => setActiveTab('accommodations')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1 ${
            activeTab === 'accommodations' ? 'bg-blue-600 text-white font-bold' : 'text-blue-300 bg-blue-950/30'
          }`}
        >
          <Home className="w-3 h-3" />
          <span>4 Alloggi</span>
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
            activeTab === 'map' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Mappa
        </button>
        <button
          onClick={() => setActiveTab('flights')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
            activeTab === 'flights' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Voli & Scalo
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
            activeTab === 'budget' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Preventivo (PDF)
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
            activeTab === 'guide' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Guida
        </button>
        <button
          onClick={() => setActiveTab('pdf')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
            activeTab === 'pdf' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          PDF
        </button>
        <button
          onClick={() => setActiveTab('group')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
            activeTab === 'group' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400'
          }`}
        >
          Partecipanti
        </button>
      </div>

      {/* Hero Atmosphere Section */}
      <div className="relative border-b border-slate-800/80 bg-gradient-to-b from-slate-900 via-slate-900/60 to-transparent py-8 sm:py-12 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <span className="text-cyan-400">Corea del Sud</span>
                <span aria-hidden="true">·</span>
                <span>2 - 19 Marzo 2027</span>
                <span aria-hidden="true">·</span>
                <span>Pietro (2-8 Mar) & 3 Amici (2-19 Mar)</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display tracking-tight text-white leading-tight">
                Seul 2027 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">· Viaggio di Gruppo</span>
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Itinerario ufficiale aggiornato dal PDF: 4 partecipanti all'inizio con rientro di Pietro l'8 marzo (6 notti, 37-66 €) e permanenza degli altri 3 amici fino al 19 marzo (17 notti, 129-227 €), evento Valorant Masters (3 mar), White Day sul fiume Han, 4 alloggi a confronto, scalo 240h a Pechino e preventivo trasparente.
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-2xl shadow-2xl flex flex-col items-center shrink-0 min-w-[260px]">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Conto alla rovescia Malpensa
              </span>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <div className="font-mono text-xl sm:text-2xl font-bold text-cyan-400">
                    {timeLeft.days}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase">Giorni</div>
                </div>
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <div className="font-mono text-xl sm:text-2xl font-bold text-slate-200">
                    {timeLeft.hours}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase">Ore</div>
                </div>
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <div className="font-mono text-xl sm:text-2xl font-bold text-slate-200">
                    {timeLeft.minutes}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase">Min</div>
                </div>
                <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                  <div className="font-mono text-xl sm:text-2xl font-bold text-amber-400">
                    {timeLeft.seconds}
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase">Sec</div>
                </div>
              </div>
              <span className="text-[10px] text-slate-500 mt-2 font-mono">
                1 marzo ore 10:00 al T1 Air China
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar with 4 Accommodations trigger */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <button
              onClick={() => setActiveTab('accommodations')}
              className="p-3 bg-blue-950/30 hover:bg-blue-900/40 rounded-xl border border-blue-500/40 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-blue-400 uppercase font-mono">Opzioni Dove Dormire</span>
                <Home className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-sm sm:text-base font-bold text-white mt-0.5">4 Alloggi a Confronto</div>
            </button>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Partecipanti</span>
              <div className="text-sm sm:text-base font-bold text-cyan-400 mt-0.5">4 Viaggiatori</div>
              <div className="text-[10px] text-amber-300 font-mono mt-0.5">Pietro (6n) + 3 (17n)</div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Durata Soggiorno</span>
              <div className="text-sm sm:text-base font-bold text-white mt-0.5">17 Notti / 19 Giorni</div>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Evento Principale</span>
              <div className="text-sm sm:text-base font-bold text-red-400 mt-0.5 flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Valorant Masters</span>
                <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded font-mono font-semibold shrink-0">
                  Arena TBD
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        {activeTab === 'itinerary' && (
          <ItineraryView onViewOnMap={handleViewOnMap} />
        )}

        {activeTab === 'accommodations' && (
          <AccommodationsView onViewOnMap={handleViewOnMap} />
        )}

        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold font-display text-white">
                  Mappa Interattiva (Tappe e Alloggi in Italiano)
                </h2>
                <p className="text-xs text-slate-400">
                  Tutti i 4 alloggi a confronto, quartieri di Seul e gite fuori porta. Puoi passare liberamente tra Mappa Dark e Mappa Chiara.
                </p>
              </div>
            </div>

            <InteractiveMap
              selectedLocationId={targetLocationId}
              selectedDayFilter={targetDayFilter}
              onSelectLocation={(loc) => {
                if (loc) setTargetLocationId(loc.id);
              }}
            />
          </div>
        )}

        {activeTab === 'flights' && (
          <FlightsAndLayoverView />
        )}

        {activeTab === 'budget' && (
          <BudgetTrackerView />
        )}

        {activeTab === 'guide' && (
          <PracticalGuideView />
        )}

        {activeTab === 'pdf' && (
          <PdfViewerModal />
        )}

        {activeTab === 'group' && <GroupView />}
      </main>

      <GoogleAuthModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      {/* Editorial Footer + Fonti Ufficiali Rete Metropolitana */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto space-y-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300">Seul 2027</span>
              <span>·</span>
              <span>Viaggio in Corea del Sud per 4 amici (2 - 19 marzo 2027)</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => setActiveTab('accommodations')}
                className="hover:text-blue-400 transition-colors"
              >
                4 Alloggi a Confronto
              </button>
              <span>·</span>
              <button
                onClick={() => setActiveTab('map')}
                className="hover:text-cyan-400 transition-colors"
              >
                Mappa & Calcolo Metro GPS
              </button>
              <span>·</span>
              <button
                onClick={() => setActiveTab('pdf')}
                className="hover:text-cyan-400 transition-colors"
              >
                PDF Aggiornato
              </button>
              <span>·</span>
              <button
                onClick={() => { setActiveTab('guide'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="hover:text-cyan-400 transition-colors"
              >
                Checklist
              </button>
              <span>·</span>
              <button
                onClick={() => { setActiveTab('budget'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="hover:text-cyan-400 transition-colors"
              >
                Preventivo (PDF)
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>
              Fonti ufficiali dati trasporti e metropolitana di Seul (orari, frequenze, tariffe T-money/Climate Card e tracciati):
            </span>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {OFFICIAL_METRO_SOURCES.map((src, idx) => (
                <React.Fragment key={src.id}>
                  {idx > 0 && <span aria-hidden="true">·</span>}
                  <a
                    href={src.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-400 hover:text-cyan-400 underline transition-colors"
                    title={`${src.organizationIt} (${src.organizationKo}) — ${src.roleIt}`}
                  >
                    {src.organizationEn} ({src.organizationKo})
                  </a>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
