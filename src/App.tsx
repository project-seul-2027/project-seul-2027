/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import HeroVideo, { HeroVideoToggle, useHeroAnimation } from './components/HeroVideo';
import { BrandIcon } from './components/BrandIcon';
import { TRIP_META } from './data/tripData';
import { OFFICIAL_METRO_SOURCES } from './data/seoulMetroOfficialData';
import { ItineraryView } from './components/ItineraryView';
import { InteractiveMap } from './components/InteractiveMap';
import { AccommodationsView } from './components/AccommodationsView';
import { FlightsAndLayoverView } from './components/FlightsAndLayoverView';
import { BudgetTrackerView } from './components/BudgetTrackerView';
import { ExpensesView } from './components/ExpensesView';
import { PracticalGuideView } from './components/PracticalGuideView';
import { PdfViewerModal } from './components/PdfViewerModal';
import { hasResumeFlag } from './services/pendingCamera';
import { GroupView } from './components/GroupView';
import { WeatherView } from './components/WeatherView';
import { ChangelogView } from './components/ChangelogView';
import { APP_VERSION } from './data/changelog';
import { WorldClockBar } from './components/WorldClockBar';
import { SharedGalleryView } from './components/SharedGalleryView';
import { PackingListView } from './components/PackingListView';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { useAuth } from './auth/AuthContext';
import { useInstallPrompt, useMediaQuery, useUpdateAvailable, BUILD_ID } from './pwa';
import { useSyncPushRegistration } from './notifications';
import { PushToggle } from './components/PushToggle';
import { 
  Clock, Sparkles, Download, Home, Users, ChevronDown, CheckCircle, LogOut, Loader2, UserCog, CloudSun, Camera,
  CalendarDays, Map, Plane, Coins, BookOpen, FileText, Luggage, LayoutGrid, X, Smartphone, Share, SquarePlus, Wallet, History
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

type Tab = 'itinerary' | 'accommodations' | 'map' | 'weather' | 'gallery' | 'packing' | 'expenses' | 'flights' | 'budget' | 'guide' | 'pdf' | 'group' | 'changelog';

const ALL_TABS: Tab[] = ['itinerary', 'accommodations', 'map', 'weather', 'gallery', 'packing', 'expenses', 'flights', 'budget', 'guide', 'pdf', 'group', 'changelog'];

/** Schede per la navigazione da telefono: le prime 4 nella barra in basso, le altre in "Altro". */
const MOBILE_TABS: { id: Tab; label: string; icon: React.ElementType; active: string; tint: string }[] = [
  { id: 'itinerary', label: 'Itinerario', icon: CalendarDays, active: 'text-cyan-400', tint: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' },
  { id: 'map', label: 'Mappa', icon: Map, active: 'text-cyan-400', tint: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' },
  { id: 'gallery', label: 'Galleria', icon: Camera, active: 'text-pink-400', tint: 'bg-pink-500/15 border-pink-500/40 text-pink-300' },
  { id: 'packing', label: 'Valigia', icon: Luggage, active: 'text-teal-400', tint: 'bg-teal-500/15 border-teal-500/40 text-teal-300' },
  { id: 'expenses', label: 'Spese', icon: Wallet, active: 'text-emerald-400', tint: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  { id: 'accommodations', label: '4 Alloggi', icon: Home, active: 'text-blue-400', tint: 'bg-blue-500/15 border-blue-500/40 text-blue-300' },
  { id: 'weather', label: 'Meteo', icon: CloudSun, active: 'text-amber-400', tint: 'bg-amber-500/15 border-amber-500/40 text-amber-300' },
  { id: 'flights', label: 'Voli & Scalo', icon: Plane, active: 'text-sky-400', tint: 'bg-sky-500/15 border-sky-500/40 text-sky-300' },
  { id: 'budget', label: 'Preventivo', icon: Coins, active: 'text-emerald-400', tint: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' },
  { id: 'guide', label: 'Guida', icon: BookOpen, active: 'text-indigo-400', tint: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300' },
  { id: 'pdf', label: 'PDF', icon: FileText, active: 'text-rose-400', tint: 'bg-rose-500/15 border-rose-500/40 text-rose-300' },
  { id: 'group', label: 'Partecipanti', icon: Users, active: 'text-purple-400', tint: 'bg-purple-500/15 border-purple-500/40 text-purple-300' },
  { id: 'changelog', label: 'Changelog', icon: History, active: 'text-cyan-400', tint: 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300' }
];
const PRIMARY_MOBILE_TABS = MOBILE_TABS.slice(0, 4);
const MORE_MOBILE_TABS = MOBILE_TABS.slice(4);

/** Scheda iniziale dall'indirizzo (?tab=map), usata anche dalle scorciatoie dell'app installata. */
function initialTab(): Tab {
  if (typeof window === 'undefined') return 'itinerary';
  const fromUrl = new URLSearchParams(window.location.search).get('tab');
  if (fromUrl && (ALL_TABS as string[]).includes(fromUrl)) return fromUrl as Tab;
  // Ritorno dall'app Fotocamera: riapri la galleria con la foto da confermare
  if (hasResumeFlag()) return 'gallery';
  return 'itinerary';
}

function TripPortal() {
  const { user, group, signOut } = useAuth();
  const currentUser = user!;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const heroAnim = useHeroAnimation();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isInstallHelpOpen, setIsInstallHelpOpen] = useState(false);
  const install = useInstallPrompt();
  const { updateAvailable, newVersion, applyUpdate } = useUpdateAvailable();
  useSyncPushRegistration(currentUser.id);
  const [installBannerHidden, setInstallBannerHidden] = useState(() => {
    try {
      return localStorage.getItem('seoul2027_install_banner_hidden') === '1';
    } catch {
      return false;
    }
  });
  const stickyRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // Porta in vista l'inizio del contenuto della scheda (sotto l'intestazione fissa)
  const scrollToContent = () => {
    const main = mainRef.current;
    if (!main) return;
    const offset = (stickyRef.current?.offsetHeight ?? 0) + 8;
    const top = main.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  };

  // Navigazione da telefono: cambia scheda e riparte dall'alto, come in un'app
  const goToTab = (tab: Tab) => {
    setIsMoreOpen(false);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleInstall = async () => {
    if (install.canPrompt) await install.promptInstall();
    else setIsInstallHelpOpen(true);
  };

  const hideInstallBanner = () => {
    setInstallBannerHidden(true);
    try {
      localStorage.setItem('seoul2027_install_banner_hidden', '1');
    } catch {
      // archiviazione non disponibile: il banner tornerà al prossimo avvio
    }
  };

  // Chiude il menu "Altro" con Esc
  useEffect(() => {
    if (!isMoreOpen && !isInstallHelpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMoreOpen(false);
        setIsInstallHelpOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMoreOpen, isInstallHelpOpen]);
  const [targetLocationId, setTargetLocationId] = useState<string | null>(null);
  const [targetDayFilter, setTargetDayFilter] = useState<number | null>(null);
  // Giorno dell'itinerario da aprire (es. dal pulsante "Itinerario" della galleria)
  const [focusItineraryDay, setFocusItineraryDay] = useState<{ id: number; nonce: number } | null>(null);

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
    requestAnimationFrame(scrollToContent);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Sticky Global Top Container con Header e Orologio Mondiale Live */}
      <div
        ref={stickyRef}
        data-app-sticky
        className={`sticky top-0 z-50 bg-[#090d16]/95 backdrop-blur-md shadow-lg shadow-black/20 pt-[env(safe-area-inset-top)] ${
          // Mappa su telefono: via la barra in alto (resta solo l'area sicura sotto l'orologio) per dare spazio alla mappa
          activeTab === 'map' ? 'max-lg:shadow-none max-lg:[&>*]:hidden' : ''
        }`}
      >
        {/* Top Bar */}
        <header className="border-b border-slate-800/80 px-4 sm:px-8 py-2.5 lg:py-3 flex items-center justify-between gap-4 2xl:gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
          onClick={() => { setActiveTab('itinerary'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-2.5 text-left group shrink-0"
        >
          <BrandIcon className="w-10 h-10" />
          <div className="whitespace-nowrap">
            <span className="font-display font-extrabold text-base tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              SEUL 2027
            </span>
            <span className="hidden sm:max-[1839px]:inline-block text-[11px] text-slate-400 ml-2 font-mono">
              4 Amici · Pietro (6 notti) + 3 (17 notti)
            </span>
          </div>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden min-[1840px]:flex items-center gap-3.5 text-xs font-semibold text-slate-300">
          <button
            onClick={() => setActiveTab('itinerary')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'itinerary' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Itinerario</span>
          </button>
          <button
            onClick={() => setActiveTab('accommodations')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'accommodations' ? 'text-blue-400 border-b-2 border-blue-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Home className="w-3.5 h-3.5 text-blue-400" />
            <span>4 Alloggi</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'map' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5' : ''
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>Mappa</span>
          </button>
          <button
            onClick={() => setActiveTab('weather')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'weather' ? 'text-amber-400 border-b-2 border-amber-400 pb-0.5 font-bold' : ''
            }`}
          >
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span>Meteo</span>
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'gallery' ? 'text-pink-400 border-b-2 border-pink-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-pink-400" />
            <span>Galleria</span>
          </button>
          <button
            onClick={() => setActiveTab('packing')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'packing' ? 'text-teal-400 border-b-2 border-teal-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Luggage className="w-3.5 h-3.5 text-teal-400" />
            <span>Valigia</span>
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'expenses' ? 'text-emerald-400 border-b-2 border-emerald-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Spese</span>
          </button>
          <button
            onClick={() => setActiveTab('flights')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'flights' ? 'text-sky-400 border-b-2 border-sky-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Plane className="w-3.5 h-3.5 text-sky-400" />
            <span>Voli & Scalo</span>
          </button>
          <button
            onClick={() => setActiveTab('budget')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'budget' ? 'text-emerald-400 border-b-2 border-emerald-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-emerald-400" />
            <span>Preventivo</span>
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'guide' ? 'text-indigo-400 border-b-2 border-indigo-400 pb-0.5 font-bold' : ''
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>Guida</span>
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'pdf' ? 'text-rose-400 border-b-2 border-rose-400 pb-0.5 font-bold' : ''
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => setActiveTab('group')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'group' ? 'text-purple-400 border-b-2 border-purple-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>Partecipanti</span>
          </button>
          <button
            onClick={() => setActiveTab('changelog')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'changelog' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5 font-bold' : ''
            }`}
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span>Novità</span>
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
                <PushToggle variant="menu" />
                {!install.standalone && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      handleInstall();
                    }}
                    className="w-full text-left p-2 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Installa l'app sul telefono
                  </button>
                )}
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

      {/* Barra Orologio Mondiale Live (Italia, Seul, Pechino): fissa su computer */}
      {isDesktop && <WorldClockBar />}
    </div>

    {/* Su telefono gli orologi scorrono via con la pagina, così resta più spazio per i contenuti */}
    {!isDesktop && <WorldClockBar />}

    {/* Mobile Tab Navigation Bar */}
      <div className="hidden lg:max-[1839.9px]:flex bg-slate-900 border-b border-slate-800 px-3 py-2 items-center overflow-x-auto gap-2 text-xs scrollbar-none">
        <button
          onClick={() => setActiveTab('itinerary')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'itinerary' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Itinerario</span>
        </button>
        <button
          onClick={() => setActiveTab('accommodations')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'accommodations' ? 'bg-blue-600 text-white font-bold' : 'text-blue-300 bg-blue-950/30'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>4 Alloggi</span>
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'map' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Map className="w-3.5 h-3.5" />
          <span>Mappa</span>
        </button>
        <button
          onClick={() => setActiveTab('weather')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'weather' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-amber-300 bg-amber-950/30'
          }`}
        >
          <CloudSun className="w-3.5 h-3.5" />
          <span>Meteo</span>
        </button>
        <button
          onClick={() => setActiveTab('gallery')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'gallery' ? 'bg-pink-500 text-slate-950 font-bold' : 'text-pink-300 bg-pink-950/30'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Galleria</span>
        </button>
        <button
          onClick={() => setActiveTab('packing')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'packing' ? 'bg-teal-500 text-slate-950 font-bold' : 'text-teal-300 bg-teal-950/30'
          }`}
        >
          <Luggage className="w-3.5 h-3.5" />
          <span>Valigia</span>
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'expenses' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-300 bg-emerald-950/30'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Spese</span>
        </button>
        <button
          onClick={() => setActiveTab('flights')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'flights' ? 'bg-sky-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plane className="w-3.5 h-3.5" />
          <span>Voli & Scalo</span>
        </button>
        <button
          onClick={() => setActiveTab('budget')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'budget' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Preventivo</span>
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'guide' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Guida</span>
        </button>
        <button
          onClick={() => setActiveTab('pdf')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'pdf' ? 'bg-rose-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDF</span>
        </button>
        <button
          onClick={() => setActiveTab('group')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'group' ? 'bg-purple-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Partecipanti</span>
        </button>
        <button
          onClick={() => setActiveTab('changelog')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'changelog' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Changelog</span>
        </button>
      </div>

      {/* Hero Atmosphere Section */}
      <div
        className={`relative isolate overflow-hidden border-b border-slate-800/80 bg-slate-950 py-6 sm:py-12 px-4 sm:px-8 ${
          activeTab === 'itinerary' ? '' : 'hidden lg:block'
        }`}
      >
        <HeroVideo enabled={heroAnim.enabled} className="-z-10" />
        <HeroVideoToggle enabled={heroAnim.enabled} onToggle={heroAnim.toggle} />
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl [text-shadow:0_2px_12px_rgba(2,6,23,0.85)]">
              <div className="text-xs font-mono font-semibold text-cyan-300">Corea del Sud</div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold font-display tracking-tight text-white leading-tight">
                Seul 2027 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 [text-shadow:none] drop-shadow-[0_2px_10px_rgba(2,6,23,0.9)]">· Viaggio di Gruppo</span>
              </h1>
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

          {/* Quick Metrics Bar with 4 Accommodations trigger and Weather widget */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
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
            <button
              onClick={() => setActiveTab('weather')}
              className="p-3 bg-amber-950/20 hover:bg-amber-900/30 rounded-xl border border-amber-500/40 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-amber-400 uppercase font-mono">Clima Viaggio (2-19 Mar)</span>
                <CloudSun className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-sm sm:text-base font-bold text-white mt-0.5">Meteo & Previsioni</div>
              <div className="text-[10px] text-amber-300/80 font-mono mt-0.5">Live 7 Giorni + KMA Seul</div>
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

      {/* Avviso di nuova versione: l'app installata non si ricarica da sola */}
      {updateAvailable && (
        <div
          role="status"
          className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[90] mx-auto max-w-md flex items-center gap-3 rounded-2xl border border-emerald-400/50 bg-emerald-950/95 px-4 py-3 shadow-2xl backdrop-blur"
        >
          <div className="flex-1 min-w-0 text-xs text-emerald-100 leading-snug">
            <div className="font-bold text-white">Nuova versione disponibile{newVersion ? ` · v${newVersion}` : ''}</div>
            Aggiorna per vedere le ultime novità.
          </div>
          <button
            type="button"
            onClick={() => void applyUpdate()}
            className="shrink-0 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950"
          >
            Aggiorna
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-5 sm:py-8">
        {/* Invito a installare l'app (solo telefono, finché non è installata o chiusa) */}
        {!isDesktop && !install.standalone && !installBannerHidden && (install.canPrompt || install.needsIosInstructions) && (
          <div className="mb-5 flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-cyan-950/70 to-slate-900 border border-cyan-500/30">
            <img src="./icons/icon-192.png" alt="" className="w-11 h-11 rounded-xl shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">Installa Seul 2027</div>
              <div className="text-[11px] text-slate-400 leading-snug">Icona sulla home, schermo intero e consultabile anche offline.</div>
            </div>
            <button
              type="button"
              onClick={handleInstall}
              className="px-3 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold shrink-0"
            >
              Installa
            </button>
            <button
              type="button"
              onClick={hideInstallBanner}
              aria-label="Chiudi"
              className="p-1.5 -mr-1 rounded-lg text-slate-500 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {activeTab === 'itinerary' && (
          <ItineraryView
            onViewOnMap={handleViewOnMap}
            focusDay={focusItineraryDay}
            onFocusHandled={() => setFocusItineraryDay(null)}
          />
        )}

        {activeTab === 'accommodations' && (
          <AccommodationsView onViewOnMap={handleViewOnMap} />
        )}

        {activeTab === 'map' && (
          <div className="space-y-4">
            {/* Su telefono la mappa occupa tutto lo schermo e il titolo non serve */}
            <div className="hidden lg:flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

        {activeTab === 'weather' && (
          <WeatherView
            onNavigateToItinerary={() => {
              setActiveTab('itinerary');
              requestAnimationFrame(scrollToContent);
            }}
          />
        )}

        {activeTab === 'gallery' && (
          <SharedGalleryView
            onNavigateToMap={handleViewOnMap}
            onNavigateToDay={(dayNumber) => {
              setFocusItineraryDay({ id: dayNumber, nonce: Date.now() });
              setActiveTab('itinerary');
            }}
          />
        )}

        {activeTab === 'packing' && (
          <PackingListView />
        )}

        {activeTab === 'expenses' && <ExpensesView />}

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

        {activeTab === 'changelog' && <ChangelogView />}
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
              <span>·</span>
              <button
                type="button"
                onClick={() => goToTab('changelog')}
                className="font-mono text-slate-500 hover:text-cyan-300 transition-colors"
                title={`Apri il changelog · build ${BUILD_ID}`}
              >
                {APP_VERSION ? `v${APP_VERSION}` : `v. ${BUILD_ID}`}
              </button>
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
                onClick={() => { setActiveTab('weather'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="hover:text-amber-400 transition-colors flex items-center gap-1"
              >
                <CloudSun className="w-3.5 h-3.5 text-amber-400" />
                <span>Meteo Seul</span>
              </button>
              <span>·</span>
              <button
                onClick={() => { setActiveTab('gallery'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="hover:text-pink-400 transition-colors flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5 text-pink-400" />
                <span>Galleria Condivisa</span>
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

      {/* ============================================================ */}
      {/* Barra di navigazione in basso (telefono e tablet piccoli)     */}
      {/* ============================================================ */}
      <nav
        aria-label="Navigazione principale"
        data-app-bottomnav
        className="lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-[#0b111d]/95 backdrop-blur-lg border-t border-slate-800/90 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 max-w-xl mx-auto">
          {PRIMARY_MOBILE_TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id && !isMoreOpen;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => goToTab(t.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 h-16 text-[10.5px] font-semibold transition-colors ${
                  isActive ? t.active : 'text-slate-400 active:text-slate-200'
                }`}
              >
                {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-current" />}
                <Icon className={`w-[22px] h-[22px] ${isActive ? 'scale-110' : ''} transition-transform`} />
                <span>{t.label}</span>
              </button>
            );
          })}
          {(() => {
            const inMore = MORE_MOBILE_TABS.some((t) => t.id === activeTab);
            const current = MORE_MOBILE_TABS.find((t) => t.id === activeTab);
            const isActive = isMoreOpen || inMore;
            const Icon = !isMoreOpen && current ? current.icon : LayoutGrid;
            return (
              <button
                type="button"
                onClick={() => setIsMoreOpen((v) => !v)}
                aria-expanded={isMoreOpen}
                className={`relative flex flex-col items-center justify-center gap-1 h-16 text-[10.5px] font-semibold transition-colors ${
                  isActive ? (current && !isMoreOpen ? current.active : 'text-white') : 'text-slate-400'
                }`}
              >
                {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-current" />}
                <Icon className="w-[22px] h-[22px]" />
                <span className="max-w-[70px] truncate">{!isMoreOpen && current ? current.label : 'Altro'}</span>
              </button>
            );
          })()}
        </div>
      </nav>

      {/* Foglio "Altro": tutte le altre sezioni */}
      {isMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-[55]" role="dialog" aria-modal="true" aria-label="Altre sezioni">
          <button
            type="button"
            aria-label="Chiudi"
            onClick={() => setIsMoreOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-slate-900 border-t border-slate-700/80 shadow-2xl pb-[calc(4.75rem+env(safe-area-inset-bottom))] animate-sheet-up">
            <div className="mx-auto mt-2.5 mb-3 h-1 w-10 rounded-full bg-slate-700" />
            <div className="px-4 pb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-white font-display">Tutte le sezioni</span>
              <span className="text-[11px] text-slate-500 font-mono">Seul 2027</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5 px-4">
              {MORE_MOBILE_TABS.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => goToTab(t.id)}
                    className={`flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-2xl border text-xs font-semibold transition-colors ${
                      isActive ? t.tint : 'bg-slate-950/60 border-slate-800 text-slate-300 active:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? '' : t.active}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2.5 px-4 mt-3">
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  setIsProfileOpen(true);
                }}
                className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-xs font-semibold text-slate-300"
              >
                <UserCog className="w-4 h-4 text-cyan-400" />
                Il mio profilo
              </button>
              {!install.standalone ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    handleInstall();
                  }}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 text-xs font-semibold text-cyan-300"
                >
                  <Smartphone className="w-4 h-4" />
                  Installa l'app
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    signOut();
                  }}
                  className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs font-semibold text-red-300"
                >
                  <LogOut className="w-4 h-4" />
                  Esci
                </button>
              )}
            </div>
            <PushToggle variant="sheet" />
          </div>
        </div>
      )}

      {/* Istruzioni di installazione (iPhone/iPad, o browser senza installazione automatica) */}
      {isInstallHelpOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Installa l'app">
          <button
            type="button"
            aria-label="Chiudi"
            onClick={() => setIsInstallHelpOpen(false)}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <img src="./icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl" />
              <div className="flex-1">
                <div className="font-bold text-white">Installa Seul 2027</div>
                <div className="text-xs text-slate-400">Si apre a schermo intero come un'app, anche senza rete.</div>
              </div>
              <button type="button" onClick={() => setIsInstallHelpOpen(false)} aria-label="Chiudi" className="p-1.5 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {install.needsIosInstructions ? (
              <ol className="space-y-3 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <span>
                    Apri il sito in <strong>Safari</strong> (da Chrome su iPhone non si può installare).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <span className="flex flex-wrap items-center gap-1">
                    Tocca <Share className="w-4 h-4 text-sky-400 inline" /> <strong>Condividi</strong> nella barra in basso.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <span className="flex flex-wrap items-center gap-1">
                    Scegli <SquarePlus className="w-4 h-4 text-sky-400 inline" /> <strong>Aggiungi alla schermata Home</strong>, poi <strong>Aggiungi</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-slate-200">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0">1</span>
                  <span>
                    Su Android apri il sito con <strong>Chrome</strong>, tocca il menu <strong>⋮</strong> in alto a destra.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0">2</span>
                  <span>
                    Scegli <strong>Installa app</strong> (o <strong>Aggiungi a schermata Home</strong>).
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0">3</span>
                  <span>Al primo avvio accedi di nuovo con Google: l'app installata ha un accesso suo.</span>
                </li>
              </ol>
            )}
            <button
              type="button"
              onClick={() => setIsInstallHelpOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
