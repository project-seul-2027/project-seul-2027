import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { firebase } from '../firebase/client';

/**
 * Avviso immediato ai telefoni quando il Posto 1 carica un PDF, senza il piano Blaze.
 *
 * Il controllo che manda la notifica è un workflow di GitHub (.github/workflows/pdf-push.yml). Da solo parte ogni
 * poche ore; qui, subito dopo il caricamento, gli si chiede di partire adesso (workflow_dispatch) e la notifica arriva
 * in circa un minuto. Serve un token GitHub con il solo permesso "Actions: lettura e scrittura" su questo repository.
 * Il token sta in appFiles/pdfPushToken, leggibile e scrivibile solo dal Posto 1: si inserisce una volta e vale su
 * tutti i suoi dispositivi. Una copia locale evita di rileggerlo a ogni caricamento.
 */
const KEY = 'seul2027.pdfPushToken';
const REPO = 'IamAxell/project-seul-2027';
const WORKFLOW = 'pdf-push.yml';

export interface TriggerResult {
  ok: boolean;
  message: string;
}

const tokenRef = () => doc(firebase().db, 'appFiles', 'pdfPushToken');

const readLocal = (): string => {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};

const writeLocal = (token: string): void => {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* senza storage si rilegge da Firestore */
  }
};

export const pdfPushTrigger = {
  /** Token salvato per il Posto 1 (da Firestore, con copia locale). Vuoto se non c'è o non si può leggere. */
  async getToken(): Promise<string> {
    try {
      const snap = await getDoc(tokenRef());
      const token = snap.exists() ? String(snap.data().token ?? '') : '';
      writeLocal(token);
      return token;
    } catch {
      return readLocal();
    }
  },

  async setToken(token: string): Promise<void> {
    const value = token.trim();
    await setDoc(tokenRef(), { token: value });
    writeLocal(value);
  },

  async clearToken(): Promise<void> {
    writeLocal('');
    try {
      await deleteDoc(tokenRef());
    } catch {
      /* resta solo da rimuovere dal server alla prossima occasione */
    }
  },

  /** Fa partire subito il controllo che manda la notifica. */
  async fire(): Promise<TriggerResult> {
    const token = await this.getToken();
    if (!token) return { ok: false, message: 'I telefoni riceveranno l’avviso col controllo programmato, tra qualche ora.' };
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: 'main', inputs: { dry_run: 'false' } })
      });
      if (res.status === 204) return { ok: true, message: 'Avviso ai telefoni in partenza: arriva in circa un minuto.' };
      if (res.status === 401) return { ok: false, message: 'GitHub non riconosce il token: scaduto o sbagliato. Riattiva l’avviso immediato con un token nuovo.' };
      if (res.status === 403 || res.status === 404) {
        return { ok: false, message: 'Il token non ha il permesso “Actions: lettura e scrittura” su questo repository. L’avviso partirà col controllo programmato, tra qualche ora.' };
      }
      return { ok: false, message: `GitHub ha risposto ${res.status}: l’avviso partirà col controllo programmato, tra qualche ora.` };
    } catch {
      return { ok: false, message: 'Non riesco a raggiungere GitHub: l’avviso partirà col controllo programmato, tra qualche ora.' };
    }
  }
};
