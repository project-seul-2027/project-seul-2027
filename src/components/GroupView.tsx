import React from 'react';
import { Users, Phone, Utensils, Home, UserPlus, MessageCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ACCOMMODATIONS } from '../data/tripData';

/** Elenco dei partecipanti registrati con Google: contatti e preferenze condivise. */
export const GroupView: React.FC = () => {
  const { user, group, travelers } = useAuth();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-start gap-3">
        <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display text-white">Partecipanti</h2>
          <p className="text-xs text-slate-400">
            {group.length} su 4 registrati con Google · aggiornato in tempo reale. Documenti e contatti di emergenza
            restano privati.
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
              className={`p-5 rounded-2xl border bg-slate-900/80 space-y-4 ${
                isMe ? 'border-cyan-500/50 ring-1 ring-cyan-500/20' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                {member.avatarUrl ? (
                  <img
                    src={member.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full border-2"
                    style={{ borderColor: slot.color }}
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white"
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
                    <a href={`tel:${member.phone}`} className="font-mono text-slate-200 hover:text-cyan-300">
                      {member.phone}
                    </a>
                    {waNumber && (
                      <a
                        href={`https://wa.me/${waNumber}`}
                        target="_blank"
                        rel="noreferrer"
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
    </div>
  );
};
