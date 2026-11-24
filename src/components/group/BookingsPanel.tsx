import React, { useState } from 'react';
import { CalendarClock, Check, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { ITINERARY_DAYS } from '../../data/tripData';
import { isSlot, formatDay } from '../../types/expenses';
import type { TravelerSlotId } from '../../shared/travelerProfile';
import { removeBooking, upsertBooking, useBookings, type TripBooking } from '../../services/bookingsService';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';
const SLOTS: TravelerSlotId[] = ['t1', 't2', 't3', 't4'];

export const BookingsPanel: React.FC<{ onOpenDay?: (dayId: number) => void }> = ({ onOpenDay }) => {
  const { user, travelers } = useAuth();
  const uid = user?.id ?? '';
  const mySlot: TravelerSlotId | null = user && isSlot(user.travelerId) ? user.travelerId : null;
  const { bookings, todoCount } = useBookings();

  const [filter, setFilter] = useState<'all' | 'todo' | 'booked'>('all');
  const [editing, setEditing] = useState<Partial<TripBooking> | null>(null);

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tripDayId, setTripDayId] = useState<string>('');
  const [assigneeSlot, setAssigneeSlot] = useState<TravelerSlotId | null>(null);
  const [reference, setReference] = useState('');
  const [url, setUrl] = useState('');

  const nameOf = (s: TravelerSlotId) => (s === mySlot ? 'Tu' : travelers.find((t) => t.id === s)?.name ?? s);

  const openForm = (b?: TripBooking) => {
    setEditing(b ?? {});
    setTitle(b?.title ?? '');
    setDueDate(b?.dueDate ?? '');
    setTripDayId(b?.tripDayId != null ? String(b.tripDayId) : '');
    setAssigneeSlot(b?.assigneeSlot ?? mySlot);
    setReference(b?.reference ?? '');
    setUrl(b?.url ?? '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const id = editing?.id ?? `bk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const parsedDay = tripDayId !== '' ? Number(tripDayId) : null;
    await upsertBooking({
      id,
      title: title.trim(),
      dueDate: dueDate.trim(),
      tripDayId: parsedDay !== null && Number.isInteger(parsedDay) ? parsedDay : null,
      assigneeSlot,
      status: editing?.status ?? 'todo',
      reference: reference.trim(),
      url: url.trim(),
      createdBy: editing?.createdBy ?? (uid || 'local'),
      updatedAt: Date.now()
    });
    setEditing(null);
  };

  const toggleStatus = (b: TripBooking) => {
    void upsertBooking({
      ...b,
      status: b.status === 'booked' ? 'todo' : 'booked'
    });
  };

  const assignTo = (b: TripBooking, slot: TravelerSlotId) => {
    void upsertBooking({
      ...b,
      assigneeSlot: b.assigneeSlot === slot ? null : slot
    });
  };

  const visible = bookings.filter((b) => (filter === 'all' ? true : b.status === filter));

  return (
    <section className="rounded-xl bg-[#101c29] p-4 sm:p-5 space-y-4" data-keep-style data-testid="bookings-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#52d9e6] shrink-0" aria-hidden="true" />
            Prenotazioni e scadenze
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Biglietti, tour e moduli con apertura vendite e chi del gruppo se ne occupa ({todoCount} da fare).
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => openForm()}
            data-keep-style
            className={`min-h-10 px-3.5 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors ${FOCUS_RING}`}
            data-testid="booking-add-btn"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Aggiungi
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5" role="group" aria-label="Filtra prenotazioni">
        {(
          [
            ['all', 'Tutte'],
            ['todo', `Da fare (${todoCount})`],
            ['booked', 'Prenotate']
          ] as const
        ).map(([id, label]) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={active}
              data-keep-style
              className={`min-h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${FOCUS_RING} ${
                active ? 'bg-[#52d9e6] text-[#04242a]' : 'bg-[#0a1119] text-slate-300 hover:bg-[#152231]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {editing && (
        <form onSubmit={(e) => void handleSave(e)} className="rounded-xl bg-[#0a1119] p-4 space-y-3" data-keep-style data-testid="booking-form">
          <div className="font-display text-sm font-semibold text-white">
            {editing.id ? 'Modifica prenotazione' : 'Nuova prenotazione o scadenza'}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="bk-title" className="block text-xs text-slate-300 mb-1">Cosa prenotare</label>
              <input
                id="bk-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es. Ristorante su CatchTable, KTX per Busan…"
                maxLength={100}
                autoFocus
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#101c29] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
                data-testid="booking-title-input"
              />
            </div>

            <div>
              <label htmlFor="bk-date" className="block text-xs text-slate-300 mb-1">Apertura vendite / scadenza</label>
              <input
                id="bk-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#101c29] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#52d9e6]"
              />
            </div>

            <div>
              <label htmlFor="bk-day" className="block text-xs text-slate-300 mb-1">Giorno dell’itinerario</label>
              <select
                id="bk-day"
                value={tripDayId}
                onChange={(e) => setTripDayId(e.target.value)}
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#101c29] border border-white/10 px-3 text-sm text-white focus:outline-none focus:border-[#52d9e6]"
              >
                <option value="">Nessun giorno specifico</option>
                {ITINERARY_DAYS.map((d) => (
                  <option key={d.id} value={d.id}>
                    Giorno {d.id + 1} ({d.dateStr.replace(' 2027', '')}) · {d.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs text-slate-300 mb-1.5">Chi se ne occupa</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAssigneeSlot(null)}
                aria-pressed={assigneeSlot === null}
                data-keep-style
                className={`min-h-9 px-3 rounded-lg text-xs font-medium transition-colors ${FOCUS_RING} ${
                  assigneeSlot === null ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-[#101c29] text-slate-300'
                }`}
              >
                Da assegnare
              </button>
              {SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setAssigneeSlot(s)}
                  aria-pressed={assigneeSlot === s}
                  data-keep-style
                  className={`min-h-9 px-3 rounded-lg text-xs font-medium transition-colors ${FOCUS_RING} ${
                    assigneeSlot === s ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-[#101c29] text-slate-300'
                  }`}
                >
                  {nameOf(s)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="bk-ref" className="block text-xs text-slate-300 mb-1">Nota o codice prenotazione</label>
              <input
                id="bk-ref"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Es. codice PNR, orario turno…"
                maxLength={240}
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#101c29] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
              />
            </div>
            <div>
              <label htmlFor="bk-url" className="block text-xs text-slate-300 mb-1">Link prenotazione (opzionale)</label>
              <input
                id="bk-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                maxLength={400}
                data-keep-style
                className="w-full min-h-11 rounded-xl bg-[#101c29] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!title.trim()}
              data-keep-style
              className={`min-h-10 px-5 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] disabled:opacity-40 text-[#04242a] text-xs sm:text-sm font-semibold transition-colors ${FOCUS_RING}`}
              data-testid="booking-save-btn"
            >
              Salva
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              data-keep-style
              className={`min-h-10 px-3 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors ${FOCUS_RING}`}
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {visible.length === 0 ? (
        <p className="text-xs sm:text-sm text-slate-400 py-3">Nessuna voce con questo filtro.</p>
      ) : (
        <div className="divide-y divide-white/10 border-t border-white/10">
          {visible.map((b) => {
            const booked = b.status === 'booked';
            const linkedDay = b.tripDayId !== null ? ITINERARY_DAYS.find((d) => d.id === b.tripDayId) : null;
            return (
              <div key={b.id} className="py-3.5 flex items-start gap-3" data-testid="booking-row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={booked}
                  onClick={() => toggleStatus(b)}
                  aria-label={`${b.title}: ${booked ? 'prenotato, tocca per riaprire' : 'da prenotare, tocca per segnare prenotato'}`}
                  data-keep-style
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${FOCUS_RING} ${
                    booked
                      ? 'bg-[#52d9e6] border-[#52d9e6] text-[#04242a]'
                      : 'bg-[#0a1119] border-white/20 text-transparent hover:border-[#52d9e6]'
                  }`}
                >
                  <Check className="w-4 h-4" strokeWidth={2.75} />
                </button>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <span className={`text-sm font-semibold ${booked ? 'line-through text-slate-400' : 'text-white'}`}>
                      {b.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {b.dueDate && (
                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded-md tabular-nums ${
                            booked ? 'bg-white/[0.06] text-slate-400' : 'bg-amber-500/15 text-amber-300'
                          }`}
                        >
                          entro {formatDay(b.dueDate)}
                        </span>
                      )}
                      {linkedDay && (
                        onOpenDay ? (
                          <button
                            type="button"
                            onClick={() => onOpenDay(linkedDay.id)}
                            className="text-[11px] font-medium text-[#52d9e6] hover:underline"
                          >
                            · G.{linkedDay.id + 1} ({linkedDay.dateStr.replace(' 2027', '')})
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            · G.{linkedDay.id + 1} ({linkedDay.dateStr.replace(' 2027', '')})
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  {b.reference && <p className="text-xs text-slate-300 leading-snug">{b.reference}</p>}

                  {/* Assegnazione rapida a 1 tocco */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[11px] text-slate-400 mr-0.5">Responsabile:</span>
                    {SLOTS.map((s) => {
                      const active = b.assigneeSlot === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => assignTo(b, s)}
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
                    {b.url && (
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs font-medium text-[#52d9e6] hover:underline inline-flex items-center gap-1"
                      >
                        Apri sito <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => openForm(b)}
                    aria-label={`Modifica ${b.title}`}
                    data-keep-style
                    className={`min-h-9 min-w-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors ${FOCUS_RING}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeBooking(b.id)}
                    aria-label={`Elimina ${b.title}`}
                    data-keep-style
                    className={`min-h-9 min-w-9 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-white/[0.06] flex items-center justify-center transition-colors ${FOCUS_RING}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
