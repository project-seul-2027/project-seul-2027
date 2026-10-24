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

/**
 * Campi che ciascuno può scegliere di rendere visibili al gruppo. Quelli fuori da questo elenco
 * (nome, posto, telefono, alimentazione, voto alloggio, foto) sono sempre visibili.
 */
export const OPTIONAL_SHARE_FIELDS = [
  'birthDate',
  'hasPassport',
  'passportExpiry',
  'passportNumber',
  'ketaStatus',
  'travelInsurance',
  'emergencyContactName',
  'emergencyContactPhone',
  'allergies',
  'dailyBudgetGoal',
  'notes'
] as const;
export type OptionalShareField = (typeof OPTIONAL_SHARE_FIELDS)[number];
export type ShareVisibility = Partial<Record<OptionalShareField, boolean>>;

/** Foto caricata dal telefono (data URL JPEG ridimensionato). Vuota = si usa la foto di Google. */
export const CUSTOM_AVATAR_MAX_CHARS = 150_000;

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
  /** Foto caricata dal telefono (vuota = foto di Google) */
  customAvatar: string;
  /** Campi opzionali che l'utente rende visibili al gruppo */
  visibility: ShareVisibility;
}

/** Account completo salvato dal server (chiave: `sub` Google). */
export interface UserAccount extends Partial<TravelerProfileInput> {
  id: string; // Google `sub`
  email: string;
  googleName: string;
  /** Foto mostrata nell'app: quella caricata dal telefono oppure quella di Google */
  avatarUrl: string;
  /** Foto del profilo Google, da usare quando non se ne carica una propria */
  googlePhotoUrl: string;
  customAvatar?: string;
  visibility?: ShareVisibility;
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
  /** Quali campi opzionali sono condivisi (elenco) */
  shared: OptionalShareField[];
  /** Valori dei campi opzionali condivisi (solo quelli in `shared`) */
  birthDate?: string;
  hasPassport?: boolean;
  passportExpiry?: string;
  passportNumber?: string;
  ketaStatus?: string;
  travelInsurance?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string;
  dailyBudgetGoal?: number;
  notes?: string;
}

/**
 * Dato condiviso: fisso (sempre visibile) + i campi opzionali scelti dall'utente.
 * Il campo non scelto non compare proprio nel documento condiviso, così nessun altro può leggerlo.
 */
export function buildGroupMember(
  id: string,
  input: Pick<TravelerProfileInput, OptionalShareField | 'travelerId' | 'firstName' | 'lastName' | 'displayName' | 'phone' | 'dietaryPreference' | 'accommodationPreference' | 'visibility'>,
  avatarUrl: string
): GroupMember {
  const member: GroupMember = {
    id,
    travelerId: input.travelerId,
    firstName: input.firstName,
    lastName: input.lastName,
    displayName: input.displayName,
    avatarUrl,
    phone: input.phone,
    dietaryPreference: input.dietaryPreference,
    accommodationPreference: input.accommodationPreference,
    shared: []
  };
  const bag = member as unknown as Record<string, unknown>;
  for (const key of OPTIONAL_SHARE_FIELDS) {
    if (input.visibility?.[key]) {
      bag[key] = input[key];
      member.shared.push(key);
    }
  }
  return member;
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
  const customAvatarRaw = typeof src.customAvatar === 'string' ? src.customAvatar : '';
  const customAvatar =
    customAvatarRaw.startsWith('data:image/jpeg;base64,') && customAvatarRaw.length <= CUSTOM_AVATAR_MAX_CHARS
      ? customAvatarRaw
      : '';
  const visibility: ShareVisibility = {};
  const visRaw = src.visibility && typeof src.visibility === 'object' ? (src.visibility as Record<string, unknown>) : {};
  for (const key of OPTIONAL_SHARE_FIELDS) visibility[key] = visRaw[key] === true;

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
      notes,
      customAvatar,
      visibility
    }
  };
}

export function toGroupMember(user: CompletedUserAccount): GroupMember {
  return buildGroupMember(user.id, user, user.avatarUrl);
}

export function isCompleted(user: UserAccount): user is CompletedUserAccount {
  return user.profileCompleted === true;
}
