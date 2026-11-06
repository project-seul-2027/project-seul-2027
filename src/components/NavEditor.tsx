import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { NAV_DEFAULT, NAV_PRESETS, NAV_SLOTS } from '../utils/navPrefs';

export interface NavTabInfo {
  id: string;
  label: string;
  icon: React.ElementType;
  active: string;
}

/** "Modifica la barra": sceglie e ordina le 3 schede in basso (telefono); + e Altro restano fissi. */
export const NavEditor: React.FC<{ tabs: NavTabInfo[]; current: string[]; onSave: (ids: string[] | null) => void; onClose: () => void }> = ({
  tabs, current, onSave, onClose
}) => {
  const [draft, setDraft] = useState<string[]>(current);
  const [warn, setWarn] = useState('');
  const byId = (id: string) => tabs.find((t) => t.id === id)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id: string) => {
    setWarn('');
    if (draft.includes(id)) return setDraft(draft.filter((x) => x !== id));
    if (draft.length >= NAV_SLOTS) return setWarn(`La barra ha ${NAV_SLOTS} posti: togline una prima.`);
    setDraft([...draft, id]);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
  };
  const ready = draft.length === NAV_SLOTS;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/70 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Modifica la barra" data-testid="nav-editor">
      <div className="w-full max-w-xl max-h-[92dvh] flex flex-col rounded-t-2xl bg-[#0a1119] shadow-[0_-6px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <p className="flex-1 text-xl font-medium text-white font-display">Modifica la barra in basso</p>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-2 space-y-6">
          <div>
            <p className="text-base font-medium text-white font-display mb-2.5">Preimpostate</p>
            <div className="grid grid-cols-3 gap-2">
              {NAV_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => { setWarn(''); setDraft(p.tabs.filter((id) => tabs.some((t) => t.id === id))); }} className="rounded-xl bg-[#152231] text-white px-3 py-3 text-left" data-testid={`nav-preset-${p.id}`}>
                  <span className="block text-[13px] font-semibold">{p.label}</span>
                  <span className="block text-[11px] text-slate-400 leading-tight mt-1">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-base font-medium text-white font-display mb-2.5">Nella barra ({draft.length}/{NAV_SLOTS})</p>
            <div className="grid grid-cols-3 gap-2" data-testid="nav-draft">
              {Array.from({ length: NAV_SLOTS }).map((_, i) => {
                const id = draft[i];
                const t = id ? byId(id) : null;
                const Icon = t?.icon;
                return (
                  <div key={i} className={`rounded-xl px-1 py-2 flex flex-col items-center gap-1 min-h-[96px] ${t ? 'bg-[#152231] shadow-[inset_0_0_0_1.5px_#52d9e6]' : 'bg-[#152231]/50'}`}>
                    {t && Icon ? (
                      <>
                        <Icon className="w-5 h-5 text-[#52d9e6]" />
                        <span className="text-[12px] font-semibold text-white truncate max-w-full">{t.label}</span>
                        <span className="flex gap-1">
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-9 h-9 rounded-lg text-slate-200 disabled:opacity-30 flex items-center justify-center" aria-label={`Sposta ${t.label} a sinistra`}><ChevronLeft className="w-4 h-4" /></button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="w-9 h-9 rounded-lg text-slate-200 disabled:opacity-30 flex items-center justify-center" aria-label={`Sposta ${t.label} a destra`}><ChevronRight className="w-4 h-4" /></button>
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-slate-500 mt-5">Libero</span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Il pulsante + al centro e «Altro» restano sempre nella barra.</p>
            {warn && <p className="mt-2 text-xs text-amber-300" role="alert">{warn}</p>}
          </div>

          <div>
            <p className="text-base font-medium text-white font-display mb-2.5">Tutte le sezioni</p>
            <div className="grid grid-cols-3 gap-2">
              {tabs.map((t) => {
                const on = draft.includes(t.id);
                const Icon = t.icon;
                return (
                  <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on} className={`min-h-[68px] rounded-xl flex flex-col items-center justify-center gap-1.5 text-[12px] font-semibold ${on ? 'bg-[#152231] shadow-[inset_0_0_0_1.5px_#52d9e6] text-white' : 'bg-[#152231]/50 text-slate-300'}`} data-testid={`nav-pick-${t.id}`}>
                    <Icon className={`w-5 h-5 ${on ? "text-[#52d9e6]" : "text-slate-400"}`} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-5 pt-3 grid grid-cols-2 gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={() => { onSave(null); onClose(); }} className="min-h-[48px] rounded-xl bg-[#152231] text-slate-100 text-[15px] font-semibold" data-testid="nav-reset">Ripristina standard</button>
          <button type="button" disabled={!ready} onClick={() => { onSave(JSON.stringify(draft) === JSON.stringify(NAV_DEFAULT) ? null : draft); onClose(); }} className="min-h-[48px] rounded-xl bg-[#52d9e6] disabled:opacity-40 text-[#04242a] text-[15px] font-semibold" data-testid="nav-save">Salva</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NavEditor;
