import React from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ProfileForm } from './ProfileForm';

/** Primo accesso: il profilo viaggiatore va completato prima di entrare nel sito. */
export const OnboardingScreen: React.FC = () => {
  const { account } = useAuth();
  const greeting = account?.firstName || account?.googleName?.split(' ')[0];

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 px-4 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm">
            KR
          </div>
          <span className="font-display font-extrabold text-white tracking-tight">SEUL 2027</span>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-mono text-cyan-400">Passo 2 di 2 · Profilo viaggiatore</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-white">
            {greeting ? `Ciao ${greeting}, completa il tuo profilo` : 'Completa il tuo profilo'}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Ci servono alcune informazioni per organizzare il viaggio: chi sei, come contattarti e i documenti da tenere
            sotto controllo. Potrai modificarle in qualsiasi momento dal menu del tuo account.
          </p>
        </div>

        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-2xl p-5 sm:p-7">
          <ProfileForm mode="onboarding" />
        </div>
      </div>
    </div>
  );
};
