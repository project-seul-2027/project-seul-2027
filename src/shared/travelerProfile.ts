/**
 * Modello condiviso (client + server) del profilo viaggiatore.
 * Il server usa `validateProfileInput` come unica fonte di verità per la validazione;
 * il client usa le stesse costanti per costruire il modulo.
 */

export const TRAVELER_SLOT_IDS = ['t1', 't2', 't3', 't4'] as const;
export type TravelerSlotId = (typeof TRAVELER_SLOT_IDS)[number];

export const ACCOMMODATION_IDS = ['acc_a', 'acc_b', 'acc_c', 'acc_d'] as const;
export type AccommodationId = (typeof ACCOMMODATION_IDS)[number];

export const DIETARY_OPTIONS = [
  'Mangio tutto · Adoro il cibo piccante coreano',
  'Poco piccante · Evitare Gochujang e brodi piccanti',
  'Vegetariano / Pescatariano',
  'Vegano',
  'Allergia / Intolleranza alimentare'
] as const;

export const KETA_STATUS_OPTIONS = [
  'Da verificare',
  'Richiesta inviata',
  'Approvata',
  'Non necessaria (esenzione)'
] as const;
export type KetaStatus = (typeof KETA_STATUS_OPTIONS)[number];

export const DAILY_BUDGET_OPTIONS = [20, 30, 40, 50] as const;

/** Rientro a Milano: 19 marzo 2027. Il passaporto deve valere almeno 6 mesi oltre. */
export const TRIP_RETURN_DATE = '2027-03-19';
export const PASSPORT_RECOMMENDED_MIN_EXPIRY = '2027-09-19';

/** Dati che ogni partecipante compila (e può modificare) dopo l'accesso con Google. */
export interface TravelerProfileInput {
  firstName: string;
  lastName: string;
  displayName: string;
  birthDate: string; // YYYY-MM-DD
  travelerId: TravelerSlotId;
  phone: string;
  emergencyContactName: string; // opzionale (stringa vuota)
  emergencyContactPhone: string; // opzionale (stringa vuota)
  /** Scelta obbligatoria: null finché non viene indicata (profili creati prima di questa scelta) */
  hasPassport: boolean | null;
  passportNumber: string; // opzionale, solo se hasPassport (stringa vuota altrimenti)
  passportExpiry: string; // YYYY-MM-DD, obbligatoria solo se hasPassport (stringa vuota altrimenti)
  ketaStatus: KetaStatus;
  travelInsurance: string; // opzionale: compagnia + n. polizza
  dietaryPreference: string;
  allergies: string; // opzionale: allergie / condizioni mediche utili al gruppo
  dailyBudgetGoal: number;
  accommodationPreference: AccommodationId | null;
  notes: string;
}

/** Account completo salvato dal server (chiave: `sub` Google). */
export interface UserAccount extends Partial<TravelerProfileInput> {
  id: string; // Google `sub`
  email: string;
  googleName: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
  profileCompleted: boolean;
}

/** Profilo con onboarding completato: tutti i campi sono presenti. */
export type CompletedUserAccount = UserAccount & TravelerProfileInput & { profileCompleted: true };

/** Vista pubblica di un membro del gruppo (niente passaporto, nascita, contatti di emergenza). */
export interface GroupMember {
  id: string;
  travelerId: TravelerSlotId;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string;
  phone: string;
  dietaryPreference: string;
  accommodationPreference: AccommodationId | null;
}

export type ValidationResult =
  | { ok: true; value: TravelerProfileInput }
  | { ok: false; errors: Partial<Record<keyof TravelerProfileInput, string>> };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_RE = /^\+?[0-9 ()./-]{6,20}$/;

function str(raw: unknown, max: number): string {
  return typeof raw === 'string' ? raw.trim().slice(0, max) : '';
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateProfileInput(raw: unknown): ValidationResult {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: Partial<Record<keyof TravelerProfileInput, string>> = {};

  const firstName = str(src.firstName, 60);
  const lastName = str(src.lastName, 60);
  const displayName = str(src.displayName, 40) || `${firstName} ${lastName}`.trim();
  const birthDate = str(src.birthDate, 10);
  const travelerId = str(src.travelerId, 4) as TravelerSlotId;
  const phone = str(src.phone, 25);
  const emergencyContactName = str(src.emergencyContactName, 80);
  const emergencyContactPhone = str(src.emergencyContactPhone, 25);
  const hasPassport = src.hasPassport === true ? true : src.hasPassport === false ? false : null;
  const passportNumber = str(src.passportNumber, 20).toUpperCase();
  const passportExpiry = str(src.passportExpiry, 10);
  const ketaStatus = str(src.ketaStatus, 40) as KetaStatus;
  const travelInsurance = str(src.travelInsurance, 120);
  const dietaryPreference = str(src.dietaryPreference, 80);
  const allergies = str(src.allergies, 300);
  const dailyBudgetGoal = Number(src.dailyBudgetGoal);
  const accRaw = src.accommodationPreference;
  const accommodationPreference =
    typeof accRaw === 'string' && (ACCOMMODATION_IDS as readonly string[]).includes(accRaw)
      ? (accRaw as AccommodationId)
      : null;
  const notes = str(src.notes, 500);

  if (!firstName) errors.firstName = 'Il nome è obbligatorio.';
  if (!lastName) errors.lastName = 'Il cognome è obbligatorio.';

  if (!isValidDate(birthDate)) {
    errors.birthDate = 'Inserisci una data di nascita valida.';
  } else if (birthDate > new Date().toISOString().slice(0, 10) || birthDate < '1900-01-01') {
    errors.birthDate = 'La data di nascita non è plausibile.';
  }

  if (!(TRAVELER_SLOT_IDS as readonly string[]).includes(travelerId)) {
    errors.travelerId = 'Scegli il tuo posto nel gruppo.';
  }

  if (!PHONE_RE.test(phone)) errors.phone = 'Inserisci un numero di telefono valido (es. +39 340 1234567).';
  // Contatto di emergenza facoltativo: se indicato il telefono, deve essere valido
  if (emergencyContactPhone && !PHONE_RE.test(emergencyContactPhone)) {
    errors.emergencyContactPhone = 'Il numero di telefono non sembra valido (es. +39 333 1234567).';
  }
  if (emergencyContactPhone && !emergencyContactName) {
    errors.emergencyContactName = 'Indica anche il nome della persona da contattare.';
  }

  if (hasPassport === null) {
    errors.hasPassport = 'Indica se hai il passaporto.';
  } else if (hasPassport) {
    if (passportNumber && !/^[A-Z0-9]{5,20}$/.test(passportNumber)) {
      errors.passportNumber = 'Il numero di passaporto contiene solo lettere e cifre.';
    }
    if (!isValidDate(passportExpiry)) {
      errors.passportExpiry = 'Inserisci la data di scadenza del passaporto.';
    }
  }

  if (!(KETA_STATUS_OPTIONS as readonly string[]).includes(ketaStatus)) {
    errors.ketaStatus = 'Seleziona lo stato del K-ETA.';
  }
  if (!(DIETARY_OPTIONS as readonly string[]).includes(dietaryPreference)) {
    errors.dietaryPreference = 'Seleziona una preferenza alimentare.';
  }
  if (!(DAILY_BUDGET_OPTIONS as readonly number[]).includes(dailyBudgetGoal)) {
    errors.dailyBudgetGoal = 'Seleziona un budget giornaliero.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      firstName,
      lastName,
      displayName,
      birthDate,
      travelerId,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      hasPassport: hasPassport === true,
      // Senza passaporto non si salvano numero e scadenza
      passportNumber: hasPassport ? passportNumber : '',
      passportExpiry: hasPassport ? passportExpiry : '',
      ketaStatus,
      travelInsurance,
      dietaryPreference,
      allergies,
      dailyBudgetGoal,
      accommodationPreference,
      notes
    }
  };
}

export function toGroupMember(user: CompletedUserAccount): GroupMember {
  return {
    id: user.id,
    travelerId: user.travelerId,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    dietaryPreference: user.dietaryPreference,
    accommodationPreference: user.accommodationPreference
  };
}

export function isCompleted(user: UserAccount): user is CompletedUserAccount {
  return user.profileCompleted === true;
}
