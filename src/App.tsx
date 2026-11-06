/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { pageFromUrl, rememberPage, takeRememberedPage, writePageToUrl } from './pageAddress';
import { useHeroAnimation } from './components/HeroVideo';
import { DesktopPageHero } from './components/desktop/DesktopPageHero';
import { BrandIcon } from './components/BrandIcon';
import { TRIP_META } from './data/tripData';
import { OFFICIAL_METRO_SOURCES } from './data/seoulMetroOfficialData';
import { ItineraryView } from './components/ItineraryView';
import { DesktopItinerary } from './components/desktop/DesktopItinerary';
import { InteractiveMap } from './components/InteractiveMap';
import { AccommodationsView } from './components/AccommodationsView';
import { FlightsAndLayoverView } from './components/FlightsAndLayoverView';
import { BudgetTrackerView } from './components/BudgetTrackerView';
import { ExpensesView } from './components/ExpensesView';
import { PracticalGuideView } from './components/PracticalGuideView';
import { PdfViewerModal } from './components/PdfViewerModal';
import { hasResumeFlag } from './services/pendingCamera';
import { hasDraftFlag } from './wallet/walletStore';
import { GroupView } from './components/GroupView';
import { WeatherView } from './components/WeatherView';
import { TodayView } from './components/TodayView';
import { DesktopCover } from './components/desktop/DesktopCover';
import { DesktopSidebar } from './components/desktop/DesktopSidebar';
import { WalletView } from './components/WalletView';
import { GroupLiveEngine } from './components/group/GroupLive';
import { ShowKoreanView } from './components/ShowKoreanView';
import { PlacesView } from './components/PlacesView';
import { SosView } from './components/SosView';
import { NavEditor } from './components/NavEditor';
import { NotificationBell, TripNotifierEngine } from './components/NotificationCenter';
import { useNavPrefs } from './utils/navPrefs';
import { ChangelogView } from './components/ChangelogView';
import { APP_VERSION } from './data/changelog';
import { SharedGalleryView } from './components/SharedGalleryView';
import { PackingListView } from './components/PackingListView';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { LoginScreen } from './components/auth/LoginScreen';
import { OnboardingScreen } from './components/auth/OnboardingScreen';
import { useAuth } from './auth/AuthContext';
import { useInstallPrompt, useMediaQuery, useUpdateAvailable, BUILD_ID } from './pwa';
import { useSyncPushRegistration } from './notifications';
import { PushToggle } from './components/PushToggle';
import { MobileBottomNav, MoreSheet, QuickActionsSheet, useBackToClose, type QuickAction } from './components/mobile/MobileShell';
import { SECTIONS, sectionById } from './components/mobile/sections';
import { requestIntent } from './utils/quickIntent';
import { 
  Sparkles, Download, Home, Users, ChevronDown, CheckCircle, LogOut, Loader2, UserCog, CloudSun, Camera,
  CalendarDays, Map, Plane, Coins, BookOpen, FileText, Luggage, X, Smartphone, Share, SquarePlus, Wallet, History, Compass, Languages, WalletCards, Bookmark, ShieldAlert
} from 'lucide-react';

/**
 * Il sito è accessibile solo dopo l'accesso con Google (Firebase) e il completamento del profilo.
 */
export default function App() {
  const { status } = useAuth();
  // Login richiesto: ricorda la pagina del link, così si riapre dopo l'accesso
  useEffect(() => {
    if (status === 'signedOut') {
      const requested = pageFromUrl(window.location.search);
      if (requested) rememberPage(requested);
    }
  }, [status]);

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

type Tab = 'cover' | 'today' | 'wallet' | 'show' | 'places' | 'sos' | 'itinerary' | 'accommodations' | 'map' | 'weather' | 'gallery' | 'packing' | 'expenses' | 'flights' | 'budget' | 'guide' | 'pdf' | 'group' | 'changelog';

/** Tipo di animazione d'ingresso della pagina (vedi index.css, classi page-anim-*). */
type PageAnimKind = 'none' | 'rise' | 'slide-left' | 'slide-right' | 'fade';
const PAGE_ANIM_CLASS: Record<PageAnimKind, string> = {
  none: '',
  rise: 'page-anim-rise',
  'slide-left': 'page-anim-slide-left',
  'slide-right': 'page-anim-slide-right',
  fade: 'page-anim-fade',
};

/**
 * Sceglie l'animazione in base a come si passa da una pagina all'altra:
 * dalla copertina (o da Oggi sul telefono) la pagina sale; tra sezioni dello stesso gruppo scorre
 * nella direzione della barra; altrove sfuma.
 */
function pageTransition(from: Tab, to: Tab, desktop: boolean): PageAnimKind {
  const isHome = (t: Tab) => t === 'cover' || (t === 'today' && !desktop);
  if (isHome(from) && !isHome(to)) return 'rise';
  const a = sectionById(from);
  const b = sectionById(to);
  if (a && b && a.group && a.group === b.group) {
    return SECTIONS.indexOf(b) > SECTIONS.indexOf(a) ? 'slide-right' : 'slide-left';
  }
  return 'fade';
}

const ALL_TABS: Tab[] = ['today', 'wallet', 'show', 'places', 'sos', 'itinerary', 'accommodations', 'map', 'weather', 'gallery', 'packing', 'expenses', 'flights', 'budget', 'guide', 'pdf', 'group', 'changelog'];

/** Scheda iniziale dall'indirizzo (?tab=map), usata anche dalle scorciatoie dell'app installata. */
function initialTab(): Tab {
  if (typeof window === 'undefined') return 'itinerary';
  const fromUrl = pageFromUrl(window.location.search);
  if (fromUrl && (ALL_TABS as string[]).includes(fromUrl)) return fromUrl as Tab;
  // Ritorno dal login senza indirizzo: riapri la pagina richiesta prima dell'accesso
  const remembered = takeRememberedPage();
  if (!fromUrl && remembered && (ALL_TABS as string[]).includes(remembered)) return remembered as Tab;
  // Condivisione dal telefono (Android): un link o un testo diventa un nuovo luogo
  const sp = new URLSearchParams(window.location.search);
  if (!fromUrl && (sp.has('url') || sp.has('text') || sp.has('title'))) return 'places';
  // Ritorno dall'app Fotocamera: riapri la galleria con la foto da confermare
  if (hasResumeFlag()) return 'gallery';
  // Ritorno dalla galleria o dalla fotocamera mentre si compilava una scheda del Wallet
  if (hasDraftFlag()) return 'wallet';
  // Durante il viaggio (o con ?sim=) si apre direttamente "Oggi"
  const params = new URLSearchParams(window.location.search);
  const t = Date.now();
  const inTripWindow = t >= Date.parse('2027-02-28T00:00:00+01:00') && t <= Date.parse('2027-03-21T00:00:00+01:00');
  // Telefono: "Oggi" è la schermata di partenza anche prima del viaggio (conto alla rovescia)
  const isPhone = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1023.98px)').matches;
  // Desktop: si apre la copertina; telefono: Oggi
  return params.has('sim') || inTripWindow || isPhone ? 'today' : 'cover';
}

/** Durante il viaggio l'invito a installare non compare: non è mai prioritario. */
function inTripWindow(): boolean {
  const t = Date.now();
  return t >= Date.parse('2027-02-28T00:00:00+01:00') && t <= Date.parse('2027-03-21T00:00:00+01:00');
}

function TripPortal() {
  const { user, group, signOut } = useAuth();
  const currentUser = user!;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const heroAnim = useHeroAnimation();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  // Indirizzo statico: la URL segue la pagina aperta (solo desktop nel browser)
  useEffect(() => { writePageToUrl(activeTab); }, [activeTab]);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // Animazione della pagina: si ricalcola quando cambia la scheda (stato derivato, senza effetti)
  const [pageAnim, setPageAnim] = useState<{ tab: Tab; kind: PageAnimKind }>({ tab: activeTab, kind: 'none' });
  if (pageAnim.tab !== activeTab) {
    setPageAnim({ tab: activeTab, kind: pageTransition(pageAnim.tab, activeTab, isDesktop) });
  }
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isNavEditorOpen, setIsNavEditorOpen] = useState(false);
  const nav = useNavPrefs(SECTIONS.map((t) => t.id));
  const [isActionsOpen, setIsActionsOpen] = useState(false);
  // Un solo foglio alla volta; il tasto "indietro" lo chiude
  useBackToClose(isMoreOpen || isActionsOpen, () => {
    setIsMoreOpen(false);
    setIsActionsOpen(false);
  });
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
    setIsActionsOpen(false);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleInstall = async () => {
    if (install.canPrompt) await install.promptInstall();
    else setIsInstallHelpOpen(true);
  };

  // Pulsante + (telefono): ogni azione porta alla sezione giusta e apre subito il punto utile
  const handleQuickAction = (a: QuickAction) => {
    const target: Record<QuickAction, Tab> = {
      expense: 'expenses', photo: 'gallery', place: 'places', meetup: 'group', translate: 'show', wallet: 'wallet', lost: 'group', sos: 'sos'
    };
    goToTab(target[a]);
    if (a !== 'wallet' && a !== 'sos') requestIntent(a);
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
  // Richiesta di percorso dalla scheda "Oggi": la mappa si apre già in modalità percorso
  const [routeRequest, setRouteRequest] = useState<{ destinationId: string; nonce: number } | null>(null);
  // Giorno dell'itinerario da aprire (es. dal pulsante "Itinerario" della galleria)
  const [focusItineraryDay, setFocusItineraryDay] = useState<{ id: number; nonce: number } | null>(null);

  const handleRouteFromToday = (destinationId: string) => {
    setRouteRequest({ destinationId, nonce: Date.now() });
    setTargetLocationId(destinationId);
    setTargetDayFilter(null);
    setIsMoreOpen(false);
    setActiveTab('map');
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

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
    <div className="min-h-screen bg-[#090d16] lg:bg-[#080D18] lg:pl-[232px] text-slate-100 flex flex-col font-sans pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* Desktop: barra laterale al posto di quella in alto */}
      <DesktopSidebar
        activeTab={activeTab}
        onGo={(tab) => { setActiveTab(tab as Tab); window.scrollTo({ top: 0, behavior: 'auto' }); }}
        onHome={() => { setActiveTab('cover'); window.scrollTo({ top: 0, behavior: 'auto' }); }}
        user={currentUser}
        groupCount={group.length}
        pdfPath={TRIP_META.pdfPath}
        showInstall={!install.standalone}
        onInstall={handleInstall}
        onProfile={() => setIsProfileOpen(true)}
        onSignOut={signOut}
      />
      {/* Sticky Global Top Container con Header e Orologio Mondiale Live */}
      <div
        ref={stickyRef}
        data-app-sticky
        className={`sticky top-0 z-50 lg:hidden bg-[#090d16]/95 backdrop-blur-md shadow-lg shadow-black/20 pt-[env(safe-area-inset-top)] ${
          // Mappa su telefono: via la barra in alto (resta solo l'area sicura sotto l'orologio) per dare spazio alla mappa
          activeTab === 'map' ? 'max-lg:shadow-none max-lg:[&>*]:hidden' : ''
        }`}
      >
        {/* Top Bar */}
        <header className="border-b border-slate-800/80 px-4 sm:px-8 py-2.5 lg:py-3 flex items-center justify-between gap-4 2xl:gap-6">
          {/* Zone 1: Brand Wordmark */}
          <button
          onClick={() => { setActiveTab(isDesktop ? 'cover' : 'today'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          className="flex items-center gap-2.5 text-left group shrink-0"
          aria-label={isDesktop ? undefined : `${sectionById(activeTab)?.title ?? 'Seul 2027'}: torna a Oggi`}
        >
          <BrandIcon className="w-8 h-8 lg:w-10 lg:h-10" />
          <div className="whitespace-nowrap">
            <span className="hidden lg:inline font-display font-extrabold text-base tracking-tight text-white group-hover:text-cyan-400 transition-colors">
              SEUL 2027
            </span>
            {/* Telefono: titolo della sezione aperta */}
            <span className="lg:hidden block leading-tight" data-testid="mobile-title">
              <span className="block font-display font-extrabold text-[19px] tracking-tight text-app-text">{sectionById(activeTab)?.title ?? 'Seul 2027'}</span>
              <span className="block text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-app-muted">Seul 2027</span>
            </span>
          </div>
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden min-[1536px]:flex items-center gap-3 min-[1700px]:gap-3.5 text-xs font-semibold text-slate-300">
          <button
            onClick={() => setActiveTab('today')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'today' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Oggi</span>
          </button>
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
            onClick={() => setActiveTab('wallet')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'wallet' ? 'text-cyan-400 border-b-2 border-cyan-400 pb-0.5 font-bold' : ''
            }`}
          >
            <WalletCards className="w-3.5 h-3.5 text-cyan-400" />
            <span>Wallet</span>
          </button>
          <button
            onClick={() => setActiveTab('places')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'places' ? 'text-violet-400 border-b-2 border-violet-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Bookmark className="w-3.5 h-3.5 text-violet-400" />
            <span>Luoghi</span>
          </button>
          <button
            onClick={() => setActiveTab('sos')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'sos' ? 'text-rose-400 border-b-2 border-rose-400 pb-0.5 font-bold' : ''
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>SOS</span>
          </button>
          <button
            onClick={() => setActiveTab('show')}
            className={`whitespace-nowrap transition-colors hover:text-white flex items-center gap-1.5 ${
              activeTab === 'show' ? 'text-rose-400 border-b-2 border-rose-400 pb-0.5 font-bold' : ''
            }`}
          >
            <Languages className="w-3.5 h-3.5 text-rose-400" />
            <span>In coreano</span>
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
          <NotificationBell />
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
            className="hidden lg:inline-flex p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Scarica PDF Ufficiale Aggiornato"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </header>

    </div>

    {/* Su telefono gli orologi sono una riga dentro "Oggi" (toccandola si aprono i tre fusi) */}

      {/* Fascia video di ogni pagina (solo desktop): sfuma nello sfondo, titolo sempre nella stessa posizione */}
      {isDesktop && activeTab !== 'today' && activeTab !== 'cover' && (
        <DesktopPageHero
          tab={activeTab}
          heroEnabled={heroAnim.enabled}
          onToggleHero={heroAnim.toggle}
          actions={activeTab === 'sos' ? (
            <a href="tel:112" className="inline-flex items-center gap-2 rounded-full bg-[#F87171] px-5 py-3 text-sm font-bold text-[#080D18]" data-testid="sos-hero-call">Chiama 112</a>
          ) : undefined}
        />
      )}

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
      <main ref={mainRef} className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-5 sm:py-8 ${activeTab === 'today' ? 'lg:max-w-none lg:mx-0 lg:p-0' : 'page-skin lg:max-w-none lg:mx-0 lg:px-10 lg:pt-4 lg:pb-12'} ${['group','expenses','gallery','places','wallet','sos','show','guide','pdf','budget','changelog','packing'].includes(activeTab) ? 'desk-flat' : ''}`}>
        {/* Invito a installare l'app (solo telefono, finché non è installata o chiusa) */}
        {!isDesktop && !install.standalone && !installBannerHidden && !updateAvailable && !inTripWindow() && (install.canPrompt || install.needsIosInstructions) && (
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

        {/* Motori senza schermo: restano fuori dal contenitore animato, così non si rimontano al cambio pagina */}
        <GroupLiveEngine />
        <TripNotifierEngine />
        <div key={activeTab} className={PAGE_ANIM_CLASS[pageAnim.kind]}>
        {(activeTab === 'today' || (activeTab === 'cover' && !isDesktop)) && (
          <TodayView
            onRoute={handleRouteFromToday}
            onGoTo={(tab) => goToTab(tab)}
            heroEnabled={heroAnim.enabled}
            onToggleHero={heroAnim.toggle}
          />
        )}
        {activeTab === 'cover' && isDesktop && (
          <DesktopCover
            heroEnabled={heroAnim.enabled}
            onGoTo={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'wallet' && <WalletView />}
        {activeTab === 'show' && <ShowKoreanView />}
        {activeTab === 'places' && <PlacesView onShowMap={() => goToTab('map')} onRoute={handleRouteFromToday} />}
        {activeTab === 'sos' && <SosView />}

        {activeTab === 'itinerary' && (isDesktop ? (
          <DesktopItinerary
            onViewOnMap={handleViewOnMap}
            focusDay={focusItineraryDay}
            onFocusHandled={() => setFocusItineraryDay(null)}
          />
        ) : (
          <ItineraryView
            onViewOnMap={handleViewOnMap}
            focusDay={focusItineraryDay}
            onFocusHandled={() => setFocusItineraryDay(null)}
          />
        ))}

        {activeTab === 'accommodations' && (
          <AccommodationsView onViewOnMap={handleViewOnMap} />
        )}

        {activeTab === 'map' && (
          <div className="space-y-4">
            {/* Su telefono la mappa occupa tutto lo schermo e il titolo non serve */}
            <div className="hidden lg:flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="hidden text-xl font-bold font-display text-white">
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
              routeRequest={routeRequest}
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

        {activeTab === 'group' && <GroupView onRoute={handleRouteFromToday} onShowMap={() => goToTab('map')} />}

        {activeTab === 'changelog' && <ChangelogView />}
        </div>
      </main>

      <GoogleAuthModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      {isNavEditorOpen && <NavEditor tabs={SECTIONS.map((t) => ({ id: t.id, label: t.label, icon: t.icon, active: t.fg }))} current={nav.primaryIds} onSave={nav.save} onClose={() => setIsNavEditorOpen(false)} />}

      {/* Editorial Footer + Fonti Ufficiali Rete Metropolitana */}
      <footer className="max-lg:hidden mt-auto border-t border-slate-800/80 bg-slate-950 py-8 px-4 sm:px-8 text-xs text-slate-500">
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

          <details className="group pt-4 border-t border-slate-900 text-[11px] text-slate-500">
            <summary className="cursor-pointer list-none flex items-center justify-between gap-2 hover:text-slate-300 transition-colors">
              <span>
                Fonti ufficiali dati trasporti e metropolitana di Seul (orari, frequenze, tariffe T-money/Climate Card e tracciati):
              </span>
              <span aria-hidden="true" className="shrink-0 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
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
          </details>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* Telefono e tablet piccoli: barra in basso con +, fogli Altro e Azioni */}
      {/* ============================================================ */}
      {!isDesktop && (
        <>
          <MobileBottomNav
            activeTab={activeTab === 'cover' ? 'today' : activeTab}
            primary={nav.primaryIds as Exclude<Tab, 'cover'>[]}
            sheet={isActionsOpen ? 'actions' : isMoreOpen ? 'more' : 'none'}
            onGo={(id) => goToTab(id)}
            onToggleMore={() => {
              setIsActionsOpen(false);
              setIsMoreOpen((v) => !v);
            }}
            onToggleActions={() => {
              setIsMoreOpen(false);
              setIsActionsOpen((v) => !v);
            }}
          />
          <QuickActionsSheet open={isActionsOpen} onClose={() => setIsActionsOpen(false)} onAction={handleQuickAction} />
          <MoreSheet
            open={isMoreOpen}
            activeTab={activeTab === 'cover' ? 'today' : activeTab}
            onClose={() => setIsMoreOpen(false)}
            onGo={(id) => goToTab(id)}
            onEditBar={() => {
              setIsMoreOpen(false);
              setIsNavEditorOpen(true);
            }}
            onProfile={() => {
              setIsMoreOpen(false);
              setIsProfileOpen(true);
            }}
            canInstall={!install.standalone}
            onInstall={() => {
              setIsMoreOpen(false);
              handleInstall();
            }}
            onSignOut={() => {
              setIsMoreOpen(false);
              signOut();
            }}
            extra={<PushToggle variant="sheet" />}
          />
        </>
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
