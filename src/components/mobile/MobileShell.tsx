import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, X, LayoutGrid, Search, Wallet, Camera, Bookmark, MapPin, Languages, WalletCards, ShieldAlert, LifeBuoy,
  SlidersHorizontal, UserCog, Smartphone, LogOut, ChevronRight
} from 'lucide-react';
import { SECTIONS, SECTION_GROUPS, searchSections, sectionById, type SectionId, type SectionInfo } from './sections';

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
        className={`relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] transition-colors ${active ? 'text-app-accent font-bold' : 'text-app-muted font-semibold active:text-app-text'}`}
      >
        {/* Lo stato attivo non è solo colore: barretta in alto e testo in grassetto */}
        {active && <span aria-hidden className="absolute top-0 h-[3px] w-8 rounded-b-full bg-app-accent" />}
        <Icon className="w-6 h-6" strokeWidth={active ? 2.4 : 2} />
        <span className="max-w-[72px] truncate">{s.label}</span>
      </button>
    );
  };
  const moreActive = sheet === 'more' || (sheet === 'none' && inMore);
  return (
    <nav
      aria-label="Navigazione principale"
      data-app-bottomnav
      className="lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-app-nav/95 backdrop-blur-lg border-t border-app-line pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-5 max-w-xl mx-auto items-center">
        {slots.slice(0, 2).map(item)}
        <div className="flex justify-center">
          <button
            type="button"
            data-mobile-plus
            data-testid="mnav-plus"
            onClick={onToggleActions}
            aria-haspopup="dialog"
            aria-expanded={sheet === 'actions'}
            aria-label={sheet === 'actions' ? 'Chiudi azioni rapide' : 'Azioni rapide: spesa, foto, luogo, ritrovo, traduci, wallet, SOS'}
            className={`-mt-5 w-14 h-14 rounded-[18px] flex items-center justify-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent ${
              sheet === 'actions' ? 'bg-app-text text-app-bg' : 'bg-app-accent text-app-on-accent shadow-lg shadow-app-accent/25'
            }`}
          >
            {sheet === 'actions' ? <X className="w-6 h-6" strokeWidth={2.6} /> : <Plus className="w-7 h-7" strokeWidth={2.6} />}
          </button>
        </div>
        {slots.slice(2, 3).map(item)}
        <button
          type="button"
          onClick={onToggleMore}
          aria-haspopup="dialog"
          aria-expanded={sheet === 'more'}
          data-testid="mnav-more"
          className={`relative flex flex-col items-center justify-center gap-1 h-16 text-[11px] transition-colors ${moreActive ? 'text-app-accent font-bold' : 'text-app-muted font-semibold'}`}
        >
          {moreActive && <span aria-hidden className="absolute top-0 h-[3px] w-8 rounded-b-full bg-app-accent" />}
          <LayoutGrid className="w-6 h-6" strokeWidth={moreActive ? 2.4 : 2} />
          <span>Altro</span>
        </button>
      </div>
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
        className="absolute inset-x-0 bottom-0 max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] overflow-y-auto rounded-t-3xl bg-app-raised border-t border-app-line pb-[calc(5rem+env(safe-area-inset-bottom))] short:pb-[calc(4.5rem+env(safe-area-inset-bottom))] animate-sheet-up"
      >
        <div className="mx-auto max-w-xl px-4 pt-2.5 space-y-4 short:max-w-3xl short:space-y-2.5">
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-slate-600" />
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="qa-title" className="text-xl font-extrabold text-app-text">Cosa vuoi fare?</h2>
            <span className="text-[13px] text-app-muted">Foto apre la fotocamera</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5 short:grid-cols-6">
            {ACTIONS.map((a, i) => (
              <button
                key={a.id}
                type="button"
                data-autofocus={i === 0 ? true : undefined}
                onClick={() => onAction(a.id)}
                data-testid={`qa-${a.id}`}
                className="min-h-[96px] short:min-h-[76px] short:gap-1.5 rounded-2xl border border-app-line bg-app-surface active:bg-app-bg flex flex-col items-center justify-center gap-2.5 text-sm font-semibold text-app-text focus-visible:outline-2 focus-visible:outline-app-accent"
              >
                <span className={`w-11 h-11 rounded-[14px] flex items-center justify-center ${a.tile}`}>
                  <a.icon className={`w-[22px] h-[22px] ${a.fg}`} />
                </span>
                {a.label}
              </button>
            ))}
          </div>
          {/* Coordinamento ed emergenza: separati dalle azioni ordinarie e distinti tra loro */}
          <div className="pt-3 border-t border-app-line grid grid-cols-2 gap-2.5 short:pt-2.5">
            <button
              type="button"
              onClick={() => onAction('lost')}
              data-testid="qa-lost"
              className="min-h-[52px] rounded-2xl border border-fam-sos/45 bg-fam-sos/10 text-red-200 text-[15px] font-bold flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-app-accent"
            >
              <LifeBuoy className="w-[18px] h-[18px]" /> Ho perso il gruppo
            </button>
            <button
              type="button"
              onClick={() => onAction('sos')}
              data-testid="qa-sos"
              className="min-h-[52px] rounded-2xl bg-app-danger text-white text-[15px] font-extrabold flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-accent"
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

  const tile = (s: SectionInfo) => {
    const active = activeTab === s.id;
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => onGo(s.id)}
        aria-current={active ? 'page' : undefined}
        data-testid={`more-${s.id}`}
        className={`min-h-[52px] rounded-[14px] border flex items-center gap-2.5 px-3 text-left text-sm font-semibold text-app-text focus-visible:outline-2 focus-visible:outline-app-accent ${
          active ? 'border-app-accent bg-app-accent/10' : 'border-app-line bg-app-surface active:bg-app-bg'
        } ${s.id === 'sos' ? 'border-fam-sos/40' : ''}`}
      >
        <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 ${s.tile}`}>
          <s.icon className={`w-[18px] h-[18px] ${s.fg}`} />
        </span>
        <span className="min-w-0 flex-1 truncate">{s.label}</span>
        {active && <span className="text-[10px] font-bold uppercase tracking-wider text-app-accent shrink-0">Qui</span>}
      </button>
    );
  };

  return (
    <div className="lg:hidden fixed inset-0 z-[55]" data-testid="more-sheet">
      <button type="button" aria-label="Chiudi" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-[rgba(3,6,12,0.72)]" />
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-title"
        className="absolute inset-x-0 bottom-0 max-h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] flex flex-col rounded-t-3xl bg-app-bg border-t border-app-line pb-[calc(4.75rem+env(safe-area-inset-bottom))] animate-sheet-up"
      >
        <div className="mx-auto w-full max-w-xl px-4 pt-2.5 pb-3 space-y-3 border-b border-app-line">
          <div aria-hidden className="mx-auto h-1 w-10 rounded-full bg-slate-600" />
          <div className="flex items-center justify-between gap-3">
            <h2 id="more-title" className="text-xl font-extrabold text-app-text">Tutte le sezioni</h2>
            <button type="button" onClick={onEditBar} data-testid="nav-edit-open" className="min-h-[44px] px-1 text-sm font-semibold text-app-accent flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4" /> Modifica barra
            </button>
          </div>
          <label className="flex items-center gap-2.5 min-h-[46px] px-3.5 rounded-[14px] bg-app-surface border border-app-control focus-within:border-app-accent">
            <Search className="w-[18px] h-[18px] text-app-muted shrink-0" aria-hidden />
            <span className="sr-only">Cerca una sezione</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca: spese, metro, ambasciata…"
              enterKeyHint="search"
              data-testid="more-search"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[15px] text-app-text placeholder:text-app-placeholder"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Cancella la ricerca" className="w-8 h-8 -mr-1.5 rounded-lg flex items-center justify-center text-app-muted">
                <X className="w-4 h-4" />
              </button>
            )}
          </label>
        </div>

        <div className="overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-xl px-4 py-4 space-y-5">
            {query.trim() ? (
              <section aria-live="polite" className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-app-muted font-mono">
                  {results.length === 0 ? 'Nessun risultato' : `${results.length} ${results.length === 1 ? 'sezione' : 'sezioni'}`}
                </p>
                {results.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">{results.map(tile)}</div>
                ) : (
                  <div className="rounded-2xl border border-app-line bg-app-surface p-4 text-sm text-app-muted leading-relaxed" data-testid="more-empty">
                    Nessuna sezione per «{query.trim()}». Prova con parole come <b className="text-app-text">metro</b>, <b className="text-app-text">soldi</b>,{' '}
                    <b className="text-app-text">foto</b> o <b className="text-app-text">emergenza</b>.
                  </div>
                )}
              </section>
            ) : (
              <>
                {activeTab !== 'today' && (
                  <button
                    type="button"
                    onClick={() => onGo('today')}
                    className="w-full min-h-[48px] rounded-[14px] border border-app-line bg-app-surface px-3 flex items-center gap-2.5 text-sm font-semibold text-app-text"
                  >
                    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center bg-fam-today/15">
                      {React.createElement(SECTIONS[0].icon, { className: 'w-[18px] h-[18px] text-fam-today' })}
                    </span>
                    Torna a Oggi
                    <ChevronRight className="w-4 h-4 ml-auto text-app-muted" />
                  </button>
                )}
                {SECTION_GROUPS.map((g) => (
                  <section key={g} className="space-y-2" aria-labelledby={`grp-${g}`}>
                    <h3 id={`grp-${g}`} className="text-xs font-bold uppercase tracking-[0.14em] text-app-muted font-mono">{g}</h3>
                    <div className="grid grid-cols-2 gap-2">{SECTIONS.filter((s) => s.group === g).map(tile)}</div>
                  </section>
                ))}
              </>
            )}

            <div className="pt-4 border-t border-app-line grid grid-cols-2 gap-2">
              <button type="button" onClick={onProfile} className="min-h-[48px] rounded-[14px] border border-app-line bg-app-surface flex items-center justify-center gap-2 text-sm font-semibold text-app-text">
                <UserCog className="w-4 h-4 text-app-accent" /> Il mio profilo
              </button>
              {canInstall ? (
                <button type="button" onClick={onInstall} className="min-h-[48px] rounded-[14px] border border-app-line bg-app-surface flex items-center justify-center gap-2 text-sm font-semibold text-app-text">
                  <Smartphone className="w-4 h-4 text-app-accent" /> Installa l'app
                </button>
              ) : (
                <button type="button" onClick={onSignOut} className="min-h-[48px] rounded-[14px] border border-fam-sos/35 bg-fam-sos/10 flex items-center justify-center gap-2 text-sm font-semibold text-red-200">
                  <LogOut className="w-4 h-4" /> Esci
                </button>
              )}
            </div>
            {extra}
          </div>
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
