import { useEffect, useRef, useState } from 'react';
import { CheckCircle, ChevronDown, Download, LogOut, Smartphone, UserCog, Users } from 'lucide-react';
import { BrandIcon } from '../BrandIcon';
import { NotificationBell } from '../NotificationCenter';
import { PushToggle } from '../PushToggle';

export interface SidebarUser {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  travelerId: string;
}

interface Item {
  id: string;
  label: string;
  dot: string;
}

const GROUPS: { title: string | null; items: Item[] }[] = [
  { title: null, items: [{ id: 'today', label: 'Oggi', dot: '#00C5E8' }] },
  {
    title: 'Viaggio',
    items: [
      { id: 'itinerary', label: 'Itinerario', dot: '#60A5FA' },
      { id: 'accommodations', label: 'Alloggi', dot: '#60A5FA' },
      { id: 'flights', label: 'Voli e scalo', dot: '#818CF8' },
      { id: 'map', label: 'Mappa', dot: '#FB923C' },
      { id: 'weather', label: 'Meteo', dot: '#FBBF24' },
    ],
  },
  {
    title: 'Gruppo',
    items: [
      { id: 'group', label: 'Gruppo adesso', dot: '#2DD4BF' },
      { id: 'expenses', label: 'Spese', dot: '#34D399' },
      { id: 'gallery', label: 'Galleria', dot: '#F472B6' },
      { id: 'places', label: 'Luoghi', dot: '#A78BFA' },
    ],
  },
  {
    title: 'Strumenti',
    items: [
      { id: 'wallet', label: 'Wallet', dot: '#34D399' },
      { id: 'sos', label: 'SOS', dot: '#F87171' },
      { id: 'show', label: 'In coreano', dot: '#FB923C' },
      { id: 'guide', label: 'Guida', dot: '#FB923C' },
      { id: 'pdf', label: 'PDF', dot: '#FB923C' },
    ],
  },
  {
    title: 'Preparazione',
    items: [
      { id: 'packing', label: 'Valigia', dot: '#94A3B8' },
      { id: 'budget', label: 'Preventivo', dot: '#94A3B8' },
      { id: 'changelog', label: 'Novità', dot: '#94A3B8' },
    ],
  },
];

interface DesktopSidebarProps {
  activeTab: string;
  onGo: (tab: string) => void;
  onHome: () => void;
  user: SidebarUser;
  groupCount: number;
  pdfPath: string;
  showInstall: boolean;
  onInstall: () => void;
  onProfile: () => void;
  onSignOut: () => void;
}

/** Barra laterale desktop (da 1024 px): tutte le 18 sezioni in 4 gruppi, come nel mockup. */
export function DesktopSidebar({
  activeTab, onGo, onHome, user, groupCount, pdfPath, showInstall, onInstall, onProfile, onSignOut,
}: DesktopSidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const menuItem = 'w-full text-left p-2 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center gap-1.5';

  return (
    <aside
      data-testid="desktop-sidebar"
      className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-[232px] flex-col gap-2 border-r px-4 py-5"
      style={{ background: '#0B1322', borderColor: '#1E2B40' }}
    >
      <button type="button" onClick={onHome} className="flex items-center gap-3 px-1.5 pb-2 text-left" aria-label="Seul 2027: copertina">
        <BrandIcon className="w-[30px] h-[30px]" />
        <span className="font-display text-[15px] font-extrabold tracking-tight text-[#F7F9FC]">Seul 2027</span>
      </button>

      <nav aria-label="Sezioni" className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
        {GROUPS.map((g, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {g.title && (
              <p className="mb-0.5 ml-2.5 mt-2.5 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#94A3B8' }}>{g.title}</p>
            )}
            {g.items.map((it) => {
              const on = activeTab === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onGo(it.id)}
                  aria-current={on ? 'page' : undefined}
                  data-testid={`side-${it.id}`}
                  className="flex h-8 shrink-0 items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] font-medium transition-colors hover:bg-[#101A2D]"
                  style={on ? { background: '#16233A', color: '#F7F9FC', boxShadow: 'inset 2px 0 0 #00C5E8' } : { color: '#CBD5E1' }}
                >
                  <i className="block h-2 w-2 flex-none rounded-full" style={{ background: it.dot }} />
                  {it.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div ref={menuRef} className="relative flex items-center gap-2 border-t pt-3" style={{ borderColor: '#1E2B40' }}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-[#101A2D]"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold" style={{ background: '#00C5E8', color: '#04202A' }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : (
              <>{user.firstName.slice(0, 1)}{user.lastName.slice(0, 1)}</>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-[#F7F9FC]">{user.displayName}</span>
            <span className="block text-xs" style={{ color: '#94A3B8' }}>{groupCount} viaggiatori</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
        <NotificationBell />

        {menuOpen && (
          <div role="menu" className="absolute bottom-full left-0 z-50 mb-2 w-64 space-y-1 rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs shadow-2xl">
            <div className="mb-1 border-b border-slate-800 pb-2">
              <div className="font-bold text-white">{user.firstName} {user.lastName}</div>
              <div className="truncate font-mono text-[11px] text-slate-400">{user.email}</div>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-cyan-400">
                <CheckCircle className="h-3 w-3" />
                Account Google · Posto {user.travelerId.slice(1)}
              </div>
            </div>
            <button role="menuitem" className={menuItem} onClick={() => { setMenuOpen(false); onProfile(); }}>
              <UserCog className="h-3.5 w-3.5" /> Il mio profilo viaggiatore
            </button>
            <button role="menuitem" className={menuItem} onClick={() => { setMenuOpen(false); onGo('group'); }}>
              <Users className="h-3.5 w-3.5" /> Partecipanti ({groupCount}/4)
            </button>
            <PushToggle variant="menu" />
            <a role="menuitem" href={pdfPath} download="Itinerario_Seul_2027.pdf" className={menuItem} onClick={() => setMenuOpen(false)}>
              <Download className="h-3.5 w-3.5" /> Scarica il PDF dell'itinerario
            </a>
            {showInstall && (
              <button role="menuitem" className={menuItem} onClick={() => { setMenuOpen(false); onInstall(); }}>
                <Smartphone className="h-3.5 w-3.5" /> Installa l'app sul telefono
              </button>
            )}
            <button role="menuitem" className="flex w-full items-center gap-1.5 rounded-lg p-2 text-left text-red-400 hover:bg-red-500/10" onClick={() => { setMenuOpen(false); onSignOut(); }}>
              <LogOut className="h-3.5 w-3.5" /> Esci
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
