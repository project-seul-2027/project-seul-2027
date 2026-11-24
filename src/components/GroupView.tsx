import React, { useEffect, useState } from 'react';
import { Users, Phone, Utensils, Home, UserPlus, MessageCircle, X, Lock, Check, ClipboardCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ACCOMMODATIONS } from '../data/tripData';
import { OPTIONAL_SHARE_FIELDS, type GroupMember, type OptionalShareField } from '../shared/travelerProfile';
import { CHECKLIST_ITEMS, countDone } from '../shared/tripChecklist';
import { useGroupChecklists } from './useGroupChecklists';
import { GroupLiveCard } from './group/GroupLive';
import { GroupPollsPanel } from './group/GroupPollsPanel';
import { BookingsPanel } from './group/BookingsPanel';
import { PhoneGroupView } from './mobile/PhoneGroup';
import { useMediaQuery } from '../pwa';

const FIELD_LABELS: Record<OptionalShareField, string> = {
  birthDate: 'Data di nascita',
  hasPassport: 'Passaporto',
  passportExpiry: 'Scadenza passaporto',
  passportNumber: 'Numero passaporto',
  ketaStatus: 'Stato KETA',
  travelInsurance: 'Assicurazione di viaggio',
  emergencyContactName: 'Contatto di emergenza',
  emergencyContactPhone: 'Tel. contatto di emergenza',
  allergies: 'Allergie',
  dailyBudgetGoal: 'Budget giornaliero',
  notes: 'Note'
};

const formatValue = (key: OptionalShareField, value: unknown): string => {
  if (value === undefined || value === null || value === '') return '—';
  if (key === 'hasPassport') return value ? 'Sì' : 'No';
  if (key === 'birthDate' || key === 'passportExpiry') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
  }
  return String(value);
};

const MobileMemberSheet: React.FC<{ member: GroupMember; shown: OptionalShareField[]; hidden: number; onClose: () => void }> = ({ member, shown, hidden, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-end" role="dialog" aria-modal="true" aria-labelledby="member-sheet-title" data-testid="member-sheet">
    <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-black/60 motion-safe:animate-in motion-safe:fade-in duration-200" />
    <section className="relative flex w-full max-h-[92dvh] min-h-[58dvh] flex-col overflow-hidden rounded-t-2xl bg-[#0a1119] opacity-100 shadow-[0_-8px_30px_rgba(0,0,0,0.38)] motion-safe:animate-in motion-safe:slide-in-from-bottom-4 duration-200">
      <div className="shrink-0 bg-[#0a1119] px-5 pt-3">
        <div className="mx-auto h-1 w-9 rounded-full bg-white/20" aria-hidden />
        <div className="mt-3 flex items-start justify-between gap-4 pb-5">
          <div className="flex min-w-0 items-center gap-3.5">
            {member.avatarUrl ? (
              <img src={member.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-16 w-16 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#152231] text-[17px] font-bold text-[#eaf0f6]">
                {member.firstName.slice(0, 1)}{member.lastName.slice(0, 1)}
              </span>
            )}
            <div className="min-w-0">
              <h2 id="member-sheet-title" className="font-['Outfit'] text-[26px] font-medium tracking-[-0.025em] text-[#eaf0f6] truncate">{member.firstName} {member.lastName}</h2>
              {member.displayName !== `${member.firstName} ${member.lastName}` && <p className="mt-0.5 text-[13px] text-[#97a5b9] truncate">{member.displayName}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#c3cfdd] transition-colors active:bg-[#152231] focus-visible:outline-2 focus-visible:outline-[#52d9e6]" aria-label="Chiudi">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {shown.length > 0 ? (
          <section className="pt-1">
            <h3 className="mb-3 text-[17px] font-semibold tracking-[-0.02em] text-[#eaf0f6]">Informazioni condivise</h3>
            <dl className="overflow-hidden rounded-xl bg-[#101c29] divide-y divide-white/10">
              {shown.map((key) => (
                <div key={key} className="px-4 py-3.5">
                  <dt className="text-[12px] font-medium text-[#97a5b9]">{FIELD_LABELS[key]}</dt>
                  <dd className="mt-1 text-[15px] leading-snug text-[#eaf0f6] break-words whitespace-pre-wrap">{formatValue(key, member[key])}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : (
          <section className="pt-1">
            <h3 className="mb-3 text-[17px] font-semibold tracking-[-0.02em] text-[#eaf0f6]">Informazioni condivise</h3>
            <p className="rounded-xl bg-[#101c29] px-4 py-4 text-[14px] leading-snug text-[#97a5b9]">Non ha condiviso altre informazioni con il gruppo.</p>
          </section>
        )}

        {hidden > 0 && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-[#152231] px-4 py-3.5 text-[13px] leading-snug text-[#97a5b9]">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#c3cfdd]" />
            {hidden} {hidden === 1 ? 'informazione resta privata' : 'informazioni restano private'}.
          </p>
        )}
      </div>
    </section>
  </div>
);

/** Dettaglio di un partecipante: solo i campi opzionali che ha deciso di rendere visibili al gruppo. */
const MemberSheet: React.FC<{ member: GroupMember; color: string; onClose: () => void }> = ({
  member,
  color,
  onClose
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // I profili salvati prima dei campi condivisi non hanno `shared`: va trattato come lista vuota
  const sharedList = member.shared ?? [];
  const shown = OPTIONAL_SHARE_FIELDS.filter((k) => sharedList.includes(k));
  const hidden = OPTIONAL_SHARE_FIELDS.length - shown.length;
  const isMobile = useMediaQuery('(max-width: 1023.98px)');

  if (isMobile) return <MobileMemberSheet member={member} shown={shown} hidden={hidden} onClose={onClose} />;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" data-testid="member-sheet">
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-black/70 max-lg:bg-black/55 motion-safe:animate-in motion-safe:fade-in duration-200" />
      <div className="relative w-full sm:max-w-md max-h-[85vh] max-lg:max-h-[88vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-800 max-lg:bg-[#0a1119] max-lg:border-0 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4 motion-safe:animate-in motion-safe:slide-in-from-bottom-4 duration-200">
        <div className="sm:hidden w-9 h-1 rounded-full bg-white/20 mx-auto -mt-1 mb-4" aria-hidden />
        <div className="flex items-start gap-3.5">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-12 h-12 max-lg:w-14 max-lg:h-14 rounded-full border-2 max-lg:border-0 shrink-0"
              style={{ borderColor: color }}
            />
          ) : (
            <div
              className="w-12 h-12 max-lg:w-14 max-lg:h-14 rounded-full flex items-center justify-center font-bold text-white shrink-0"
              style={{ backgroundColor: color }}
            >
              {member.firstName.slice(0, 1)}
              {member.lastName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold max-lg:font-['Outfit'] max-lg:text-[24px] max-lg:tracking-[-0.02em] text-white truncate">
              {member.firstName} {member.lastName}
            </div>
            {member.displayName !== `${member.firstName} ${member.lastName}` && <div className="mt-0.5 text-xs max-lg:text-[13px] text-slate-400 max-lg:text-[#97a5b9] truncate">{member.displayName}</div>}
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 max-lg:text-[#c3cfdd] transition-colors active:bg-[#152231] hover:text-white" aria-label="Chiudi">
            <X className="w-5 h-5" />
          </button>
        </div>

        {shown.length > 0 ? (
          <dl className="grid gap-3 max-lg:mt-2 max-lg:gap-0 max-lg:border-t max-lg:border-white/10 max-lg:divide-y max-lg:divide-white/10 text-sm">
            {shown.map((key) => (
              <div key={key} className="grid grid-cols-[9rem_1fr] gap-2 max-lg:grid-cols-1 max-lg:gap-1 max-lg:py-3.5">
                <dt className="text-xs max-lg:text-[12px] max-lg:font-medium text-slate-400 max-lg:text-[#97a5b9]">{FIELD_LABELS[key]}</dt>
                <dd className="text-slate-100 max-lg:text-[#eaf0f6] break-words whitespace-pre-wrap">{formatValue(key, member[key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="border-t border-white/10 pt-4 text-sm text-slate-400 max-lg:text-[#97a5b9]">Non ha condiviso altre informazioni.</p>
        )}

        {hidden > 0 && (
          <p className="flex items-center gap-1.5 pt-1 text-[11px] max-lg:text-[12px] text-slate-500 max-lg:text-[#97a5b9]">
            <Lock className="w-3 h-3" />
            {hidden} {hidden === 1 ? 'informazione resta privata' : 'informazioni restano private'}
          </p>
        )}
      </div>
    </div>
  );
};

/** Elenco dei partecipanti registrati con Google: contatti e preferenze condivise. */
export const GroupView: React.FC<{ onRoute?: (placeId: string) => void; onShowMap?: () => void }> = ({ onRoute, onShowMap }) => {
  const { user, group, travelers } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const { all: checklists, toggle, error: checklistError } = useGroupChecklists(user?.id);
  const openMember = group.find((m) => m.id === openId) ?? null;
  const openSlot = openMember ? travelers.find((s) => s.id === openMember.travelerId) : undefined;
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Telefono: tre schede (Adesso · Persone · Preparativi); desktop e tablet restano come prima
  if (!isDesktop) {
    return (
      <>
        <PhoneGroupView
          meId={user?.id}
          group={group}
          travelers={travelers}
          checklists={checklists}
          checklistError={checklistError}
          onToggleCheck={(key) => void toggle(key)}
          onOpenMember={setOpenId}
          onRoute={onRoute}
          onShowMap={onShowMap}
        />
        {openMember && <MemberSheet member={openMember} color={openSlot?.color ?? '#22d3ee'} onClose={() => setOpenId(null)} />}
      </>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-x-12 lg:gap-y-6 lg:items-start">
      <div className="flex items-start gap-3 lg:col-span-2">
        <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display text-white">Partecipanti</h2>
          <p className="text-xs text-slate-400">
            {group.length} su 4 registrati con Google · aggiornato in tempo reale. Tocca un partecipante per vedere
            le informazioni che ha scelto di condividere.
          </p>
        </div>
      </div>

      <GroupLiveCard onRoute={onRoute} onShowMap={onShowMap} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 lg:col-start-2 lg:row-start-2 lg:row-span-2">
        {travelers.map((slot) => {
          const member = group.find((m) => m.travelerId === slot.id);
          const vote = member?.accommodationPreference
            ? ACCOMMODATIONS.find((a) => a.id === member.accommodationPreference)
            : null;
          const isMe = member && member.id === user?.id;
          const waNumber = member?.phone.replace(/[^0-9]/g, '');

          if (!member) {
            return (
              <div
                key={slot.id}
                className={isDesktop ? 'p-5 rounded-3xl bg-white/[0.03] flex items-center gap-4 text-sm text-slate-500' : 'p-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 flex items-center gap-3 text-sm text-slate-500'}
              >
                <UserPlus className="w-5 h-5 shrink-0" />
                <div>
                  <div className="font-semibold text-slate-400">Posto {slot.id.slice(1)} libero</div>
                  <div className="text-xs">In attesa che un amico acceda con Google e completi il profilo.</div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={slot.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(member.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpenId(member.id);
                }
              }}
              aria-label={`Dettagli di ${member.firstName} ${member.lastName}`}
              className={`p-5 rounded-2xl border bg-slate-900/80 space-y-4 cursor-pointer hover:border-cyan-500/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
                isMe ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full border-2 shrink-0"
                    style={{ borderColor: slot.color }}
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                    style={{ backgroundColor: slot.color }}
                  >
                    {member.firstName.slice(0, 1)}
                    {member.lastName.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">
                    {member.firstName} {member.lastName} {isMe && <span className="text-cyan-400 text-xs">(tu)</span>}
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Posto {slot.id.slice(1)}
                    {member.displayName !== `${member.firstName} ${member.lastName}` && ` · “${member.displayName}”`}
                  </div>
                </div>
              </div>

              <dl className="grid gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <dt className="sr-only">Telefono</dt>
                  <dd className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`tel:${member.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-slate-200 hover:text-cyan-300"
                    >
                      {member.phone}
                    </a>
                    {waNumber && (
                      <a
                        href={`https://wa.me/${waNumber}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                      >
                        <MessageCircle className="w-3 h-3" />
                        WhatsApp
                      </a>
                    )}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <Utensils className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <dt className="sr-only">Alimentazione</dt>
                  <dd className="text-slate-300">{member.dietaryPreference}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <Home className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <dt className="sr-only">Voto alloggio</dt>
                  <dd className="text-slate-300">
                    {vote ? (
                      <>
                        Vota <strong className="text-white">alloggio {vote.code}</strong> · {vote.district}
                      </>
                    ) : (
                      <span className="text-slate-500">Nessun voto sull'alloggio</span>
                    )}
                  </dd>
                </div>
              </dl>

              {(() => {
                const done = countDone(checklists[member.id]);
                const total = CHECKLIST_ITEMS.length;
                return (
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-400">Preparativi</span>
                      <span className={done === total ? 'text-emerald-400 font-bold' : 'text-slate-300 font-mono'}>
                        {done === total ? 'Tutto pronto' : `${done}/${total}`}
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={total}
                      aria-valuenow={done}
                      aria-label={`Preparativi di ${member.firstName}`}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(done / total) * 100}%`, backgroundColor: done === total ? '#34d399' : slot.color }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Sondaggi lampo e Prenotazioni / scadenze condivise */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <GroupPollsPanel />
        <BookingsPanel />
      </div>

      {/* Checklist dei preparativi: righe = cosa fare, colonne = i 4 posti. Ognuno spunta solo le proprie caselle. */}
      <section className={isDesktop ? 'rounded-3xl bg-white/[0.03] overflow-hidden' : 'rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden'} aria-labelledby="checklist-title">
        <div className="flex items-start gap-3 p-4 pb-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 id="checklist-title" className="font-bold text-white">A che punto siamo</h3>
            <p className="text-xs text-slate-400">
              Spunta le tue caselle quando fai un passo: gli altri vedono subito chi è già a posto e chi no.
            </p>
          </div>
        </div>

        <div className="px-4 pb-4 overflow-x-auto">
          <div
            className="grid items-stretch min-w-[19rem]"
            style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(4, 2.75rem)' }}
          >
            <div />
            {travelers.map((slot) => {
              const m = group.find((g) => g.travelerId === slot.id);
              const isMe = !!m && m.id === user?.id;
              return (
                <div key={slot.id} className="flex flex-col items-center gap-1.5 pb-2 pt-1" title={m ? `${m.firstName} ${m.lastName}` : `Posto ${slot.id.slice(1)} libero`}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white overflow-hidden ${m ? '' : 'opacity-30'} ${isMe ? 'ring-2 ring-cyan-400' : ''}`}
                    style={{ backgroundColor: slot.color }}
                  >
                    {m?.avatarUrl ? (
                      <img src={m.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : m ? (
                      <>
                        {m.firstName.slice(0, 1)}
                        {m.lastName.slice(0, 1)}
                      </>
                    ) : (
                      '?'
                    )}
                  </div>
                  <span className={`text-[10px] leading-none max-w-full truncate ${isMe ? 'text-cyan-300 font-bold' : 'text-slate-500'}`}>
                    {m ? (isMe ? 'Tu' : m.firstName) : 'Libero'}
                  </span>
                </div>
              );
            })}

            {CHECKLIST_ITEMS.map((item) => (
              <React.Fragment key={item.key}>
                <div className="py-2 pr-2 border-t border-slate-800/80 min-w-0">
                  <div className="text-sm text-slate-100 leading-tight">{item.label}</div>
                  <div className="text-[11px] text-slate-500 leading-snug">{item.hint}</div>
                </div>
                {travelers.map((slot) => {
                  const m = group.find((g) => g.travelerId === slot.id);
                  const isMe = !!m && m.id === user?.id;
                  const done = !!m && checklists[m.id]?.[item.key] === true;
                  const base = 'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors';
                  const look = done
                    ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                    : m
                      ? 'border-slate-700 text-transparent'
                      : 'border-slate-800 border-dashed text-transparent';
                  return (
                    <div key={slot.id} className="py-1.5 border-t border-slate-800/80 flex items-center justify-center">
                      {isMe ? (
                        <button
                          type="button"
                          onClick={() => void toggle(item.key)}
                          aria-pressed={done}
                          aria-label={`${item.label}: ${done ? 'fatto, tocca per togliere' : 'da fare, tocca per segnare come fatto'}`}
                          className={`${base} ${look} ${done ? '' : 'hover:border-cyan-400'} active:scale-90`}
                        >
                          <Check className="w-4 h-4" strokeWidth={3} />
                        </button>
                      ) : (
                        <span
                          role="img"
                          aria-label={`${m ? m.firstName : `Posto ${slot.id.slice(1)}`}: ${item.label} ${done ? 'fatto' : m ? 'da fare' : 'non disponibile'}`}
                          className={`${base} ${look}`}
                        >
                          <Check className="w-4 h-4" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          {checklistError && <p className="mt-2 text-xs text-red-400">{checklistError}</p>}
        </div>
      </section>


      {openMember && (
        <MemberSheet
          member={openMember}
          color={openSlot?.color ?? '#22d3ee'}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
};
