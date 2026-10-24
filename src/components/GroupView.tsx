import React, { useEffect, useState } from 'react';
import { Users, Phone, Utensils, Home, UserPlus, MessageCircle, X, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ACCOMMODATIONS } from '../data/tripData';
import { OPTIONAL_SHARE_FIELDS, type GroupMember, type OptionalShareField } from '../shared/travelerProfile';

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

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Chiudi" onClick={onClose} className="absolute inset-0 bg-black/70" />
      <div className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-800 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 space-y-4">
        <div className="flex items-start gap-3">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-full border-2 shrink-0"
              style={{ borderColor: color }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shrink-0"
              style={{ backgroundColor: color }}
            >
              {member.firstName.slice(0, 1)}
              {member.lastName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-bold text-white truncate">
              {member.firstName} {member.lastName}
            </div>
            <div className="text-xs text-slate-400">“{member.displayName}”</div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white" aria-label="Chiudi">
            <X className="w-5 h-5" />
          </button>
        </div>

        {shown.length > 0 ? (
          <dl className="grid gap-3 text-sm">
            {shown.map((key) => (
              <div key={key} className="grid grid-cols-[9rem_1fr] gap-2">
                <dt className="text-xs text-slate-400">{FIELD_LABELS[key]}</dt>
                <dd className="text-slate-100 break-words whitespace-pre-wrap">{formatValue(key, member[key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-slate-400">Non ha condiviso altre informazioni.</p>
        )}

        {hidden > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3" />
            {hidden} {hidden === 1 ? 'informazione resta privata' : 'informazioni restano private'}
          </p>
        )}
      </div>
    </div>
  );
};

/** Elenco dei partecipanti registrati con Google: contatti e preferenze condivise. */
export const GroupView: React.FC = () => {
  const { user, group, travelers } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const openMember = group.find((m) => m.id === openId) ?? null;
  const openSlot = openMember ? travelers.find((s) => s.id === openMember.travelerId) : undefined;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-start gap-3">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="p-5 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 flex items-center gap-3 text-sm text-slate-500"
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
            </div>
          );
        })}
      </div>

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
