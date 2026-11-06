import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, X, LayoutGrid, Search, Wallet, Camera, Bookmark, MapPin, Languages, WalletCards, ShieldAlert, LifeBuoy,
  SlidersHorizontal, UserCog, Smartphone, LogOut, ChevronRight
} from 'lucide-react';
import { SECTIONS, SECTION_GROUPS, searchSections, sectionById, type SectionId, type SectionInfo } from './sections';
import './mobile.css';

/* ------------------------------------------------------------------ */
/* Fogli dal basso: focus intrappolato, Esc, tasto "indietro"          */
/* ------------------------------------------------------------------ */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Comportamento comune dei fogli: il focus resta dentro finché sono aperti e torna
 * all'elemento che li ha aperti; si chiudono con Esc. Il tasto "indietro" è gestito da useBackToClose.
 */
function useSheet(open: boolean, onClose: () => void, ref: React.RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const box = ref.current;
    box?.querySelector<HTMLElement>('[data-autofocus]')?.focus() ?? box?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      const nav = document.querySelector<HTMLElement>('[data-mobile-plus]');
      if (nav && !items.includes(nav)) items.push(nav);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [open, ref]);
}

/* ------------------------------------------------------------------ */
/* Barra in basso: 3 sezioni scelte + pulsante + + Altro               */
/* ------------------------------------------------------------------ */

interface BottomNavProps {
  activeTab: SectionId;
  primary: SectionId[];
  sheet: 'none' | 'more' | 'actions';
  onGo: (id: SectionId) => void;
  onToggleMore: () => void;
  onToggleActions: () => void;
}

export const MobileBottomNav: React.FC<BottomNavProps> = ({ activeTab, primary, sheet, onGo, onToggleMore, onToggleActions }) => {
  const slots = primary.slice(0, 3).map((id) => sectionById(id)!).filter(Boolean);
  const inMore = !slots.some((s) => s.id === activeTab);
  const item = (s: SectionInfo) => {
    const active = activeTab === s.id && sheet === 'none';
    const Icon = s.icon;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onGo(s.id)}
        aria-current={active ? 'page' : undefined}
        data-testid={`mnav-${s.id}`}
        className="ms-tab"
      >
        <Icon strokeWidth={1.6} />
        <span className="max-w-[72px] truncate">{s.label}</span>
      </button>
    );
  };
  const moreActive = sheet === 'more' || (sheet === 'none' && inMore);
  return (
    <nav
      aria-label="Navigazione principale"
      data-app-bottomnav
      className="ms-tabs lg:hidden fixed bottom-0 inset-x-0 z-[60]"
      style={{ height: 'calc(68px + env(safe-area-inset-bottom))', paddingBottom: 'calc(4px + env(safe-area-inset-bottom))' }}
    >
      {slots.slice(0, 2).map(item)}
      <button
        type="button"
        data-mobile-plus
        data-testid="mnav-plus"
        onClick={onToggleActions}
        aria-haspopup="dialog"
        aria-expanded={sheet === 'actions'}
        aria-label={sheet === 'actions' ? 'Chiudi azioni rapide' : 'Azioni rapide: spesa, foto, luogo, ritrovo, traduci, wallet, SOS'}
        className="ms-fab focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
        style={sheet === 'actions' ? { background: 'var(--ms-text)', color: 'var(--ms-bg)' } : undefined}
      >
        {sheet === 'actions' ? <X /> : <Plus />}
      </button>
      {slots.slice(2, 3).map(item)}
      <button
        type="button"
        onClick={onToggleMore}
        aria-haspopup="dialog"
        aria-expanded={sheet === 'more'}
        aria-current={moreActive ? 'page' : undefined}
        data-testid="mnav-more"
        className="ms-tab"
      >
        <LayoutGrid strokeWidth={1.6} />
        <span>Altro</span>
      </button>
    </nav>
  );
};

/* ------------------------------------------------------------------ */
/* Foglio del pulsante +                                               */
/* ------------------------------------------------------------------ */

export type QuickAction = 'expense' | 'photo' | 'place' | 'meetup' | 'translate' | 'wallet' | 'lost' | 'sos';

const ACTIONS: { id: QuickAction; label: string; icon: React.ElementType; fg: string; tile: string }[] = [
  { id: 'expense', label: 'Spesa', icon: Wallet, fg: 'text-fam-money', tile: 'bg-fam-money/15' },
  { id: 'photo', label: 'Foto', icon: Camera, fg: 'text-fam-gallery', tile: 'bg-fam-gallery/15' },
  { id: 'place', label: 'Luogo', icon: Bookmark, fg: 'text-fam-places', tile: 'bg-fam-places/15' },
  { id: 'meetup', label: 'Ritrovo', icon: MapPin, fg: 'text-fam-group', tile: 'bg-fam-group/15' },
  { id: 'translate', label: 'Traduci', icon: Languages, fg: 'text-fam-tools', tile: 'bg-fam-tools/15' },
  { id: 'wallet', label: 'Wallet', icon: WalletCards, fg: 'text-fam-money', tile: 'bg-fam-money/15' }
];

export const QuickActionsSheet: React.FC<{ open: boolean; onClose: () => void; onAction: (a: QuickAction) => void }> = ({ open, onClose, onAction }) => {
  const ref = useRef<HTMLElement>(null);
  useSheet(open, onClose, ref);
  if (!open) return null;
  return (
    <div className="lg:hidden fixed inset-0 z-[55]" data-testid="quick-actions">
      <button type="button" aria-label="Chiudi" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-[rgba(3,6,12,0.72)]" />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="qa-title"
        className="absolute inset-x-0 bottom-0 max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] overflow-y-auto rounded-t-2xl bg-[#0a1119] shadow-[0_-6px_24px_rgba(0,0,0,0.4)] pb-[calc(5rem+env(safe-area-inset-bottom))] short:pb-[calc(4.5rem+env(safe-area-inset-bottom))] animate-sheet-up"
      >
        <div className="mx-auto max-w-xl px-4 pt-2.5 space-y-4 short:max-w-3xl short:space-y-2.5">
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-slate-600" />
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="qa-title" className="font-[Outfit] text-[22px] font-medium text-[#eaf0f6]">Cosa vuoi fare?</h2>
            <span className="text-[13px] text-[#97a5b9]">Foto apre la fotocamera</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5 short:grid-cols-6">
            {ACTIONS.map((a, i) => (
              <button
                key={a.id}
                type="button"
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onAction(a.id)}
                data-testid={`qa-${a.id}`}
                className="min-h-[96px] short:min-h-[76px] short:gap-1.5 rounded-xl bg-[#152231] active:bg-[#1c2d40] flex flex-col items-center justify-center gap-2.5 text-[14px] font-semibold text-[#eaf0f6] focus-visible:outline-2 focus-visible:outline-[#52d9e6]"
              >
                <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${a.tile}`}>
                  <a.icon className={`w-[22px] h-[22px] ${a.fg}`} />
                </span>
                {a.label}
              </button>
            ))}
          </div>
          {/* Coordinamento ed emergenza: separati dalle azioni ordinarie e distinti tra loro */}
          <div className="grid grid-cols-2 gap-2.5 short:pt-0">
            <button
              type="button"
              onClick={() => onAction('lost')}
              data-testid="qa-lost"
              className="min-h-[52px] rounded-xl bg-[#152231] text-[#fca5a5] text-[15px] font-semibold flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-[#52d9e6]"
            >
              <LifeBuoy className="w-[18px] h-[18px]" /> Ho perso il gruppo
            </button>
            <button
              type="button"
              onClick={() => onAction('sos')}
              data-testid="qa-sos"
              className="min-h-[52px] rounded-xl bg-[#dc2626] text-white text-[15px] font-semibold flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]"
            >
              <ShieldAlert className="w-[18px] h-[18px]" strokeWidth={2.4} /> SOS emergenza
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Foglio "Altro": quattro gruppi + ricerca                            */
/* ------------------------------------------------------------------ */

const GROUP_TONE: Record<string, string> = { Viaggio: 'ms-cy', Gruppo: 'ms-pk', Strumenti: 'ms-am', Preparazione: 'ms-vi' };

interface MoreSheetProps {
  open: boolean;
  activeTab: SectionId;
  onClose: () => void;
  onGo: (id: SectionId) => void;
  onEditBar: () => void;
  onProfile: () => void;
  canInstall: boolean;
  onInstall: () => void;
  onSignOut: () => void;
  extra?: React.ReactNode;
}

export const MoreSheet: React.FC<MoreSheetProps> = ({ open, activeTab, onClose, onGo, onEditBar, onProfile, canInstall, onInstall, onSignOut, extra }) => {
  const ref = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  useSheet(open, onClose, ref);
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);
  const results = useMemo(() => searchSections(query), [query]);
  if (!open) return null;

  const row = (s: SectionInfo) => {
    const active = activeTab === s.id;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onGo(s.id)}
        aria-current={active ? 'page' : undefined}
        data-testid={`more-${s.id}`}
        className="ms-li focus-visible:outline-2 focus-visible:outline-app-accent"
        style={active ? { color: 'var(--ms-accent)', fontWeight: 600 } : s.id === 'sos' ? { color: '#fca5a5' } : undefined}
      >
        {s.label}
        <span>
          {active && <b style={{ fontWeight: 600, fontSize: 13, color: 'var(--ms-accent)' }}>Qui</b>}
          <ChevronRight aria-hidden />
        </span>
      </button>
    );
  };

  return (
    <div className="lg:hidden fixed inset-0 z-[55]" data-testid="more-sheet">
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-title"
        className="absolute inset-0 flex flex-col"
        style={{ background: 'var(--ms-bg)', color: 'var(--ms-text)', paddingBottom: 'calc(68px + env(safe-area-inset-bottom))', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <header className="ms-top" style={{ paddingRight: 20 }}>
          <h2 id="more-title" className="ms-title">Altro</h2>
          <button type="button" onClick={onEditBar} data-testid="nav-edit-open" className="ms-link" style={{ padding: 0 }}>
            Modifica barra
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain" style={{ padding: '0 20px' }}>
          <label className="ms-find">
            <Search aria-hidden />
            <span className="sr-only">Cerca una sezione</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca: spese, metro, ambasciata…"
              enterKeyHint="search"
              data-testid="more-search"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Cancella la ricerca" className="ms-ib" style={{ width: 32, height: 32, color: 'var(--ms-mute)' }}>
                <X />
              </button>
            )}
          </label>

          {query.trim() ? (
            <section aria-live="polite" className="ms-grp">
              <p className="ms-mute" style={{ fontSize: 14, fontFamily: 'inherit', fontWeight: 400 }}>
                {results.length === 0 ? 'Nessun risultato' : `${results.length} ${results.length === 1 ? 'sezione' : 'sezioni'}`}
              </p>
              {results.length > 0 ? (
                results.map(row)
              ) : (
                <p className="ms-mute" style={{ fontSize: 15, lineHeight: 1.5, padding: '12px 0' }} data-testid="more-empty">
                  Nessuna sezione per «{query.trim()}». Prova con parole come <b style={{ color: 'var(--ms-text)' }}>metro</b>, <b style={{ color: 'var(--ms-text)' }}>soldi</b>,{' '}
                  <b style={{ color: 'var(--ms-text)' }}>foto</b> o <b style={{ color: 'var(--ms-text)' }}>emergenza</b>.
                </p>
              )}
            </section>
          ) : (
            <>
              {activeTab !== 'today' && (
                <section className="ms-grp">
                  <button type="button" onClick={() => onGo('today')} className="ms-li">
                    Torna a Oggi
                    <span><ChevronRight aria-hidden /></span>
                  </button>
                </section>
              )}
              {SECTION_GROUPS.map((g) => (
                <section key={g} className="ms-grp" aria-labelledby={`grp-${g}`}>
                  <p id={`grp-${g}`} className={GROUP_TONE[g] ?? 'ms-cy'}>{g}</p>
                  {SECTIONS.filter((s) => s.group === g).map(row)}
                </section>
              ))}
            </>
          )}

          <section className="ms-grp" style={{ paddingBottom: 16 }}>
            <p className="ms-vi">Account</p>
            <button type="button" onClick={onProfile} className="ms-li">
              Il mio profilo
              <span><ChevronRight aria-hidden /></span>
            </button>
            {canInstall && (
              <button type="button" onClick={onInstall} className="ms-li">
                Installa l'app
                <span><ChevronRight aria-hidden /></span>
              </button>
            )}
            <button type="button" onClick={onSignOut} className="ms-li" style={{ color: '#fca5a5' }}>
              Esci
              <span><ChevronRight aria-hidden /></span>
            </button>
          </section>
          {extra}
        </div>
      </section>
    </div>
  );
};

/**
 * Finché un foglio è aperto c'è una voce in più nella cronologia: il tasto/gesto "indietro"
 * chiude il foglio invece di uscire dall'app. Passare da un foglio all'altro non aggiunge voci.
 */
export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    let popped = false;
    try {
      window.history.pushState({ ...(window.history.state ?? {}), seulSheet: true }, '');
    } catch {
      /* cronologia non disponibile */
    }
    const onPop = () => {
      popped = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped && window.history.state?.seulSheet) {
        try {
          window.history.back();
        } catch {
          /* niente */
        }
      }
    };
  }, [open]);
}
