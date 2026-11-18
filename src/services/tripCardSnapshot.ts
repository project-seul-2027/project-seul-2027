import type { GroupMember } from '../shared/travelerProfile';

/** Contatti del gruppo salvati sul telefono quando c'è rete: restano leggibili anche offline. */
export const GROUP_CONTACTS_KEY = 'seul2027:tripcard:group';

export interface ContactSnapshot {
  id: string;
  name: string;
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
}

/** Salva solo i campi che il gruppo ha scelto di condividere (il contatto d'emergenza è opzionale). */
export function saveGroupContacts(members: GroupMember[]): void {
  const list: ContactSnapshot[] = members.map((m) => {
    const shared = m.shared ?? [];
    return {
      id: m.id,
      name: m.displayName || `${m.firstName} ${m.lastName}`.trim(),
      phone: m.phone || '',
      emergencyName: shared.includes('emergencyContactName') ? m.emergencyContactName ?? '' : '',
      emergencyPhone: shared.includes('emergencyContactPhone') ? m.emergencyContactPhone ?? '' : ''
    };
  });
  try {
    localStorage.setItem(GROUP_CONTACTS_KEY, JSON.stringify(list));
  } catch {
    /* archiviazione bloccata: resta l'ultima lista salvata */
  }
}

export function loadGroupContacts(): ContactSnapshot[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(GROUP_CONTACTS_KEY) || '[]');
    return Array.isArray(raw) ? (raw as ContactSnapshot[]) : [];
  } catch {
    return [];
  }
}
