/**
 * Checklist dei preparativi di ogni partecipante (pagina Partecipanti).
 * Ognuno segna le proprie caselle, tutto il gruppo le vede in tempo reale.
 * Niente voci "dell'ultimo minuto" (valigia, check-in...): nessuno aprirebbe l'app per segnarle.
 *
 * ⚠️ Le stesse chiavi sono elencate anche in firestore.rules (collezione `statuses`):
 * se ne aggiungi una qui, aggiungila anche lì.
 */
export const CHECKLIST_ITEMS = [
  { key: 'ok', label: 'Ok sul venire', hint: 'Ha confermato che ci sarà' },
  { key: 'biglietto', label: 'Biglietto aereo', hint: 'Volo prenotato e pagato' },
  { key: 'affitto', label: "Quota dell'affitto", hint: "Parte dell'appartamento pagata" },
  { key: 'passaporto', label: 'Passaporto valido', hint: 'Scade dopo settembre 2027' },
  { key: 'assicurazione', label: 'Assicurazione viaggio', hint: 'Sanitaria, anche quella della carta' },
  { key: 'pagamenti', label: 'Pagamenti all’estero', hint: 'Carta senza commissioni, Alipay per Pechino' }
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]['key'];
export type ChecklistState = Partial<Record<ChecklistKey, boolean>>;
/** uid → caselle spuntate */
export type GroupChecklists = Record<string, ChecklistState>;

export const countDone = (state: ChecklistState | undefined): number =>
  CHECKLIST_ITEMS.filter((item) => state?.[item.key] === true).length;
