import React, { useState } from 'react';
import {
  Users, Home, Radio, LifeBuoy, MapPin, Navigation, Map as MapIcon, Flag, Plus, Trash2, Clock, Check, X, CircleAlert, Loader2,
  Phone, MessageCircle, UserPlus, ChevronRight
} from 'lucide-react';
import type { useAuth } from '../../auth/AuthContext';
import type { GroupMember } from '../../shared/travelerProfile';
import { CHECKLIST_ITEMS, countDone } from '../../shared/tripChecklist';
import { ACCOMMODATIONS } from '../../data/tripData';
import { ANSWER_LABEL, seoulClock, untilMorning, type Meetup, type MeetupAnswer } from '../../shared/groupLive';
import { formatCountdown } from '../../utils/tripClock';
import {
  answer, clearLost, dismissNotice, markHome, markOut, removeMeetup, reportLost, setSharingAllowed, stopSharing
} from '../group/groupLiveStore';
import { MeetupSheet, shareModeText, useGroupLiveModel, type StatusKind } from '../group/GroupLive';
import type { useGroupChecklists } from '../useGroupChecklists';

/**
 * Pagina "Il gruppo" sul telefono, ripensata in tre schede:
 *  · Adesso: chi è dove, avvisi urgenti, "Sono a casa", posizione, "Ho perso il gruppo" e ritrovi
 *  · Persone: i partecipanti con chiamata e WhatsApp a un tocco
 *  · Preparativi: a che punto siamo, con le tue caselle ben grandi
 * Colori dell'app: ciano solo per ciò che si tocca, verde acqua del Gruppo per gli indicatori, rosso solo per "perso".
 */

type Travelers = ReturnType<typeof useAuth>['travelers'];
type Checklists = ReturnType<typeof useGroupChecklists>['all'];
type Model = ReturnType<typeof useGroupLiveModel>;
type PhoneTab = 'now' | 'people' | 'prep';

interface Props {
  meId: string | undefined;
  group: GroupMember[];
  travelers: Travelers;
  checklists: Checklists;
  checklistError: string | null;
  onToggleCheck: (key: (typeof CHECKLIST_ITEMS)[number]['key']) => void;
  onOpenMember: (id: string) => void;
  onRoute?: (placeId: string) => void;
  onShowMap?: () => void;
}

const DOT: Record<StatusKind, string> = {
  lost: 'bg-fam-sos',
  home: 'bg-fam-group',
  live: 'bg-fam-group',
  stale: 'bg-app-muted',
  out: 'bg-app-muted',
  none: 'bg-app-surface border border-app-control'
};
const TEXT: Record<StatusKind, string> = {
  lost: 'text-fam-sos font-semibold',
  home: 'text-fam-group',
  live: 'text-slate-200',
  stale: 'text-app-muted',
  out: 'text-slate-300',
  none: 'text-app-muted'
};

// Avatar senza colore associato: foto profilo, con fondo neutro se manca.
const Person: React.FC<{ name: string; url?: string; color?: string; size?: string; dot?: StatusKind; ring?: boolean }> = ({ name, url, size = 'w-11 h-11', dot, ring }) => (
  <span className={`relative shrink-0 ${size}`}>
    <span
      className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center text-[13px] font-bold text-white ${ring ? 'ring-2 ring-app-accent ring-offset-2 ring-offset-app-surface' : ''}`}
      style={{ backgroundColor: '#334155' }}
    >
      {url ? <img src={url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" /> : name.slice(0, 2)}
    </span>
    {dot && <span className={`absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full border-2 border-app-surface ${DOT[dot]}`} aria-hidden />}
  </span>
);

const Heading: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div className="flex items-center justify-between gap-2 px-1">
    <h3 className="text-[12px] font-bold uppercase tracking-widest text-app-muted">{children}</h3>
    {aside}
  </div>
);

const btnRaised = 'min-h-[52px] rounded-2xl bg-app-raised border border-app-control text-app-text text-[14.5px] font-semibold flex items-center justify-center gap-2 px-3 active:scale-[0.99] disabled:opacity-50';
const btnAccent = 'min-h-[52px] rounded-2xl bg-app-accent text-app-on-accent text-[14.5px] font-bold flex items-center justify-center gap-2 px-3 active:scale-[0.99]';

/* ---------- Ritrovi ---------- */

const FixedCard: React.FC<{ m: Meetup; myUid: string; onRoute?: (placeId: string) => void }> = ({ m, myUid, onRoute }) => (
  <div className="rounded-2xl bg-app-surface border border-app-line p-4" data-testid="fixed-card">
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl bg-fam-group/15 text-fam-group flex items-center justify-center shrink-0"><Flag className="w-5 h-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-fam-group">Se ci perdiamo, ci vediamo qui</p>
        <p className="mt-0.5 text-[16px] font-bold text-app-text leading-snug">{m.label}</p>
        {m.note && <p className="mt-1 text-[13px] text-app-muted leading-snug">{m.note}</p>}
      </div>
      {m.createdBy === myUid && (
        <button type="button" onClick={() => removeMeetup(m.id)} className="w-11 h-11 -mr-1 -mt-1 rounded-xl text-app-muted flex items-center justify-center" aria-label="Togli il punto fisso">
          <Trash2 className="w-[18px] h-[18px]" />
        </button>
      )}
    </div>
    {m.placeId && onRoute ? (
      <button type="button" onClick={() => onRoute(m.placeId!)} className={`mt-3 w-full ${btnRaised} min-h-[48px]`}><Navigation className="w-4 h-4" /> Portami lì</button>
    ) : (
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`} target="_blank" rel="noopener noreferrer" className={`mt-3 w-full ${btnRaised} min-h-[48px]`}><MapIcon className="w-4 h-4" /> Indicazioni</a>
    )}
  </div>
);

const MeetupCard: React.FC<{ m: Meetup; model: Model; byName: (s: string) => string; onRoute?: (placeId: string) => void }> = ({ m, model, byName, onRoute }) => {
  const { slot, user, now, slots } = model;
  const mine = slot ? m.answers[slot] : undefined;
  const left = m.at - now;
  const past = left < 0;
  return (
    <div className="rounded-2xl bg-app-surface border border-app-line p-4" data-testid="meetup-card">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-fam-group/15 text-fam-group flex items-center justify-center shrink-0"><MapPin className="w-5 h-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-app-text leading-snug">{m.label}</p>
          <p className="mt-0.5 text-[13.5px] text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-app-muted" /> alle <b className="font-mono text-app-text">{seoulClock(m.at)}</b> · {past ? `${formatCountdown(-left)} fa` : `tra ${formatCountdown(left)}`}
          </p>
          {m.note && <p className="mt-1 text-[13px] text-app-muted leading-snug">{m.note}</p>}
        </div>
        {(m.createdBy === user?.id || past) && (
          <button type="button" onClick={() => removeMeetup(m.id)} className="w-11 h-11 -mr-1 -mt-1 rounded-xl text-app-muted flex items-center justify-center" aria-label="Elimina il ritrovo">
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {slots.map((s) => {
          const a = m.answers[s];
          const tone = a === 'ok' ? 'bg-fam-group/15 text-fam-group border-fam-group/40' : a === 'late' ? 'bg-fam-weather/15 text-fam-weather border-fam-weather/40' : a === 'no' ? 'bg-fam-sos/10 text-fam-sos border-fam-sos/40 line-through' : 'bg-app-bg text-app-muted border-app-line';
          return (
            <span key={s} className={`text-[12px] font-semibold rounded-full border px-2.5 py-1 ${tone}`}>
              {s === slot ? 'Tu' : byName(s)}{a ? ` · ${ANSWER_LABEL[a].toLowerCase()}` : ''}
            </span>
          );
        })}
      </div>
      {slot && !past && (
        <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="La tua risposta">
          {(['ok', 'late', 'no'] as MeetupAnswer[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => answer(m.id, a)}
              aria-pressed={mine === a}
              data-testid={`meetup-answer-${a}`}
              className={`min-h-[46px] rounded-xl text-[13.5px] font-bold border ${mine === a ? 'bg-app-accent border-app-accent text-app-on-accent' : 'bg-app-raised border-app-control text-app-text'}`}
            >
              {ANSWER_LABEL[a]}
            </button>
          ))}
        </div>
      )}
      {m.placeId && onRoute ? (
        <button type="button" onClick={() => onRoute(m.placeId!)} className={`mt-3 w-full ${btnRaised} min-h-[48px]`}><Navigation className="w-4 h-4" /> Portami lì</button>
      ) : (
        <a href={`https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`} target="_blank" rel="noopener noreferrer" className={`mt-3 w-full ${btnRaised} min-h-[48px]`}><MapIcon className="w-4 h-4" /> Apri sulla mappa</a>
      )}
    </div>
  );
};

/* ---------- Scheda "Adesso" ---------- */

const NowPanel: React.FC<{ model: Model; group: GroupMember[]; travelers: Travelers; onRoute?: (placeId: string) => void; onShowMap?: () => void }> = ({ model: m, group, travelers, onRoute, onShowMap }) => {
  const { user, slot, g, slots, allowed } = m;
  const nameOf = (s: string) => travelers.find((t) => t.id === s)?.name ?? s;
  const avatarOf = (s: string) => group.find((x) => x.travelerId === s)?.avatarUrl;
  const colorOf = (s: string) => travelers.find((t) => t.id === s)?.color;
  if (!user || !slot) {
    return <p className="rounded-2xl bg-app-surface border border-app-line p-4 text-[14px] text-app-muted">Il gruppo in tempo reale si attiva quando il tuo profilo è collegato a uno dei 4 posti del viaggio.</p>;
  }
  const lostOthers = slots.filter((s) => s !== slot && m.statusOf(s).lost);

  return (
    <div className="space-y-5">
      {/* Urgente: io o un altro abbiamo perso il gruppo */}
      {m.iAmLost && (
        <section className="rounded-2xl border border-fam-sos/50 bg-fam-sos/10 p-4 space-y-3" data-testid="lost-panel">
          <p className="text-[15px] font-bold text-app-text flex items-center gap-2"><LifeBuoy className="w-5 h-5 text-fam-sos" /> Il gruppo sa che li hai persi</p>
          <p className="text-[13.5px] text-slate-200 leading-snug">
            {g.sharingUntil ? 'Vedono la tua posizione precisa per 2 ore.' : 'La posizione è spenta: dì al gruppo dove sei, oppure raggiungi il punto fisso.'}
            {m.fixed ? '' : ' Nessun punto fisso è stato scelto per oggi.'}
          </p>
          {m.fixed && <FixedCard m={m.fixed} myUid={user.id} onRoute={onRoute} />}
          <button type="button" onClick={() => clearLost()} className={`w-full ${btnAccent}`} data-testid="lost-clear">Li ho ritrovati</button>
        </section>
      )}
      {lostOthers.map((s) => {
        const st = m.statusOf(s);
        return (
          <section key={s} className="rounded-2xl border border-fam-sos/50 bg-fam-sos/10 p-4 space-y-3" data-testid="group-row-lost">
            <div className="flex items-start gap-3">
              <Person name={nameOf(s).slice(0, 2)} url={avatarOf(s)} color={colorOf(s)} />
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-bold text-app-text leading-snug">{nameOf(s)} ha perso il gruppo</p>
                <p className="mt-0.5 text-[13.5px] text-slate-200 leading-snug">{st.text.replace(/^Ha perso il gruppo · /, '')}</p>
              </div>
            </div>
            <div className={`grid gap-2 ${st.share ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button type="button" onClick={() => m.waitHere(s)} disabled={m.helpBusy === s} className={`${btnAccent} min-h-[48px] disabled:opacity-60`} data-testid="wait-here">
                {m.helpBusy === s ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />} Aspettalo qui
              </button>
              {st.share && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${st.share.lat},${st.share.lng}&travelmode=walking`} target="_blank" rel="noopener noreferrer" className={`${btnRaised} min-h-[48px]`} data-testid="go-to-lost">
                  <Navigation className="w-4 h-4" /> Vai da lui
                </a>
              )}
            </div>
          </section>
        );
      })}
      {m.helpError && <p className="text-[13px] text-fam-weather flex gap-1.5" role="alert"><CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />{m.helpError}</p>}

      {/* Chi è dove */}
      <section className="space-y-2">
        <Heading
          aside={g.sharingUntil ? (
            <span className="text-[12px] font-semibold rounded-full px-2.5 py-1 bg-fam-group/15 text-fam-group flex items-center gap-1.5" data-testid="sharing-badge">
              <Radio className="w-3.5 h-3.5 motion-safe:animate-pulse" /> Condivisa fino alle {seoulClock(g.sharingUntil)}
            </span>
          ) : null}
        >
          Chi è dove
        </Heading>
        <ul className="rounded-2xl bg-app-surface border border-app-line divide-y divide-app-line overflow-hidden">
          {slots.map((s) => {
            const st = m.statusOf(s);
            return (
              <li key={s} className="flex items-center gap-3 p-3 min-h-[64px]" data-testid="group-row">
                <Person name={(s === slot ? 'Tu' : nameOf(s)).slice(0, 2)} url={avatarOf(s)} color={colorOf(s)} dot={st.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-app-text truncate">{s === slot ? 'Tu' : nameOf(s)}</p>
                  <p className={`text-[13px] leading-snug ${TEXT[st.kind]}`}>{st.text}</p>
                </div>
                {!st.lost && st.share && s !== slot && onShowMap && (
                  <button type="button" onClick={onShowMap} className="min-h-[44px] px-3 rounded-xl bg-app-raised border border-app-control text-app-text text-[13px] font-semibold flex items-center gap-1.5 shrink-0">
                    <MapIcon className="w-4 h-4" /> Mappa
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {g.error && <p className="text-[13px] text-fam-weather flex gap-1.5" role="alert"><CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />{g.error}</p>}

      {/* Azioni */}
      <section className="space-y-2.5">
        {g.nearHome && !m.iAmHome && (
          <p className="rounded-2xl bg-fam-group/10 border border-fam-group/40 p-3 text-[13.5px] text-app-text flex items-center gap-2" data-testid="near-home">
            <Home className="w-4 h-4 text-fam-group shrink-0" /> Sei vicino a {m.homeAcc?.name ?? 'casa'}: sei arrivato?
          </p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          {m.iAmHome ? (
            <button type="button" onClick={() => markOut()} className={btnRaised} data-testid="mark-out"><Check className="w-[18px] h-[18px] text-fam-group" /> A casa · esco</button>
          ) : (
            <button type="button" onClick={() => markHome()} className={g.nearHome ? btnAccent : btnRaised} data-testid="mark-home"><Home className="w-[18px] h-[18px]" /> Sono a casa</button>
          )}
          {g.sharingUntil ? (
            <button type="button" onClick={() => stopSharing()} className={btnRaised} data-testid="share-stop" aria-label="Ferma la posizione"><X className="w-[18px] h-[18px]" /> Ferma</button>
          ) : (
            <button type="button" onClick={() => m.setChooser((v) => !v)} disabled={!allowed} aria-expanded={m.chooser} className={btnRaised} data-testid="share-open" aria-label={allowed ? 'Condividi la posizione' : 'Posizione spenta'}><Radio className="w-[18px] h-[18px]" /> {allowed ? 'Condividi' : 'Spenta'}</button>
          )}
        </div>

        {m.suggestShare && m.nextMeetup && (
          <div className="rounded-2xl bg-app-surface border border-app-line p-3 flex items-center gap-3" data-testid="share-suggest">
            <MapPin className="w-5 h-5 text-fam-group shrink-0" />
            <p className="flex-1 text-[13.5px] text-slate-200 leading-snug">Ritrovo alle {seoulClock(m.nextMeetup.at)}: condividi la posizione solo fino alle {seoulClock(m.meetupUntil)}?</p>
            <button type="button" onClick={() => m.choose(m.meetupUntil)} className="min-h-[44px] px-4 rounded-xl bg-app-accent text-app-on-accent text-[14px] font-bold" data-testid="share-for-meetup">Condividi</button>
          </div>
        )}

        {m.chooser && allowed && !g.sharingUntil && (
          <div className="rounded-2xl bg-app-surface border border-app-line p-4" data-testid="share-chooser">
            <p className="text-[14px] font-semibold text-app-text">Per quanto tempo?</p>
            <p className="mt-1 text-[13px] text-app-muted leading-snug">La vede solo il gruppo e si cancella quando la fermi. Si aggiorna con l’app aperta; da fermo controllo ogni 3 minuti per non consumare batteria.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {m.nextMeetup && (
                <button type="button" onClick={() => m.choose(m.meetupUntil)} className={`col-span-2 ${btnAccent} min-h-[48px]`} data-testid="share-meetup">Solo per il ritrovo (fino alle {seoulClock(m.meetupUntil)})</button>
              )}
              <button type="button" onClick={() => m.choose(Date.now() + 3_600_000)} className={`${btnRaised} min-h-[48px]`} data-testid="share-1h">1 ora</button>
              <button type="button" onClick={() => m.choose(Date.now() + 3 * 3_600_000)} className={`${btnRaised} min-h-[48px]`}>3 ore</button>
              <button type="button" onClick={() => m.choose(untilMorning(Date.now()))} className={`col-span-2 ${btnRaised} min-h-[48px]`}>Fino a domattina</button>
            </div>
          </div>
        )}
        {g.sharingUntil && (
          <p className="px-1 text-[13px] text-app-muted leading-snug" data-testid="share-mode" data-mode={g.paused ? 'paused' : g.batterySaver ? 'saver' : g.trackMode}>{shareModeText(g)}</p>
        )}
        {g.notice && (
          <div className="rounded-2xl bg-fam-weather/10 border border-fam-weather/40 p-3 text-[13.5px] text-app-text flex items-start gap-2" role="status" data-testid="share-notice">
            <CircleAlert className="w-4 h-4 text-fam-weather shrink-0 mt-0.5" />
            <span className="flex-1">{g.notice}</span>
            <button type="button" onClick={dismissNotice} className="w-11 h-11 -m-2 flex items-center justify-center text-app-muted" aria-label="Chiudi l’avviso"><X className="w-4 h-4" /></button>
          </div>
        )}
        {g.gpsError && <p className="px-1 text-[13px] text-fam-weather" role="alert">{g.gpsError}</p>}

        {/* Ho perso il gruppo: sempre a portata di pollice, ma separato dal resto */}
        {!m.iAmLost && (m.lostConfirm ? (
          <div className="rounded-2xl border border-fam-sos/50 bg-fam-sos/10 p-4 space-y-3" data-testid="lost-confirm">
            <p className="text-[14px] text-app-text leading-snug">
              {allowed ? 'Avviso il gruppo e condivido la tua posizione precisa per 2 ore.' : 'Avviso il gruppo che li hai persi. La posizione resta spenta: nessuno la vedrà.'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => m.setLostConfirm(false)} className={`${btnRaised} min-h-[48px]`}>Annulla</button>
              <button type="button" onClick={() => { m.setLostConfirm(false); reportLost(); }} className="min-h-[48px] rounded-2xl bg-app-danger text-white text-[14.5px] font-bold" data-testid="lost-send">Avvisa il gruppo</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => m.setLostConfirm(true)} className="w-full min-h-[52px] rounded-2xl border border-fam-sos/60 bg-transparent text-fam-sos text-[14.5px] font-bold flex items-center justify-center gap-2" data-testid="lost-open">
            <LifeBuoy className="w-[18px] h-[18px]" /> Ho perso il gruppo
          </button>
        ))}
      </section>

      {/* Ritrovo */}
      <section className="space-y-2.5">
        <Heading>Ritrovo</Heading>
        {m.fixed && !m.iAmLost && <FixedCard m={m.fixed} myUid={user.id} onRoute={onRoute} />}
        {m.meetups.map((mt) => (
          <MeetupCard key={mt.id} m={mt} model={m} byName={nameOf} onRoute={onRoute} />
        ))}
        {!m.fixed && m.meetups.length === 0 && (
          <p className="rounded-2xl bg-app-surface border border-dashed border-app-control p-4 text-[13.5px] text-app-muted leading-snug">Nessun ritrovo in programma. Fissa dove e quando vedervi: il gruppo viene avvisato subito.</p>
        )}
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={() => m.setSheet('meetup')} className={btnRaised} data-testid="meetup-new"><Plus className="w-[18px] h-[18px]" /> Fissa un ritrovo</button>
          <button type="button" onClick={() => m.setSheet('fixed')} className={btnRaised} data-testid="fixed-new"><Flag className="w-[18px] h-[18px]" /> {m.fixed ? 'Cambia punto fisso' : 'Punto fisso'}</button>
        </div>
      </section>

      {/* Privacy */}
      <section className="rounded-2xl bg-app-surface border border-app-line p-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-app-text">Posizione condivisibile</p>
          <p className="mt-0.5 text-[13px] text-app-muted leading-snug" data-testid="share-allowed-hint">
            {allowed ? 'Si attiva solo quando lo decidi tu.' : 'Spenta: nessuno vede dove sei, nemmeno se perdi il gruppo.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowed}
          aria-label="Posizione condivisibile"
          onClick={() => setSharingAllowed(!allowed)}
          className={`relative w-14 h-8 rounded-full shrink-0 transition-colors ${allowed ? 'bg-app-accent' : 'bg-app-raised border border-app-control'}`}
          data-testid="share-allowed"
          data-keep-color
        >
          <span className={`absolute top-1 left-1 w-6 h-6 rounded-full transition-transform ${allowed ? 'translate-x-6 bg-app-on-accent' : 'bg-slate-300'}`} />
        </button>
      </section>
      {m.sheet && <MeetupSheet fixed={m.sheet === 'fixed'} onClose={() => m.setSheet(null)} />}
    </div>
  );
};

/* ---------- Scheda "Persone" ---------- */

const PeoplePanel: React.FC<Pick<Props, 'meId' | 'group' | 'travelers' | 'onOpenMember'>> = ({ meId, group, travelers, onOpenMember }) => (
  <div className="space-y-3">
    <p className="px-1 text-[13px] text-app-muted leading-snug">{group.length} su {travelers.length} registrati con Google. Tocca un partecipante per vedere cosa ha scelto di condividere.</p>
    <ul className="space-y-2.5">
      {travelers.map((slot) => {
        const member = group.find((x) => x.travelerId === slot.id);
        if (!member) {
          return (
            <li key={slot.id} className="rounded-2xl border border-dashed border-app-control p-4 flex items-center gap-3 text-app-muted">
              <UserPlus className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-[14.5px] font-semibold">Posto {slot.id.slice(1)} libero</p>
                <p className="text-[13px] leading-snug">In attesa che un amico acceda con Google e completi il profilo.</p>
              </div>
            </li>
          );
        }
        const isMe = member.id === meId;
        const vote = member.accommodationPreference ? ACCOMMODATIONS.find((a) => a.id === member.accommodationPreference) : null;
        const wa = member.phone.replace(/[^0-9]/g, '');
        return (
          <li key={slot.id} className={`rounded-2xl bg-app-surface border flex items-center ${isMe ? 'border-app-accent/50' : 'border-app-line'}`}>
            <button type="button" onClick={() => onOpenMember(member.id)} aria-label={`Dettagli di ${member.firstName} ${member.lastName}`} className="flex-1 min-w-0 flex items-center gap-3 p-3.5 text-left">
              <Person name={`${member.firstName.slice(0, 1)}${member.lastName.slice(0, 1)}`} url={member.avatarUrl} color={slot.color} size="w-12 h-12" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-bold text-app-text truncate">
                  {member.firstName} {member.lastName}
                  {isMe && <span className="ml-1.5 text-[11px] font-bold uppercase tracking-wider text-app-accent">Tu</span>}
                </span>
                <span className="block text-[13px] text-slate-300 truncate">{member.dietaryPreference}</span>
                <span className="block text-[13px] text-app-muted truncate">{vote ? `Alloggio ${vote.code} · ${vote.district}` : 'Nessun voto sull’alloggio'}</span>
              </span>
              {isMe && <ChevronRight className="w-5 h-5 text-app-muted shrink-0" aria-hidden />}
            </button>
            {!isMe && (
              <div className="flex items-center gap-1.5 pr-3 shrink-0">
                <a href={`tel:${member.phone}`} aria-label={`Chiama ${member.firstName}`} className="w-11 h-11 rounded-xl bg-app-raised border border-app-control text-app-text flex items-center justify-center"><Phone className="w-[18px] h-[18px]" /></a>
                {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label={`Scrivi a ${member.firstName} su WhatsApp`} className="w-11 h-11 rounded-xl bg-app-raised border border-app-control text-app-text flex items-center justify-center"><MessageCircle className="w-[18px] h-[18px]" /></a>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  </div>
);

/* ---------- Scheda "Preparativi" ---------- */

const PrepPanel: React.FC<Pick<Props, 'meId' | 'group' | 'travelers' | 'checklists' | 'checklistError' | 'onToggleCheck'>> = ({ meId, group, travelers, checklists, checklistError, onToggleCheck }) => {
  const total = CHECKLIST_ITEMS.length;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-app-surface border border-app-line p-4 space-y-3">
        <div>
          <h3 className="text-[16px] font-bold text-app-text">A che punto siamo</h3>
          <p className="mt-0.5 text-[13px] text-app-muted leading-snug">Spunta le tue caselle quando fai un passo: gli altri vedono subito chi è già a posto.</p>
        </div>
        <ul className="space-y-2.5">
          {travelers.map((slot) => {
            const member = group.find((x) => x.travelerId === slot.id);
            const done = member ? countDone(checklists[member.id]) : 0;
            return (
              <li key={slot.id} className="flex items-center gap-3">
                <Person name={member ? `${member.firstName.slice(0, 1)}${member.lastName.slice(0, 1)}` : '?'} url={member?.avatarUrl} color={member ? slot.color : '#334155'} size="w-8 h-8" />
                <span className="w-16 text-[13.5px] text-app-text truncate">{member ? (member.id === meId ? 'Tu' : member.firstName) : 'Libero'}</span>
                <div className="flex-1 h-2 rounded-full bg-app-raised overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={`Preparativi di ${member ? member.firstName : `posto ${slot.id.slice(1)}`}`}>
                  <div className="h-full rounded-full bg-fam-group transition-all" style={{ width: `${(done / total) * 100}%` }} />
                </div>
                <span className={`w-10 text-right text-[13px] font-mono ${done === total && member ? 'text-fam-group font-bold' : 'text-app-muted'}`}>{done}/{total}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <ul className="rounded-2xl bg-app-surface border border-app-line divide-y divide-app-line overflow-hidden">
        {CHECKLIST_ITEMS.map((item) => (
          <li key={item.key} className="p-4">
            <p className="text-[15px] font-semibold text-app-text leading-snug">{item.label}</p>
            <p className="mt-0.5 text-[13px] text-app-muted leading-snug">{item.hint}</p>
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {travelers.map((slot) => {
                const member = group.find((x) => x.travelerId === slot.id);
                const isMe = !!member && member.id === meId;
                const done = !!member && checklists[member.id]?.[item.key] === true;
                const who = member ? (isMe ? 'Tu' : member.firstName) : 'Libero';
                if (isMe) {
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => onToggleCheck(item.key)}
                      aria-pressed={done}
                      aria-label={`${item.label}: ${done ? 'fatto, tocca per togliere' : 'da fare, tocca per segnare come fatto'}`}
                      className={`min-h-[48px] rounded-xl border-2 text-[13px] font-bold flex items-center justify-center gap-1 active:scale-95 ${done ? 'bg-fam-group border-fam-group text-app-on-accent' : 'border-app-accent text-app-accent'}`}
                      data-keep-color
                    >
                      {done && <Check className="w-4 h-4" strokeWidth={3} />} {who}
                    </button>
                  );
                }
                return (
                  <span
                    key={slot.id}
                    role="img"
                    aria-label={`${member ? member.firstName : `Posto ${slot.id.slice(1)}`}: ${item.label} ${done ? 'fatto' : member ? 'da fare' : 'non disponibile'}`}
                    className={`min-h-[48px] rounded-xl border text-[12.5px] font-semibold flex items-center justify-center gap-1 truncate px-1 ${done ? 'bg-fam-group/15 border-fam-group/40 text-fam-group' : member ? 'border-app-line text-app-muted' : 'border-dashed border-app-line text-app-muted/70'}`}
                  >
                    {done && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />}<span className="truncate">{who}</span>
                  </span>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {checklistError && <p className="text-[13px] text-fam-sos">{checklistError}</p>}
    </div>
  );
};

/* ---------- Pagina ---------- */

export const PhoneGroupView: React.FC<Props> = (p) => {
  const [tab, setTab] = useState<PhoneTab>('now');
  // + → Ritrovo / Ho perso il gruppo: la scheda "Adesso" si apre da sola
  const model = useGroupLiveModel({ onIntent: () => setTab('now') });
  const anyLost = model.iAmLost || model.slots.some((s) => s !== model.slot && model.statusOf(s).lost);
  const myDone = p.meId ? countDone(p.checklists[p.meId]) : 0;
  const total = CHECKLIST_ITEMS.length;
  const tabs: { id: PhoneTab; label: string; badge?: React.ReactNode }[] = [
    { id: 'now', label: 'Adesso', badge: anyLost ? <span className="w-2 h-2 rounded-full bg-fam-sos" aria-label="Qualcuno ha perso il gruppo" /> : undefined },
    { id: 'people', label: 'Persone', badge: <span className="text-[11px] font-mono opacity-80">{p.group.length}</span> },
    { id: 'prep', label: 'Preparativi', badge: p.meId && myDone < total ? <span className="text-[11px] font-mono opacity-80">{myDone}/{total}</span> : undefined }
  ];
  return (
    <div className="space-y-4 animate-in fade-in duration-200" data-testid="phone-group">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-app-surface border border-app-line" role="tablist" aria-label="Sezioni del gruppo">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`pg-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`pg-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`min-h-[44px] rounded-xl text-[13.5px] font-bold flex items-center justify-center gap-1.5 ${tab === t.id ? 'bg-app-accent text-app-on-accent' : 'text-app-muted'}`}
            data-testid={`pg-tab-${t.id}`}
            data-keep-color
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      <div id="pg-panel-now" role="tabpanel" aria-labelledby="pg-tab-now" className={tab === 'now' ? '' : 'hidden'}>
        <NowPanel model={model} group={p.group} travelers={p.travelers} onRoute={p.onRoute} onShowMap={p.onShowMap} />
      </div>
      <div id="pg-panel-people" role="tabpanel" aria-labelledby="pg-tab-people" className={tab === 'people' ? '' : 'hidden'}>
        <PeoplePanel meId={p.meId} group={p.group} travelers={p.travelers} onOpenMember={p.onOpenMember} />
      </div>
      <div id="pg-panel-prep" role="tabpanel" aria-labelledby="pg-tab-prep" className={tab === 'prep' ? '' : 'hidden'}>
        <PrepPanel meId={p.meId} group={p.group} travelers={p.travelers} checklists={p.checklists} checklistError={p.checklistError} onToggleCheck={p.onToggleCheck} />
      </div>
    </div>
  );
};
