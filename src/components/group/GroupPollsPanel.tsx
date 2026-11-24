import React, { useState } from 'react';
import { Check, Lock, LockOpen, Plus, Trash2, Vote } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { isSlot } from '../../types/expenses';
import type { TravelerSlotId } from '../../shared/travelerProfile';
import { createPoll, deletePoll, togglePollClosed, usePolls, votePoll } from '../../services/pollsService';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';

const QUICK_POLL_TEMPLATES: { label: string; question: string; options: string[] }[] = [
  { label: 'Cena stasera', question: 'Cena stasera: cosa vi va?', options: ['Korean BBQ', 'Mercato / Street food', 'Ramen o zuppa calda'] },
  { label: 'Orario uscita', question: 'A che ora ci troviamo pronti?', options: ['Tra 30 minuti', 'Alle 19:30', 'Alle 20:30'] },
  { label: 'Piano B pioggia', question: 'Piove: come cambiamo programma?', options: ['Centro commerciale / Coex', 'Museo o caffè', 'Restiamo sul piano'] }
];

export const GroupPollsPanel: React.FC = () => {
  const { user, travelers } = useAuth();
  const uid = user?.id ?? '';
  const mySlot: TravelerSlotId | null = user && isSlot(user.travelerId) ? user.travelerId : null;
  const { polls } = usePolls(mySlot);

  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const nameOf = (s: TravelerSlotId) => (s === mySlot ? 'Tu' : travelers.find((t) => t.id === s)?.name ?? s);

  const applyTemplate = (tpl: (typeof QUICK_POLL_TEMPLATES)[number]) => {
    setQuestion(tpl.question);
    setOptions([...tpl.options]);
  };

  const updateOption = (idx: number, val: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  };

  const addOptionField = () => {
    if (options.length < 4) setOptions((prev) => [...prev, '']);
  };

  const submitPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mySlot || !uid) return;
    const validOpts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || validOpts.length < 2) return;
    await createPoll(question, validOpts, uid, mySlot);
    setQuestion('');
    setOptions(['', '']);
    setCreating(false);
  };

  const validCount = options.map((o) => o.trim()).filter(Boolean).length;

  return (
    <section className="rounded-xl bg-[#101c29] p-4 sm:p-5 space-y-4" data-keep-style data-testid="group-polls-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
            <Vote className="w-4 h-4 text-[#52d9e6] shrink-0" aria-hidden="true" />
            Sondaggi lampo
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">Decisioni veloci tra noi 4 in tempo reale.</p>
        </div>
        {mySlot && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            data-keep-style
            className={`min-h-10 px-3.5 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors ${FOCUS_RING}`}
            data-testid="poll-new-btn"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Nuovo
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={(e) => void submitPoll(e)} className="rounded-xl bg-[#0a1119] p-3.5 space-y-3" data-keep-style data-testid="poll-form">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_POLL_TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                onClick={() => applyTemplate(tpl)}
                data-keep-style
                className={`min-h-8 px-2.5 rounded-lg bg-[#152231] hover:bg-[#1c2d40] text-xs font-medium text-slate-200 transition-colors ${FOCUS_RING}`}
              >
                {tpl.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="poll-question" className="block text-xs text-slate-300 mb-1">Domanda</label>
            <input
              id="poll-question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Es. Cena stasera: BBQ o Ramen?"
              maxLength={120}
              autoFocus
              data-keep-style
              className="w-full min-h-11 rounded-xl bg-[#101c29] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
              data-testid="poll-question-input"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs text-slate-300">Opzioni (da 2 a 4)</span>
            {options.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                placeholder={`Opzione ${idx + 1}`}
                maxLength={80}
                data-keep-style
                className="w-full min-h-10 rounded-xl bg-[#101c29] border border-white/10 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#52d9e6]"
                data-testid={`poll-opt-input-${idx}`}
              />
            ))}
            {options.length < 4 && (
              <button
                type="button"
                onClick={addOptionField}
                data-keep-style
                className={`min-h-9 px-3 rounded-lg text-xs font-medium text-[#52d9e6] hover:bg-white/[0.04] inline-flex items-center gap-1 transition-colors ${FOCUS_RING}`}
              >
                <Plus className="w-3.5 h-3.5" /> Aggiungi opzione
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={!question.trim() || validCount < 2}
              data-keep-style
              className={`min-h-10 px-4 rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] disabled:opacity-40 text-[#04242a] text-xs sm:text-sm font-semibold transition-colors ${FOCUS_RING}`}
              data-testid="poll-submit-btn"
            >
              Pubblica sondaggio
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              data-keep-style
              className={`min-h-10 px-3 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors ${FOCUS_RING}`}
            >
              Annulla
            </button>
          </div>
        </form>
      )}

      {polls.length === 0 && !creating ? (
        <p className="text-xs sm:text-sm text-slate-400 py-2">
          Nessun sondaggio attivo. Creane uno al volo quando dovete scegliere dove mangiare o cosa fare.
        </p>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => {
            const totalVotes = Object.keys(poll.votes).length;
            const myVote = mySlot ? poll.votes[mySlot] : undefined;
            return (
              <div key={poll.id} className="rounded-xl bg-[#0a1119] p-3.5 space-y-3" data-keep-style data-testid="poll-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm sm:text-base font-semibold text-white leading-snug">{poll.question}</p>
                      {poll.closed && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/10 text-slate-300">Chiuso</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Proposto da {nameOf(poll.createdBySlot)} · {totalVotes}/4 voti
                    </p>
                  </div>
                  <div className="flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => void togglePollClosed(poll.id)}
                      aria-label={poll.closed ? 'Riapri sondaggio' : 'Chiudi sondaggio'}
                      title={poll.closed ? 'Riapri voto' : 'Chiudi voto'}
                      data-keep-style
                      className={`min-h-9 min-w-9 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition-colors ${FOCUS_RING}`}
                    >
                      {poll.closed ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </button>
                    {(poll.createdBy === uid || poll.closed) && (
                      <button
                        type="button"
                        onClick={() => void deletePoll(poll.id)}
                        aria-label="Elimina sondaggio"
                        data-keep-style
                        className={`min-h-9 min-w-9 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-white/[0.06] flex items-center justify-center transition-colors ${FOCUS_RING}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {poll.options.map((opt) => {
                    const voters = (['t1', 't2', 't3', 't4'] as TravelerSlotId[]).filter((s) => poll.votes[s] === opt.id);
                    const pct = totalVotes > 0 ? Math.round((voters.length / totalVotes) * 100) : 0;
                    const picked = myVote === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!mySlot || poll.closed}
                        onClick={() => mySlot && void votePoll(poll.id, mySlot, opt.id)}
                        aria-pressed={picked}
                        data-keep-style
                        className={`relative w-full min-h-12 rounded-xl px-3.5 py-2.5 text-left overflow-hidden transition-colors ${FOCUS_RING} ${
                          picked ? 'bg-[#152a36]' : 'bg-[#101c29] hover:bg-[#152231]'
                        } disabled:cursor-default`}
                        data-testid={`poll-vote-${opt.id}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 transition-[width] duration-200 ${picked ? 'bg-[#52d9e6]/20' : 'bg-white/[0.05]'}`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className="relative flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-sm font-medium text-white">
                              {picked && <Check className="w-4 h-4 text-[#52d9e6] shrink-0" strokeWidth={2.75} />}
                              <span className={picked ? 'font-semibold text-[#52d9e6]' : ''}>{opt.text}</span>
                            </span>
                            {voters.length > 0 && (
                              <span className="block text-[11px] text-slate-400 mt-0.5">
                                {voters.map(nameOf).join(', ')}
                              </span>
                            )}
                          </span>
                          <span className="text-xs font-semibold tabular-nums text-slate-300 shrink-0">{voters.length}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
