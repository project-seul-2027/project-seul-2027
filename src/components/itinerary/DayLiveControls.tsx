import React, { useState } from 'react';
import { ArrowRightLeft, Check, Circle, MapPin, MessageSquarePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { isSlot } from '../../types/expenses';
import type { TravelerSlotId } from '../../shared/travelerProfile';
import { PLACE_ID_PREFIX } from '../places/placeLocation';
import {
  addStopToDay,
  cycleStopStatus,
  removeAddedStop,
  saveDayNote,
  type AddedDayStop,
  type DayLiveDoc,
  type StopStatus
} from '../../services/itineraryLiveService';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';

const STATUS_CFG: Record<StopStatus, { label: string; pill: string; icon: React.ReactNode }> = {
  done: {
    label: 'Fatta',
    pill: 'bg-[#52d9e6]/15 text-[#52d9e6]',
    icon: <Check className="w-3.5 h-3.5" strokeWidth={2.75} />
  },
  skipped: {
    label: 'Saltata',
    pill: 'bg-white/[0.08] text-slate-400',
    icon: <X className="w-3.5 h-3.5" />
  },
  moved: {
    label: 'Spostata',
    pill: 'bg-amber-500/15 text-amber-300',
    icon: <ArrowRightLeft className="w-3.5 h-3.5" />
  }
};

/** Pulsante compatto per ciclare lo stato di una tappa: In programma -> Fatta -> Saltata -> Spostata */
export const StopStatusButton: React.FC<{
  status?: StopStatus;
  label: string;
  onCycle: () => void;
}> = ({ status, label, onCycle }) => {
  if (!status) {
    return (
      <button
        type="button"
        onClick={onCycle}
        aria-label={`Cambia stato di "${label}" (in programma)`}
        title="Tocca per segnare fatta, saltata o spostata"
        data-keep-style
        className={`min-h-10 min-w-10 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-white/[0.06] inline-flex items-center justify-center shrink-0 transition-colors ${FOCUS_RING}`}
        data-testid="stop-status-btn"
      >
        <Circle className="w-4 h-4" />
      </button>
    );
  }
  const cfg = STATUS_CFG[status];
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`Stato di "${label}": ${cfg.label}. Tocca per cambiare`}
      title="Tocca per cambiare stato"
      data-keep-style
      className={`min-h-9 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 shrink-0 transition-colors ${cfg.pill} ${FOCUS_RING}`}
      data-testid={`stop-status-${status}`}
    >
      {cfg.icon}
      <span>{cfg.label}</span>
    </button>
  );
};

/** Nota condivisa sul giorno (visibile e modificabile inline da tutto il gruppo) */
export const DayNoteBar: React.FC<{
  dayId: number;
  liveDoc?: DayLiveDoc;
}> = ({ dayId, liveDoc }) => {
  const { user, travelers } = useAuth();
  const slot: TravelerSlotId = user && isSlot(user.travelerId) ? user.travelerId : 't1';
  const currentNote = liveDoc?.note ?? '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentNote);

  const authorName = liveDoc?.noteBySlot
    ? liveDoc.noteBySlot === slot
      ? 'te'
      : travelers.find((t) => t.id === liveDoc.noteBySlot)?.name ?? liveDoc.noteBySlot
    : null;

  const startEdit = () => {
    setDraft(currentNote);
    setEditing(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveDayNote(dayId, draft, slot);
    setEditing(false);
  };

  if (editing) {
    return (
      <form
        onSubmit={(e) => void handleSave(e)}
        className="rounded-xl bg-[#101c29] p-3.5 space-y-2.5 my-3"
        data-keep-style
        data-testid="day-note-form"
      >
        <label htmlFor={`day-note-${dayId}`} className="block text-xs font-semibold text-slate-300">
          Nota condivisa sul giorno
        </label>
        <input
          id={`day-note-${dayId}`}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Es. spostato al pomeriggio per pioggia · prenotato tavolo 20:30"
          maxLength={300}
          autoFocus
          data-keep-style
          className="w-full min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
        />
        <div className="flex items-center gap-2">
          <button
            type="submit"
            data-keep-style
            className={`min-h-10 px-4 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] text-xs font-semibold transition-colors ${FOCUS_RING}`}
          >
            Salva nota
          </button>
          {currentNote && (
            <button
              type="button"
              onClick={() => {
                void saveDayNote(dayId, '', slot);
                setEditing(false);
              }}
              data-keep-style
              className={`min-h-10 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-rose-300 text-xs font-medium transition-colors ${FOCUS_RING}`}
            >
              Rimuovi
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditing(false)}
            data-keep-style
            className={`min-h-10 px-3 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors ${FOCUS_RING}`}
          >
            Annulla
          </button>
        </div>
      </form>
    );
  }

  if (!currentNote) {
    return (
      <div className="my-2">
        <button
          type="button"
          onClick={startEdit}
          data-keep-style
          className={`min-h-10 px-3 rounded-xl bg-[#101c29] hover:bg-[#152536] text-xs font-medium text-slate-300 inline-flex items-center gap-1.5 transition-colors ${FOCUS_RING}`}
          data-testid="day-note-add"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 text-[#52d9e6]" aria-hidden="true" />
          Aggiungi nota condivisa sul giorno
        </button>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl bg-[#101c29] px-3.5 py-3 my-3 flex items-start justify-between gap-3"
      data-keep-style
      data-testid="day-note-banner"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white leading-snug">{currentNote}</p>
        {authorName && <p className="mt-0.5 text-xs text-slate-400">Nota di {authorName}</p>}
      </div>
      <button
        type="button"
        onClick={startEdit}
        aria-label="Modifica nota del giorno"
        data-keep-style
        className={`min-h-9 min-w-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center shrink-0 transition-colors ${FOCUS_RING}`}
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/** Elenco delle tappe extra aggiunte dal gruppo o promosse da Luoghi, con form rapido inline */
export const AddedStopsSection: React.FC<{
  dayId: number;
  liveDoc?: DayLiveDoc;
  onViewOnMap?: (locationId: string, dayNumber?: number) => void;
}> = ({ dayId, liveDoc, onViewOnMap }) => {
  const { user, travelers } = useAuth();
  const slot: TravelerSlotId = user && isSlot(user.travelerId) ? user.travelerId : 't1';
  const stops: AddedDayStop[] = liveDoc?.addedStops ?? [];
  const states = liveDoc?.stopStates ?? {};

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [time, setTime] = useState('Sera');
  const [note, setNote] = useState('');

  const nameOf = (s: TravelerSlotId) => (s === slot ? 'te' : travelers.find((t) => t.id === s)?.name ?? s);

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await addStopToDay(dayId, {
      name: name.trim(),
      time: time.trim() || 'Al volo',
      note: note.trim(),
      addedBySlot: slot
    });
    setName('');
    setNote('');
    setAdding(false);
  };

  return (
    <section className="mt-5 space-y-2.5" data-testid="added-stops-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-slate-300">
          Tappe extra del gruppo {stops.length > 0 && <span className="text-[#52d9e6] tabular-nums">({stops.length})</span>}
        </h3>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            data-keep-style
            className={`min-h-9 px-3 rounded-lg bg-[#101c29] hover:bg-[#152536] text-xs font-semibold text-[#52d9e6] inline-flex items-center gap-1 transition-colors ${FOCUS_RING}`}
            data-testid="add-extra-stop-btn"
          >
            <Plus className="w-3.5 h-3.5" /> Aggiungi tappa
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={(e) => void submitAdd(e)}
          className="rounded-xl bg-[#101c29] p-3.5 space-y-3"
          data-keep-style
          data-testid="add-extra-stop-form"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[7.5rem_1fr] gap-2.5">
            <input
              type="text"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="Orario (es. 19:30)"
              maxLength={30}
              data-keep-style
              className="min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome tappa o locale"
              maxLength={80}
              autoFocus
              data-keep-style
              className="min-h-11 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
            />
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota breve (opzionale)"
            maxLength={200}
            data-keep-style
            className="w-full min-h-10 rounded-xl bg-[#0a1119] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              data-keep-style
              className={`min-h-10 px-4 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] text-xs font-semibold transition-colors ${FOCUS_RING}`}
            >
              Aggiungi al giorno
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              data-keep-style
              className={`min-h-10 px-3 rounded-xl text-slate-400 hover:text-white text-xs font-medium transition-colors ${FOCUS_RING}`}
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {stops.length > 0 && (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {stops.map((st) => {
            const key = `a_${st.id}`;
            const status = states[key];
            return (
              <div key={st.id} className="py-3 flex items-start gap-3" data-testid="added-stop-row">
                <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-[#52d9e6]">{st.time || 'Extra'}</span>
                <div className={`min-w-0 flex-1 ${status === 'skipped' ? 'opacity-50 line-through' : ''}`}>
                  <p className="text-sm font-semibold text-white leading-snug">{st.name}</p>
                  {st.note && <p className="mt-0.5 text-xs text-slate-300 leading-snug">{st.note}</p>}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Aggiunta da {nameOf(st.addedBySlot)}
                    {st.placeId && onViewOnMap && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          onClick={() => onViewOnMap(`${PLACE_ID_PREFIX}${st.placeId}`, dayId)}
                          className="text-[#52d9e6] hover:underline inline-flex items-center gap-0.5 font-medium"
                        >
                          <MapPin className="w-3 h-3" /> Mappa
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <StopStatusButton status={status} label={st.name} onCycle={() => void cycleStopStatus(dayId, key)} />
                <button
                  type="button"
                  onClick={() => void removeAddedStop(dayId, st.id)}
                  aria-label={`Rimuovi ${st.name} dal giorno`}
                  data-keep-style
                  className={`min-h-10 min-w-10 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-white/[0.04] flex items-center justify-center shrink-0 transition-colors ${FOCUS_RING}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
