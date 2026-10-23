import React, { useState } from 'react';
import { ShieldCheck, Wallet, Home, Users, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

/** Schermata d'ingresso: l'unico modo per entrare è l'account Google. */
export const LoginScreen: React.FC = () => {
  const { configured, authError, signIn } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const error = authError;

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signIn();
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(60% 45% at 20% 10%, rgba(6,182,212,0.14), transparent 70%), radial-gradient(50% 40% at 85% 90%, rgba(99,102,241,0.12), transparent 70%)'
        }}
      />

      <div className="relative w-full max-w-md space-y-6">
        <div className="flex items-center gap-2.5 justify-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
            KR
          </div>
          <div>
            <div className="font-display font-extrabold text-lg tracking-tight text-white leading-none">SEUL 2027</div>
            <div className="text-[11px] text-slate-400 font-mono">2 – 19 marzo · 4 persone · 17 notti</div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 backdrop-blur">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-extrabold font-display text-white">Accedi al viaggio</h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Il portale è riservato ai partecipanti. Si entra solo con il proprio account Google: al primo accesso ti
              chiederemo nome, cognome e le informazioni utili per il viaggio.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            {configured ? (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="w-full max-w-xs flex items-center justify-center gap-3 px-5 py-3 rounded-full bg-white hover:bg-slate-100 text-slate-800 font-semibold text-sm shadow-lg transition-colors disabled:opacity-70"
              >
                {isSigningIn ? (
                  <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                ) : (
                  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                )}
                {isSigningIn ? 'Accesso in corso…' : 'Continua con Google'}
              </button>
            ) : (
              <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Firebase non è ancora configurato: compila il file{' '}
                  <code className="font-mono">src/firebase/config.ts</code> con i dati del tuo progetto (vedi README).
                </span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="w-full text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <ul className="grid gap-2.5 text-xs text-slate-300 border-t border-slate-800 pt-5">
            <li className="flex items-center gap-2.5">
              <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
              Il tuo profilo con passaporto e scadenze sempre sotto controllo
            </li>
            <li className="flex items-center gap-2.5">
              <Home className="w-4 h-4 text-blue-400 shrink-0" />
              Voto sull'alloggio salvato e visibile a tutto il gruppo
            </li>
            <li className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-cyan-400 shrink-0" />
              Contatti dei compagni di viaggio sempre a portata di mano
            </li>
          </ul>
        </div>

        <p className="text-[11px] text-slate-500 text-center leading-relaxed px-4">
          Usiamo Google solo per verificare la tua identità (nome, email, foto profilo). Documenti e contatti di
          emergenza restano visibili soltanto a te.
        </p>
      </div>
    </div>
  );
};
