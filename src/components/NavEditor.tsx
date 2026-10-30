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

/** "Modifica la barra": sceglie e ordina le 4 schede in basso (telefono). */
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
      <div className="w-full max-w-xl max-h-[92dvh] flex flex-col rounded-t-3xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-slate-800">
          <p className="flex-1 text-sm font-bold text-white">Modifica la barra in basso</p>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] rounded-xl text-slate-300 hover:bg-slate-800 flex items-center justify-center" aria-label="Chiudi"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-4 py-4 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Preimpostate</p>
            <div className="grid grid-cols-3 gap-2">
              {NAV_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => { setWarn(''); setDraft(p.tabs.filter((id) => tabs.some((t) => t.id === id))); }} className="rounded-xl bg-slate-800 text-white px-2 py-2.5 text-left" data-testid={`nav-preset-${p.id}`}>
                  <span className="block text-xs font-bold">{p.label}</span>
                  <span className="block text-[10px] text-slate-400 leading-tight mt-0.5">{p.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Nella barra ({draft.length}/{NAV_SLOTS})</p>
            <div className="grid grid-cols-4 gap-2" data-testid="nav-draft">
              {Array.from({ length: NAV_SLOTS }).map((_, i) => {
                const id = draft[i];
                const t = id ? byId(id) : null;
                const Icon = t?.icon;
                return (
                  <div key={i} className={`rounded-xl border px-1 py-2 flex flex-col items-center gap-1 min-h-[88px] ${t ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-dashed border-slate-700'}`}>
                    {t && Icon ? (
                      <>
                        <Icon className={`w-5 h-5 ${t.active}`} />
                        <span className="text-[10.5px] font-semibold text-white truncate max-w-full">{t.label}</span>
                        <span className="flex gap-1">
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-30 flex items-center justify-center" aria-label={`Sposta ${t.label} a sinistra`}><ChevronLeft className="w-4 h-4" /></button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="w-7 h-7 rounded-lg bg-slate-800 text-slate-200 disabled:opacity-30 flex items-center justify-center" aria-label={`Sposta ${t.label} a destra`}><ChevronRight className="w-4 h-4" /></button>
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-600 mt-4">Libero</span>
                    )}
                  </div>
                );
              })}
            </div>
            {warn && <p className="mt-2 text-xs text-amber-300" role="alert">{warn}</p>}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Tutte le sezioni</p>
            <div className="grid grid-cols-3 gap-2">
              {tabs.map((t) => {
                const on = draft.includes(t.id);
                const Icon = t.icon;
                return (
                  <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on} className={`min-h-[64px] rounded-xl border flex flex-col items-center justify-center gap-1 text-[11px] font-semibold ${on ? 'border-cyan-400 bg-cyan-500/15 text-white' : 'border-slate-800 bg-slate-950/60 text-slate-300'}`} data-testid={`nav-pick-${t.id}`}>
                    <Icon className={`w-5 h-5 ${t.active}`} /> {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="px-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={() => { onSave(null); onClose(); }} className="min-h-[48px] rounded-2xl bg-slate-800 text-slate-200 text-sm font-semibold" data-testid="nav-reset">Ripristina standard</button>
          <button type="button" disabled={!ready} onClick={() => { onSave(JSON.stringify(draft) === JSON.stringify(NAV_DEFAULT) ? null : draft); onClose(); }} className="min-h-[48px] rounded-2xl bg-cyan-400 disabled:opacity-40 text-slate-950 text-sm font-bold" data-testid="nav-save">Salva</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default NavEditor;
