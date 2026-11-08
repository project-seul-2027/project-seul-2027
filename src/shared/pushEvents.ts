/**
 * Avvisi "dal vivo" del gruppo (ritrovi, persone perse, spese, foto, luoghi, arrivi a casa).
 * Puro calcolo, senza Firebase: lo usano sia il controllo programmato (scripts/trip-push.mts)
 * sia le funzioni in tempo reale (functions/src/index.ts), così messaggi, chiavi anti-doppione e pagine
 * di destinazione sono identici nei due percorsi.
 */
/** Tipi di avviso: ognuno si può attivare o spegnere da "Cosa vuoi ricevere" */
export type AlertCategory = 'schedule' | 'bookings' | 'group' | 'activity' | 'updates';

/** Pagina dell'app che si apre toccando la notifica (valori di ?p=) */
export type PushRoute = 'group' | 'expenses' | 'gallery' | 'places' | 'pdf' | 'itinerary' | 'today' | 'flights';

export interface PushMessage {
  /** Chiave per non rimandare due volte lo stesso avviso (documento pushLog) */
  key: string;
  category: AlertCategory;
  title: string;
  body: string;
  route: PushRoute;
  /** Emergenza: priorità alta, resta sullo schermo e ignora le ore di silenzio */
  critical?: boolean;
}

/** Indirizzo da aprire: la pagina giusta dell'app (la legge pageFromUrl, vedi src/pageAddress.ts) */
export function pushUrl(siteUrl: string, route: PushRoute): string {
  if (!/^https?:/.test(siteUrl)) return `./?p=${route}`;
  return `${siteUrl.replace(/\/?$/, '/')}?p=${route}`;
}

export const seoulClock = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
};

export const lostMessage = (uid: string, lostAt: number, name: string): PushMessage => ({
  key: `l-${uid}-${lostAt}`,
  category: 'group',
  title: `${name} ha perso il gruppo!`,
  body: 'Apri “Il gruppo adesso”: mostra dove si trova.',
  route: 'group',
  critical: true
});

export const homeMessage = (uid: string, at: number, name: string): PushMessage => ({
  key: `h-${uid}-${at}`,
  category: 'group',
  title: `${name} è a casa`,
  body: 'È arrivato all’alloggio.',
  route: 'group'
});

export const meetupMessage = (id: string, label: string, at: number, fixed: boolean): PushMessage => ({
  key: `m-${id}`,
  category: 'group',
  title: fixed ? 'Nuovo punto fisso' : 'Nuovo ritrovo',
  body: fixed ? clip(label, 120) : `${clip(label, 100)} alle ${seoulClock(at)}`,
  route: 'group'
});

export const expenseMessage = (id: string, name: string, title: string, cents: number): PushMessage => ({
  key: `x-${id}`,
  category: 'activity',
  title: `${name} ha aggiunto una spesa`,
  body: `${clip(title, 80)} · ${(cents / 100).toFixed(2).replace('.', ',')} €`,
  route: 'expenses'
});

export const photoMessage = (id: string, name: string, caption: string, place: string): PushMessage => ({
  key: `p-${id}`,
  category: 'activity',
  title: `${name} ha aggiunto una foto`,
  body: clip(caption || place || 'Guardala in galleria.', 120),
  route: 'gallery'
});

/** Nuovo PDF dell'itinerario caricato dal Posto 1. La chiave è la stessa di scripts/pdf-push.mjs: un solo avviso per caricamento. */
export const pdfMessage = (updatedAt: number, fileName: string): PushMessage => ({
  key: `pdf-${updatedAt}`,
  category: 'updates',
  title: 'Itinerario aggiornato',
  body: `È stato caricato un nuovo PDF (${clip(fileName || 'itinerario', 60)}): aprilo per vedere le novità.`,
  route: 'pdf'
});

export const placeMessage =(id: string, name: string, place: string): PushMessage => ({
  key: `pl-${id}`,
  category: 'activity',
  title: `${name} ha proposto un luogo`,
  body: `${clip(place, 100)} · vota se ti piace.`,
  route: 'places'
});
