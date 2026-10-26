import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authApi, NotAllowedError } from '../services/authService';
import { isFirebaseConfigured } from '../firebase/client';
import { disablePush } from '../notifications';
import {
  type AccommodationId,
  type CompletedUserAccount,
  type GroupMember,
  type TravelerProfileInput,
  type UserAccount,
  isCompleted
} from '../shared/travelerProfile';
import { TRAVELERS_DEFAULT, type Traveler } from '../data/tripData';

/**
 * loading       → controllo della sessione in corso
 * signedOut     → serve "Accedi con Google"
 * needsProfile  → accesso fatto, ma nome/cognome/info viaggio non ancora compilati
 * ready         → profilo completo, il sito è accessibile
 */
export type AuthStatus = 'loading' | 'signedOut' | 'needsProfile' | 'ready';

interface AuthContextValue {
  status: AuthStatus;
  /** false se src/firebase/config.ts non è ancora stato compilato */
  configured: boolean;
  /** Errore da mostrare nella schermata di accesso (es. account non autorizzato) */
  authError: string | null;
  /** Account grezzo (anche con profilo incompleto) */
  account: UserAccount | null;
  /** Utente con profilo completo (null finché l'onboarding non è terminato) */
  user: CompletedUserAccount | null;
  /** Partecipanti registrati con profilo completo (in tempo reale) */
  group: GroupMember[];
  /** I 4 posti del gruppo con i nomi reali dei partecipanti registrati */
  travelers: Traveler[];
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  saveProfile: (input: TravelerProfileInput) => Promise<void>;
  voteAccommodation: (id: AccommodationId | null) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>(isFirebaseConfigured ? 'loading' : 'signedOut');
  const [authError, setAuthError] = useState<string | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [group, setGroup] = useState<GroupMember[]>([]);
  const [groupLoaded, setGroupLoaded] = useState(false);
  const accountRef = useRef<UserAccount | null>(null);
  accountRef.current = account;

  // Ritorno da un accesso con reindirizzamento (usato se la finestra di Google è bloccata)
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    authApi.completeRedirectSignIn().catch((err) => setAuthError((err as Error).message));
  }, []);

  // Stato di accesso Firebase → carica (o prepara) il profilo
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return authApi.watchAuth(async (firebaseUser) => {
      if (!firebaseUser) {
        setAccount(null);
        setStatus('signedOut');
        return;
      }
      setStatus('loading');
      try {
        const loaded = await authApi.loadAccount(firebaseUser);
        setAuthError(null);
        setAccount(loaded);
      } catch (err) {
        setAuthError(
          err instanceof NotAllowedError
            ? err.message
            : `Impossibile leggere il profilo: ${(err as Error).message}`
        );
        setAccount(null);
        await authApi.signOut();
      }
    });
  }, []);

  // Partecipanti in tempo reale (servono anche durante l'onboarding per vedere i posti occupati)
  const accountId = account?.id;
  useEffect(() => {
    if (!accountId) {
      setGroup([]);
      setGroupLoaded(false);
      return;
    }
    return authApi.watchGroup(
      (members) => {
        setGroup(members);
        setGroupLoaded(true);
      },
      (err) => {
        console.warn('Impossibile leggere il gruppo:', err);
        setGroupLoaded(true);
      }
    );
  }, [accountId]);

  // Lo stato diventa definitivo solo quando profilo e gruppo sono pronti
  useEffect(() => {
    if (!account) return;
    if (!groupLoaded) {
      setStatus('loading');
      return;
    }
    setStatus(isCompleted(account) ? 'ready' : 'needsProfile');
  }, [account, groupLoaded]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    try {
      await authApi.signInWithGoogle();
    } catch (err) {
      setAuthError((err as Error).message);
    }
  }, []);

  const signOut = useCallback(async () => {
    // Prima di uscire: questo telefono non deve più ricevere le notifiche di questo account
    if (accountRef.current) await disablePush(accountRef.current.id).catch(() => undefined);
    await authApi.signOut();
  }, []);

  const saveProfile = useCallback(async (input: TravelerProfileInput) => {
    if (!accountRef.current) throw new Error('Nessun account attivo.');
    setAccount(await authApi.saveProfile(accountRef.current, input));
  }, []);

  const voteAccommodation = useCallback(async (id: AccommodationId | null) => {
    if (!accountRef.current) throw new Error('Nessun account attivo.');
    setAccount(await authApi.voteAccommodation(accountRef.current, id));
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!accountRef.current) return;
    await disablePush(accountRef.current.id).catch(() => undefined);
    await authApi.deleteAccount(accountRef.current);
  }, []);

  const travelers = useMemo<Traveler[]>(
    () =>
      TRAVELERS_DEFAULT.map((slot) => {
        const member = group.find((m) => m.travelerId === slot.id);
        return member ? { ...slot, name: member.displayName } : slot;
      }),
    [group]
  );

  const value: AuthContextValue = {
    status,
    configured: isFirebaseConfigured,
    authError,
    account,
    user: account && isCompleted(account) ? account : null,
    group,
    travelers,
    signIn,
    signOut,
    saveProfile,
    voteAccommodation,
    deleteAccount
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>');
  return ctx;
}
