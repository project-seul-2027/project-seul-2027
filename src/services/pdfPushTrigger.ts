/**
 * Avviso immediato ai telefoni quando il Posto 1 carica un PDF, senza il piano Blaze.
 *
 * Il controllo che manda la notifica è un workflow di GitHub (.github/workflows/pdf-push.yml). Da solo parte ogni
 * poche ore; qui, subito dopo il caricamento, gli si chiede di partire adesso (workflow_dispatch) e la notifica arriva
 * in circa un minuto. Serve un token GitHub con il solo permesso "Actions: lettura e scrittura" su questo repository.
 * Il token resta solo nel browser di chi lo inserisce (localStorage): non va su Firestore né nel codice.
 */
const KEY = 'seul2027.pdfPushToken';
const REPO = 'IamAxell/project-seul-2027';
const WORKFLOW = 'pdf-push.yml';

export interface TriggerResult {
  ok: boolean;
  message: string;
}

export const pdfPushTrigger = {
  getToken(): string {
    try {
      return localStorage.getItem(KEY) ?? '';
    } catch {
      return '';
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(KEY, token.trim());
    } catch {
      /* senza storage il token vale solo finché la pagina resta aperta: non si salva */
    }
  },

  clearToken(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* niente da cancellare */
    }
  },

  /** Fa partire subito il controllo che manda la notifica. */
  async fire(): Promise<TriggerResult> {
    const token = this.getToken();
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
