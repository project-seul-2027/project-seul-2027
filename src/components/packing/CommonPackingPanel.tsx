import React, { useState } from 'react';
import { AlertTriangle, Check, PackageCheck, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { isSlot } from '../../types/expenses';
import { PACKING_CATEGORIES, type PackingCategory } from '../../types/packing';
import type { TravelerSlotId } from '../../shared/travelerProfile';
import { LEAVER_SLOT } from '../../shared/tripPresence';
import {
  removeCommonItem,
  restoreRecommendedCommonItems,
  upsertCommonItem,
  useCommonPacking
} from '../../services/commonPackingService';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';
const SLOTS: TravelerSlotId[] = ['t1', 't2', 't3', 't4'];

export const CommonPackingPanel: React.FC = () => {
  const { user, travelers } = useAuth();
  const mySlot: TravelerSlotId | null = user && isSlot(user.travelerId) ? user.travelerId : null;
  const { items, unassignedCount, packedCount } = useCommonPacking();

  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<PackingCategory>('electronics');
  const [carrierSlot, setCarrierSlot] = useState<TravelerSlotId | null>(mySlot);
  const [note, setNote] = useState('');

  const nameOf = (s: TravelerSlotId) => (s === mySlot ? 'Tu' : travelers.find((t) => t.id === s)?.name ?? s);
  const fullNameOf = (s: TravelerSlotId) => travelers.find((t) => t.id === s)?.name ?? s;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await upsertCommonItem({
      id: `cm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      category,
      carrierSlot,
      packed: false,
      note: note.trim(),
      updatedAt: Date.now()
    });
    setTitle('');
    setNote('');
    setAdding(false);
  };

  const assignedCount = items.length - unassignedCount;

  return (
    <div className="space-y-4" data-testid="common-packing-panel">
      <section className="rounded-xl bg-[#101c29] p-4 sm:p-5 space-y-3" data-keep-style>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#52d9e6] shrink-0" aria-hidden="true" />
              Oggetti in comune (uno per tutti)
            </h3>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
              Cose che basta portare in una sola valigia: assegnate chi le porta per evitare doppioni o dimenticanze.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                data-keep-style
                className={`min-h-10 px-3.5 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors ${FOCUS_RING}`}
                data-testid="common-add-btn"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} /> Aggiungi
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-white/[0.08]">
          <div>
            <div className="text-xs text-slate-400">Assegnati</div>
            <div className="mt-0.5 text-lg font-bold font-display tabular-nums text-white">
              {assignedCount}/{items.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Già in valigia</div>
            <div className="mt-0.5 text-lg font-bold font-display tabular-nums text-[#52d9e6]">
              {packedCount}/{items.length}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 flex items-end justify-start sm:justify-end">
            <button
              type="button"
              onClick={() => void restoreRecommendedCommonItems()}
              data-keep-style
              className={`min-h-9 px-3 rounded-lg bg-[#0a1119] hover:bg-[#152231] text-xs font-medium text-slate-300 inline-flex items-center gap-1.5 transition-colors ${FOCUS_RING}`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#52d9e6]" /> Ripristina consigliati
            </button>
          </div>
        </div>
      </section>

      {adding && (
        <form onSubmit={(e) => void handleAdd(e)} className="rounded-xl bg-[#101c29] p-4 sm:p-5 space-y-3" data-keep-style data-testid="common-add-form">
          <div className="font-display text-sm font-semibold text-white">Nuovo oggetto in comune</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cm-title" className="block text-xs text-slate-300 mb-1">Oggetto</label>
              <input
                id="cm-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es. Adattatore HDMI, carte da gioco…"
                maxLength={100}
                autoFocus
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
                data-testid="common-title-input"
              />
            </div>
            <div>
              <label htmlFor="cm-cat" className="block text-xs text-slate-300 mb-1">Categoria</label>
              <select
                id="cm-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as PackingCategory)}
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#52d9e6]"
              >
                {PACKING_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs text-slate-300 mb-1.5">Chi lo porta</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCarrierSlot(null)}
                aria-pressed={carrierSlot === null}
                data-keep-style
                className={`min-h-9 px-3 rounded-lg text-xs font-medium transition-colors ${FOCUS_RING} ${
                  carrierSlot === null ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-[#0a1119] text-slate-300'
                }`}
              >
                Da decidere
              </button>
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setCarrierSlot(s)}
                  aria-pressed={carrierSlot === s}
                  data-keep-style
                  className={`min-h-9 px-3 rounded-lg text-xs font-medium transition-colors ${FOCUS_RING} ${
                    carrierSlot === s ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-[#0a1119] text-slate-300'
                  }`}
                >
                  {nameOf(s)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="cm-note" className="block text-xs text-slate-300 mb-1">Nota (opzionale)</label>
            <input
              id="cm-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Es. metterlo in stiva o nello zaino"
              maxLength={240}
              data-keep-style
              className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!title.trim()}
              data-keep-style
              className={`min-h-10 px-5 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] disabled:opacity-40 text-[#04242a] text-xs sm:text-sm font-semibold transition-colors ${FOCUS_RING}`}
              data-testid="common-save-btn"
            >
              Salva oggetto
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              data-keep-style
              className={`min-h-10 px-3 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors ${FOCUS_RING}`}
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl bg-[#101c29] p-6 text-center space-y-2" data-keep-style>
          <PackageCheck className="w-6 h-6 text-slate-500 mx-auto" />
          <p className="text-sm font-medium text-slate-200">Nessun oggetto in comune</p>
          <p className="text-xs text-slate-400">Aggiungi un oggetto o ripristina la lista consigliata per l’appartamento.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-[#101c29] divide-y divide-white/10 px-4" data-keep-style>
          {items.map((item) => {
            const catLabel = PACKING_CATEGORIES.find((c) => c.id === item.category)?.label ?? item.category;
            const leaverAssigned = item.carrierSlot === LEAVER_SLOT;
            return (
              <div key={item.id} className="py-3.5 flex items-start gap-3" data-testid="common-item-row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.packed}
                  onClick={() => void upsertCommonItem({ ...item, packed: !item.packed })}
                  aria-label={`${item.title}: ${item.packed ? 'in valigia, tocca per togliere' : 'non ancora in valigia'}`}
                  data-keep-style
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${FOCUS_RING} ${
                    item.packed
                      ? 'bg-[#52d9e6] border-[#52d9e6] text-[#04242a]'
                      : 'bg-[#0a1119] border-white/20 text-transparent hover:border-[#52d9e6]'
                  }`}
                >
                  <Check className="w-4 h-4" strokeWidth={2.75} />
                </button>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className={`text-sm font-semibold ${item.packed ? 'line-through text-slate-400' : 'text-white'}`}>
                      {item.title}
                    </span>
                    <span className="text-[11px] text-slate-400">{catLabel}</span>
                  </div>

                  {item.note && <p className="text-xs text-slate-300 leading-snug">{item.note}</p>}

                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-slate-400 mr-0.5">Lo porta:</span>
                    {item.carrierSlot === null && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300">
                        Da assegnare
                      </span>
                    )}
                    {SLOTS.map((s) => {
                      const active = item.carrierSlot === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void upsertCommonItem({ ...item, carrierSlot: active ? null : s })}
                          aria-pressed={active}
                          data-keep-style
                          className={`min-h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors ${FOCUS_RING} ${
                            active
                              ? 'bg-[#52d9e6] text-[#04242a] font-semibold'
                              : 'bg-[#0a1119] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {nameOf(s)}
                        </button>
                      );
                    })}
                  </div>

                  {leaverAssigned && (
                    <p className="text-[11px] text-amber-300 flex items-start gap-1.5 pt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        {fullNameOf(LEAVER_SLOT)} riparte il 10 marzo: se l’oggetto serve fino al 19, meglio lasciarlo in casa o assegnarlo a chi resta.
                      </span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void removeCommonItem(item.id)}
                  aria-label={`Elimina ${item.title}`}
                  data-keep-style
                  className={`min-h-9 min-w-9 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-white/[0.06] flex items-center justify-center shrink-0 transition-colors ${FOCUS_RING}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
