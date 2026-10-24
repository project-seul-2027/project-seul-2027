/**
 * Account e dati condivisi del gruppo su Firebase.
 *
 * - Accesso: SOLO con Google (Firebase Authentication, provider Google). Nessun altro metodo.
 * - Firestore:
 *     users/{uid}     profilo completo (privato: lo legge solo il titolare)
 *     members/{uid}   dati condivisi col gruppo (nome, posto, telefono, dieta, voto alloggio)
 *     slots/{t1..t4}  { uid } → garantisce un solo partecipante per posto
 *     config/access   { emails: [...] } → lista dei partecipanti ammessi (si modifica solo dalla console)
 * Le regole in `firestore.rules` fanno rispettare tutto questo lato server.
 */
import {
  GoogleAuthProvider,
  deleteUser,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  writeBatch,
  type FirestoreError
} from 'firebase/firestore';
import { firebase } from '../firebase/client';
import { buildGroupMember } from '../shared/travelerProfile';
import type {
  AccommodationId,
  GroupMember,
  TravelerProfileInput,
  TravelerSlotId,
  UserAccount
} from '../shared/travelerProfile';

export type { UserAccount, GroupMember, TravelerProfileInput } from '../shared/travelerProfile';

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public fieldErrors?: Partial<Record<keyof TravelerProfileInput, string>>
  ) {
    super(message);
  }
}

/** L'account Google non è nella lista dei partecipanti (config/access). */
export class NotAllowedError extends ApiError {
  constructor(email: string) {
    super(
      'not-allowed',
      `L'account ${email} non è nella lista dei partecipanti al viaggio. Chiedi all'organizzatore di aggiungerlo.`
    );
  }
}

function isPermissionDenied(err: unknown): boolean {
  return (err as FirestoreError)?.code === 'permission-denied';
}

function friendlyAuthError(err: unknown): ApiError {
  const code = (err as { code?: string })?.code ?? 'unknown';
  const messages: Record<string, string> = {
    'auth/popup-closed-by-user': 'Hai chiuso la finestra di Google prima di completare l\'accesso.',
    'auth/cancelled-popup-request': 'Accesso annullato.',
    'auth/popup-blocked': 'Il browser ha bloccato la finestra di Google: consenti i popup per questo sito e riprova.',
    'auth/unauthorized-domain':
      'Questo indirizzo non è autorizzato in Firebase (Authentication → Impostazioni → Domini autorizzati).',
    'auth/operation-not-allowed': 'L\'accesso con Google non è attivo in Firebase (Authentication → Metodo di accesso).',
    'auth/network-request-failed': 'Connessione assente o instabile. Riprova.'
  };
  return new ApiError(code, messages[code] ?? `Accesso non riuscito (${code}).`);
}

const userRef = (uid: string) => doc(firebase().db, 'users', uid);
const memberRef = (uid: string) => doc(firebase().db, 'members', uid);
const slotRef = (slot: TravelerSlotId) => doc(firebase().db, 'slots', slot);

export const authApi = {
  /** Osserva lo stato di accesso Firebase. */
  watchAuth(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(firebase().auth, callback);
  },

  /** Apre la finestra "Accedi con Google". */
  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(firebase().auth, provider);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      // App installata o browser che non permette la finestra di Google: si passa al reindirizzamento
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(firebase().auth, provider);
          return;
        } catch (redirectErr) {
          throw friendlyAuthError(redirectErr);
        }
      }
      throw friendlyAuthError(err);
    }
  },

  /** Esito di un accesso con reindirizzamento (null se non ce n'è uno in corso). */
  async completeRedirectSignIn(): Promise<void> {
    try {
      await getRedirectResult(firebase().auth);
    } catch (err) {
      throw friendlyAuthError(err);
    }
  },

  async signOut(): Promise<void> {
    await firebaseSignOut(firebase().auth);
  },

  /**
   * Carica l'account dell'utente Google. Se il profilo non esiste ancora restituisce una bozza
   * (profileCompleted: false) precompilata con nome e cognome di Google.
   * Se l'email non è tra i partecipanti, le regole Firestore negano la lettura → NotAllowedError.
   */
  async loadAccount(user: User): Promise<UserAccount> {
    let snap;
    try {
      snap = await getDoc(userRef(user.uid));
    } catch (err) {
      if (isPermissionDenied(err)) throw new NotAllowedError(user.email ?? 'sconosciuto');
      throw err;
    }
    const googlePhotoUrl = user.photoURL ?? '';
    const google = {
      email: (user.email ?? '').toLowerCase(),
      googleName: user.displayName ?? '',
      googlePhotoUrl
    };
    if (snap.exists()) {
      const stored = snap.data() as UserAccount;
      // Foto propria (se caricata) oppure quella di Google
      const avatarUrl = stored.customAvatar || googlePhotoUrl;
      return { ...stored, ...google, avatarUrl, id: user.uid };
    }
    const [firstName = '', ...rest] = (user.displayName ?? '').split(' ');
    const now = new Date().toISOString();
    return {
      id: user.uid,
      ...google,
      avatarUrl: googlePhotoUrl,
      firstName,
      lastName: rest.join(' '),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
      profileCompleted: false
    };
  },

  /** Salva il profilo completo + i dati condivisi + il posto nel gruppo, in un'unica scrittura atomica. */
  async saveProfile(account: UserAccount, input: TravelerProfileInput): Promise<UserAccount> {
    const now = new Date().toISOString();
    const next: UserAccount = {
      ...account,
      ...input,
      avatarUrl: input.customAvatar || account.googlePhotoUrl || '',
      updatedAt: now,
      lastLoginAt: now,
      profileCompleted: true
    };
    const member = buildGroupMember(account.id, input, input.customAvatar || account.googlePhotoUrl || '');

    const previousSlot = account.profileCompleted ? account.travelerId : undefined;
    const batch = writeBatch(firebase().db);
    batch.set(userRef(account.id), next);
    batch.set(memberRef(account.id), member);
    if (previousSlot !== input.travelerId) {
      batch.set(slotRef(input.travelerId), { uid: account.id });
      if (previousSlot) batch.delete(slotRef(previousSlot));
    }

    try {
      await batch.commit();
    } catch (err) {
      if (isPermissionDenied(err) && previousSlot !== input.travelerId) {
        throw new ApiError('slot-taken', 'Il posto scelto è già occupato da un altro partecipante.', {
          travelerId: 'Posto già occupato: scegline un altro.'
        });
      }
      if (isPermissionDenied(err)) {
        throw new ApiError('denied', 'Salvataggio rifiutato dal database: controlla i dati e riprova.');
      }
      throw err;
    }
    return next;
  },

  /** Voto (o ritiro del voto) per un alloggio. */
  async voteAccommodation(account: UserAccount, accommodationId: AccommodationId | null): Promise<UserAccount> {
    const updatedAt = new Date().toISOString();
    const batch = writeBatch(firebase().db);
    batch.update(userRef(account.id), { accommodationPreference: accommodationId, updatedAt });
    batch.update(memberRef(account.id), { accommodationPreference: accommodationId });
    await batch.commit();
    return { ...account, accommodationPreference: accommodationId, updatedAt };
  },

  /** Partecipanti registrati, aggiornati in tempo reale. */
  watchGroup(callback: (members: GroupMember[]) => void, onError?: (err: Error) => void): () => void {
    return onSnapshot(
      collection(firebase().db, 'members'),
      (snap) => callback(snap.docs.map((d) => d.data() as GroupMember)),
      (err) => onError?.(err)
    );
  },

  /** Elimina profilo, dati condivisi, posto e (se possibile) l'utente Firebase. */
  async deleteAccount(account: UserAccount): Promise<void> {
    const batch = writeBatch(firebase().db);
    batch.delete(memberRef(account.id));
    if (account.profileCompleted && account.travelerId) batch.delete(slotRef(account.travelerId));
    batch.delete(userRef(account.id));
    await batch.commit();

    const current = firebase().auth.currentUser;
    try {
      if (current) await deleteUser(current);
    } catch {
      // Firebase può chiedere un accesso recente: i dati sono già cancellati, basta uscire
      await firebaseSignOut(firebase().auth);
    }
  }
};
