import React, { useEffect, useMemo, useState } from 'react';
import { User, Phone, HeartPulse, BookUser, Utensils, Wallet, Home, StickyNote, CheckCircle, AlertTriangle, Save, Loader2, Trash2, LogOut, Eye, EyeOff, Camera, Upload } from 'lucide-react';
import { compressImage } from '../../services/galleryService';
import { OPTIONAL_SHARE_FIELDS, type OptionalShareField } from '../../shared/travelerProfile';
import { useAuth } from '../../auth/AuthContext';
import { ApiError } from '../../services/authService';
import { ACCOMMODATIONS } from '../../data/tripData';
import {
  DAILY_BUDGET_OPTIONS,
  DIETARY_OPTIONS,
  KETA_STATUS_OPTIONS,
  PASSPORT_RECOMMENDED_MIN_EXPIRY,
  TRAVELER_SLOT_IDS,
  type TravelerProfileInput,
  validateProfileInput
} from '../../shared/travelerProfile';

type FieldErrors = Partial<Record<keyof TravelerProfileInput, string>>;

interface ProfileFormProps {
  mode: 'onboarding' | 'edit';
  onSaved?: () => void;
  onCancel?: () => void;
}

const BUDGET_LABELS: Record<number, string> = {
  20: '20 € / giorno · street food e spesa',
  30: '30 € / giorno · conservativo consigliato (~45.000 ₩)',
  40: '40 € / giorno · equilibrato con qualche extra',
  50: '50+ € / giorno · shopping e serate speciali'
};

const inputClass =
  'w-full px-3 py-2 text-sm bg-slate-950 border rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500';

const Field: React.FC<{
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  /** Se presente, mostra l'interruttore "Visibile al gruppo" */
  shareOn?: boolean;
  onShare?: (on: boolean) => void;
  children: React.ReactNode;
}> = ({ label, htmlFor, required, error, hint, shareOn, onShare, children }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-xs font-medium text-slate-300">
        {label}
        {required && <span className="text-cyan-400"> *</span>}
      </label>
      {onShare && (
        <button
          type="button"
          role="switch"
          aria-checked={!!shareOn}
          onClick={() => onShare(!shareOn)}
          className={`h-6 px-2 rounded-full border text-[10.5px] font-semibold flex items-center gap-1 shrink-0 ${
            shareOn
              ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}
        >
          {shareOn ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          {shareOn ? 'Visibile al gruppo' : 'Solo tu'}
        </button>
      )}
    </div>
    {children}
    {error ? (
      <p className="text-[11px] text-red-400">{error}</p>
    ) : hint ? (
      <p className="text-[11px] text-slate-500">{hint}</p>
    ) : null}
  </div>
);

const Section: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }> = ({
  icon,
  title,
  subtitle,
  children
}) => (
  <fieldset className="space-y-3 border-t border-slate-800 pt-5 first:border-t-0 first:pt-0">
    <legend className="sr-only">{title}</legend>
    <div className="flex items-center gap-2">
      <span className="text-cyan-400">{icon}</span>
      <div>
        <h3 className="text-sm font-bold text-white font-display">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
    </div>
    {children}
  </fieldset>
);

export const ProfileForm: React.FC<ProfileFormProps> = ({ mode, onSaved, onCancel }) => {
  const { account, group, travelers, saveProfile, signOut, deleteAccount } = useAuth();

  const takenSlots = useMemo(
    () => new Map(group.filter((m) => m.id !== account?.id).map((m) => [m.travelerId, m.displayName])),
    [group, account?.id]
  );
  const firstFreeSlot = TRAVELER_SLOT_IDS.find((id) => !takenSlots.has(id)) ?? 't1';

  const [form, setForm] = useState<TravelerProfileInput>(() => ({
    firstName: account?.firstName ?? '',
    lastName: account?.lastName ?? '',
    displayName: account?.displayName ?? '',
    birthDate: account?.birthDate ?? '',
    travelerId: account?.travelerId ?? firstFreeSlot,
    phone: account?.phone ?? '',
    emergencyContactName: account?.emergencyContactName ?? '',
    emergencyContactPhone: account?.emergencyContactPhone ?? '',
    // Profili creati prima di questa domanda: si deduce dalla scadenza se c'è, altrimenti va indicato
    hasPassport: account?.hasPassport ?? (account?.passportExpiry ? true : null),
    passportNumber: account?.passportNumber ?? '',
    passportExpiry: account?.passportExpiry ?? '',
    ketaStatus: account?.ketaStatus ?? 'Da verificare',
    travelInsurance: account?.travelInsurance ?? '',
    dietaryPreference: account?.dietaryPreference ?? DIETARY_OPTIONS[0],
    allergies: account?.allergies ?? '',
    dailyBudgetGoal: account?.dailyBudgetGoal ?? 30,
    accommodationPreference: account?.accommodationPreference ?? null,
    notes: account?.notes ?? '',
    customAvatar: account?.customAvatar ?? '',
    visibility: account?.visibility ?? {}
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Se il posto preselezionato viene occupato da qualcun altro, passa al primo libero
  useEffect(() => {
    if (takenSlots.has(form.travelerId) && !takenSlots.has(firstFreeSlot)) {
      setForm((f) => ({ ...f, travelerId: firstFreeSlot }));
    }
  }, [takenSlots, firstFreeSlot, form.travelerId]);

  const set = <K extends keyof TravelerProfileInput>(key: K, value: TravelerProfileInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setSaved(false);
  };

  const passportExpiresSoon = Boolean(form.passportExpiry) && form.passportExpiry < PASSPORT_RECOMMENDED_MIN_EXPIRY;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const check = validateProfileInput(form);
    if (!check.ok) {
      setErrors(check.errors);
      setFormError('Controlla i campi evidenziati.');
      return;
    }
    if (takenSlots.has(check.value.travelerId)) {
      setErrors({ travelerId: 'Questo posto è già occupato.' });
      return;
    }

    setIsSaving(true);
    try {
      await saveProfile(check.value);
      setSaved(true);
      onSaved?.();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      setFormError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const setShare = (key: OptionalShareField, on: boolean) => set('visibility', { ...form.visibility, [key]: on });
  const shareProps = (key: OptionalShareField) => ({ shareOn: !!form.visibility[key], onShare: (on: boolean) => setShare(key, on) });

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const onPickAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const img = await compressImage(file);
      set('customAvatar', img.thumb);
    } catch (err) {
      setAvatarError((err as Error).message);
    } finally {
      setAvatarBusy(false);
    }
  };

  const errorClass = (key: keyof TravelerProfileInput) => (errors[key] ? 'border-red-500/70' : 'border-slate-700');

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Account Google collegato */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
        <div className="flex items-center gap-2.5 min-w-0">
          {account?.avatarUrl ? (
            <img src={account.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[11px] text-emerald-300">Account Google verificato</div>
            <div className="text-xs text-white font-mono truncate">{account?.email}</div>
          </div>
        </div>
        {mode === 'onboarding' && (
          <button
            type="button"
            onClick={() => signOut()}
            className="text-[11px] text-slate-400 hover:text-red-400 flex items-center gap-1 shrink-0"
          >
            <LogOut className="w-3 h-3" />
            Cambia account
          </button>
        )}
      </div>

      {/* Foto profilo: quella di Google, oppure una caricata dal telefono */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
        {form.customAvatar || account?.googlePhotoUrl || account?.avatarUrl ? (
          <img
            src={form.customAvatar || account?.googlePhotoUrl || account?.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-14 h-14 rounded-full object-cover border border-slate-700 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-slate-800 shrink-0" />
        )}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="text-xs font-semibold text-white">Foto profilo</div>
          <div className="text-[11px] text-slate-400">{form.customAvatar ? 'Foto caricata dal telefono' : 'Foto del tuo account Google'}</div>
          <div className="flex flex-wrap gap-1.5">
            <label className="h-8 px-3 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer">
              <Camera className="w-3.5 h-3.5" />
              {avatarBusy ? 'Elaboro…' : 'Carica foto'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={avatarBusy}
                onChange={(e) => {
                  void onPickAvatar(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {form.customAvatar && (
              <button
                type="button"
                onClick={() => set('customAvatar', '')}
                className="h-8 px-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Usa quella di Google
              </button>
            )}
          </div>
          {avatarError && <p className="text-[11px] text-red-400">{avatarError}</p>}
        </div>
      </div>

      <Section icon={<User className="w-4 h-4" />} title="Chi sei">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome" htmlFor="pf-first" required error={errors.firstName}>
            <input
              id="pf-first"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => set('firstName', e.target.value)}
              className={`${inputClass} ${errorClass('firstName')}`}
            />
          </Field>
          <Field label="Cognome" htmlFor="pf-last" required error={errors.lastName}>
            <input
              id="pf-last"
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => set('lastName', e.target.value)}
              className={`${inputClass} ${errorClass('lastName')}`}
            />
          </Field>
          <Field
            label="Nome nel gruppo"
            htmlFor="pf-display"
            error={errors.displayName}
            hint="Come comparirai in budget e votazioni. Vuoto = nome e cognome."
          >
            <input
              id="pf-display"
              value={form.displayName}
              placeholder={`${form.firstName} ${form.lastName}`.trim() || 'es. Giulia R.'}
              onChange={(e) => set('displayName', e.target.value)}
              className={`${inputClass} border-slate-700`}
            />
          </Field>
          <Field label="Data di nascita" htmlFor="pf-birth" {...shareProps('birthDate')} required error={errors.birthDate}>
            <input
              id="pf-birth"
              type="date"
              autoComplete="bday"
              value={form.birthDate}
              onChange={(e) => set('birthDate', e.target.value)}
              className={`${inputClass} ${errorClass('birthDate')} [color-scheme:dark]`}
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-300">
            Il tuo posto nel gruppo<span className="text-cyan-400"> *</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {travelers.map((t) => {
              const takenBy = takenSlots.get(t.id as TravelerProfileInput['travelerId']);
              const selected = form.travelerId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={Boolean(takenBy)}
                  onClick={() => set('travelerId', t.id as TravelerProfileInput['travelerId'])}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 transition-all text-left ${
                    selected
                      ? 'bg-cyan-500/15 text-cyan-200 border-cyan-500/70 ring-1 ring-cyan-500/30'
                      : takenBy
                      ? 'bg-slate-950/50 text-slate-600 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="truncate">{takenBy ? `Occupato · ${takenBy}` : `Posto ${t.id.slice(1)}`}</span>
                  </span>
                  {selected && <CheckCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                </button>
              );
            })}
          </div>
          {errors.travelerId && <p className="text-[11px] text-red-400">{errors.travelerId}</p>}
        </div>
      </Section>

      <Section icon={<Phone className="w-4 h-4" />} title="Contatti" subtitle="Il tuo telefono è visibile agli altri partecipanti.">
        <Field label="Telefono / WhatsApp" htmlFor="pf-phone" required error={errors.phone}>
          <input
            id="pf-phone"
            type="tel"
            autoComplete="tel"
            placeholder="+39 340 1234567"
            value={form.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={`${inputClass} ${errorClass('phone')} font-mono`}
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Contatto di emergenza" htmlFor="pf-emname" {...shareProps('emergencyContactName')} error={errors.emergencyContactName} hint="Facoltativo.">
            <input
              id="pf-emname"
              placeholder="es. Maria Rossi (madre)"
              value={form.emergencyContactName}
              onChange={(e) => set('emergencyContactName', e.target.value)}
              className={`${inputClass} ${errorClass('emergencyContactName')}`}
            />
          </Field>
          <Field label="Telefono di emergenza" htmlFor="pf-emphone" {...shareProps('emergencyContactPhone')} error={errors.emergencyContactPhone} hint="Facoltativo.">
            <input
              id="pf-emphone"
              type="tel"
              placeholder="+39 ..."
              value={form.emergencyContactPhone}
              onChange={(e) => set('emergencyContactPhone', e.target.value)}
              className={`${inputClass} ${errorClass('emergencyContactPhone')} font-mono`}
            />
          </Field>
        </div>
      </Section>

      <Section
        icon={<BookUser className="w-4 h-4" />}
        title="Documenti"
        subtitle="Visibili solo a te: servono come promemoria per Corea e transito a Pechino."
      >
        <Field label="Possiedi un passaporto?" htmlFor="pf-haspp" {...shareProps('hasPassport')} required error={errors.hasPassport}>
          <div id="pf-haspp" role="radiogroup" className="grid grid-cols-2 gap-2">
            {[
              { value: true, label: 'Sì, ce l\'ho' },
              { value: false, label: 'No' }
            ].map((opt) => {
              const active = form.hasPassport === opt.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set('hasPassport', opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    active
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                  } ${errors.hasPassport && !active ? 'border-red-500/70' : ''}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </Field>

        {form.hasPassport === false && (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Per entrare in Corea e transitare a Pechino serve il passaporto: se non ce l'hai, richiedilo al più presto
            (i tempi possono essere lunghi). Ti chiederemo la scadenza solo se rispondi di sì.
          </p>
        )}

        {form.hasPassport === true && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Scadenza passaporto"
            htmlFor="pf-ppexp" {...shareProps('passportExpiry')}
            required
            error={errors.passportExpiry}
            hint={
              passportExpiresSoon ? (
                <span className="text-amber-400 flex items-start gap-1">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  Scade prima del 19/09/2027: la guida consiglia almeno 6 mesi di validità dopo il rientro.
                </span>
              ) : undefined
            }
          >
            <input
              id="pf-ppexp"
              type="date"
              value={form.passportExpiry}
              onChange={(e) => set('passportExpiry', e.target.value)}
              className={`${inputClass} ${errorClass('passportExpiry')} [color-scheme:dark]`}
            />
          </Field>
          <Field label="Numero passaporto" htmlFor="pf-ppnum" {...shareProps('passportNumber')} error={errors.passportNumber} hint="Facoltativo.">
            <input
              id="pf-ppnum"
              value={form.passportNumber}
              onChange={(e) => set('passportNumber', e.target.value.toUpperCase())}
              className={`${inputClass} ${errorClass('passportNumber')} font-mono uppercase`}
            />
          </Field>
        </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="K-ETA (autorizzazione ingresso Corea)" htmlFor="pf-keta" {...shareProps('ketaStatus')} required error={errors.ketaStatus}>
            <select
              id="pf-keta"
              value={form.ketaStatus}
              onChange={(e) => set('ketaStatus', e.target.value as TravelerProfileInput['ketaStatus'])}
              className={`${inputClass} ${errorClass('ketaStatus')}`}
            >
              {KETA_STATUS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assicurazione viaggio" htmlFor="pf-ins" {...shareProps('travelInsurance')} hint="Facoltativo: compagnia e n. polizza.">
            <input
              id="pf-ins"
              value={form.travelInsurance}
              onChange={(e) => set('travelInsurance', e.target.value)}
              className={`${inputClass} border-slate-700`}
            />
          </Field>
        </div>
      </Section>

      <Section icon={<Utensils className="w-4 h-4" />} title="Preferenze per il viaggio">
        <Field label="Preferenze alimentari" htmlFor="pf-diet" required error={errors.dietaryPreference}>
          <select
            id="pf-diet"
            value={form.dietaryPreference}
            onChange={(e) => set('dietaryPreference', e.target.value)}
            className={`${inputClass} ${errorClass('dietaryPreference')}`}
          >
            {DIETARY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Allergie o condizioni mediche"
          htmlFor="pf-allergies" {...shareProps('allergies')}
          hint="Facoltativo, visibile solo a te: utile da mostrare in caso di necessità."
        >
          <div className="relative">
            <HeartPulse className="w-3.5 h-3.5 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="pf-allergies"
              placeholder="es. allergia alle arachidi"
              value={form.allergies}
              onChange={(e) => set('allergies', e.target.value)}
              className={`${inputClass} border-slate-700 pl-8`}
            />
          </div>
        </Field>
        <Field label="Budget giornaliero in loco (cibo + svago)" htmlFor="pf-budget" {...shareProps('dailyBudgetGoal')} required error={errors.dailyBudgetGoal}>
          <div className="relative">
            <Wallet className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              id="pf-budget"
              value={form.dailyBudgetGoal}
              onChange={(e) => set('dailyBudgetGoal', Number(e.target.value))}
              className={`${inputClass} ${errorClass('dailyBudgetGoal')} pl-8`}
            >
              {DAILY_BUDGET_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {BUDGET_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5 text-blue-400" />
            Alloggio preferito <span className="text-slate-500 font-normal">(facoltativo, vale come voto)</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ACCOMMODATIONS.map((acc) => {
              const selected = form.accommodationPreference === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() =>
                    set('accommodationPreference', selected ? null : (acc.id as TravelerProfileInput['accommodationPreference']))
                  }
                  className={`p-2 rounded-xl border text-left transition-all ${
                    selected
                      ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-bold font-mono text-cyan-400">Alloggio {acc.code}</span>
                    <span className="text-[10px] font-mono text-emerald-400">{acc.costPerPerson4} €/testa</span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-200 truncate mt-0.5">{acc.district}</div>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Note per il gruppo" htmlFor="pf-notes" {...shareProps('notes')} hint="Facoltativo.">
          <div className="relative">
            <StickyNote className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
            <textarea
              id="pf-notes"
              rows={2}
              placeholder="es. Ho il sonno leggero, porto una ciabatta con adattatore…"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className={`${inputClass} border-slate-700 pl-8 resize-none`}
            />
          </div>
        </Field>
      </Section>

      {formError && (
        <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {formError}
        </div>
      )}
      {saved && mode === 'edit' && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-xs text-emerald-300 flex gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Profilo aggiornato.
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-4 border-t border-slate-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
          >
            Chiudi
          </button>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {mode === 'onboarding' ? 'Salva ed entra nel viaggio' : 'Salva modifiche'}
        </button>
      </div>

      {mode === 'edit' && (
        <div className="pt-4 border-t border-slate-800 space-y-2">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Elimina il mio account e i dati salvati
            </button>
          ) : (
            <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 space-y-2">
              <p className="text-xs text-red-200">
                Il profilo, i documenti e il voto sull'alloggio verranno cancellati. Potrai registrarti di nuovo con
                Google.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => deleteAccount().catch((err) => setFormError((err as Error).message))}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
                >
                  Sì, elimina
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
};
