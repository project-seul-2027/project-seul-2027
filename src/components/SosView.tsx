import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2, Check, CircleAlert, Copy, ExternalLink, HeartPulse, Home, LifeBuoy, LocateFixed, Loader2, MapPin, Pencil, Phone, Pill, ShieldAlert, Share2, UserRound
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ACCOMMODATIONS, getNaverMapSearchUrl, MAP_LOCATIONS } from '../data/tripData';
import { EMERGENCY_NUMBERS, PHRASE_GROUPS, withDirectionParticle } from '../data/koreanHelp';
import { clearLost, currentPosition, reportLost, useGroupLive } from './group/groupLiveStore';
import { isLost } from '../shared/groupLive';
import { getPackState } from '../offline/offlinePack';

/**
 * Centro emergenze: tutto ciò che serve quando qualcosa va storto, in un'unica schermata che funziona anche senza rete.
 * I dati personali restano sul telefono: i campi extra non vanno mai su Firebase.
 */

export const SOS_SNAPSHOT_KEY = 'seul2027:sos:snapshot';
const SNAPSHOT_KEY = SOS_SNAPSHOT_KEY;
const LOCAL_KEY = 'seul2027:sos:local';

/** Dati dell'ambasciata verificati sul sito ufficiale il 30 ottobre 2026. */
export const EMBASSY = {
  name: 'Ambasciata d’Italia a Seul',
  address: '3F Ilshin Bldg., 98 Hannam-daero, Yongsan-gu, Seoul 04418',
  addressKo: '서울특별시 용산구 한남대로 98 일신빌딩 3층',
  phone: '+82 2 750 0200',
  emergencyPhone: '+82 10 2242 0491',
  email: 'embassy.seoul@esteri.it',
  hours: 'lun–ven 9:00–17:30',
  contactsUrl: 'https://ambseoul.esteri.it/it/contatti/',
  emergencyUrl: 'https://ambseoul.esteri.it/it/chi-siamo/numeri-di-emergenza/'
};

interface Snapshot {
  firstName: string;
  phone: string;
  contactName: string;
  contactPhone: string;
  insurance: string;
  allergies: string;
  homeId: string;
}
interface Local {
  address: string;
  assistancePhone: string;
  medical: string;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? { ...fallback, ...(JSON.parse(v) as T) } : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* archiviazione bloccata */
  }
}

const tel = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;
const koOf = (s?: string) => (s ?? '').split('/')[0].trim();

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; tone?: string; testId?: string }> = ({ title, icon, children, tone = 'border-slate-800 bg-slate-900/70', testId }) => (
  <section className={`rounded-3xl border p-4 space-y-3 ${tone}`} data-testid={testId}>
    <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">{icon} {title}</h3>
    {children}
  </section>
);

export const SosView: React.FC = () => {
  const { account } = useAuth();
  const g = useGroupLive();
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ p: [number, number]; at: number } | null>(null);
  const [posBusy, setPosBusy] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);
  const [lostConfirm, setLostConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [offlineReady, setOfflineReady] = useState<boolean | null>(null);
  useEffect(() => {
    getPackState().then((s) => setOfflineReady(s.installed)).catch(() => setOfflineReady(false));
  }, []);
  const [local, setLocal] = useState<Local>(() => readJson<Local>(LOCAL_KEY, { address: '', assistancePhone: '', medical: '' }));

  // Copia dei dati del profilo: serve se il telefono è senza rete e l'accesso non si ricarica
  const snap = useMemo<Snapshot>(() => {
    const fresh: Snapshot | null = account
      ? {
          firstName: account.firstName ?? '',
          phone: account.phone ?? '',
          contactName: account.emergencyContactName ?? '',
          contactPhone: account.emergencyContactPhone ?? '',
          insurance: account.travelInsurance ?? '',
          allergies: account.allergies ?? '',
          homeId: account.accommodationPreference ?? 'acc_c'
        }
      : null;
    return fresh ?? readJson<Snapshot>(SNAPSHOT_KEY, { firstName: '', phone: '', contactName: '', contactPhone: '', insurance: '', allergies: '', homeId: 'acc_c' });
  }, [account]);
  useEffect(() => {
    if (account) writeJson(SNAPSHOT_KEY, snap);
  }, [account, snap]);

  const home = ACCOMMODATIONS.find((a) => a.id === snap.homeId) ?? ACCOMMODATIONS[2];
  const homeLoc = MAP_LOCATIONS.find((l) => l.id === home.id);
  const homeKo = koOf(homeLoc?.koreanName);
  const myPos = pos?.p ?? g.myPos;
  const myDoc = g.live.find((d) => d.uid === account?.id);
  const iAmLost = myDoc ? isLost(myDoc, Date.now()) : false;

  const locate = async () => {
    setPosError(null);
    setPosBusy(true);
    try {
      setPos({ p: await currentPosition(), at: Date.now() });
    } catch (err) {
      setPosError((err as Error).message);
    } finally {
      setPosBusy(false);
    }
  };

  const posText = myPos
    ? `Sono qui: ${myPos[0].toFixed(5)}, ${myPos[1].toFixed(5)} https://www.google.com/maps/search/?api=1&query=${myPos[0]},${myPos[1]}`
    : '';
  const shareOrCopy = async () => {
    try {
      if (navigator.share) await navigator.share({ text: posText });
      else {
        await navigator.clipboard.writeText(posText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* annullato */
    }
  };

  const saveLocal = (patch: Partial<Local>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    writeJson(LOCAL_KEY, next);
  };

  const near = myPos ? `/@${myPos[0]},${myPos[1]},15z` : '';
  const emergencyPhrases = PHRASE_GROUPS.find((x) => x.id === 'emergenza')?.phrases ?? [];
  const input = 'w-full min-h-[44px] rounded-xl bg-slate-950 border border-slate-700 focus:border-rose-400 focus:outline-none px-3 text-sm text-white';

  return (
    <div className="space-y-4" data-testid="sos-view">
      <header className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-2xl bg-rose-500/20 text-rose-300 flex items-center justify-center shrink-0"><ShieldAlert className="w-6 h-6" /></span>
        <div>
          <h2 className="text-xl font-bold text-white font-display">Emergenze</h2>
          <p className="text-xs text-slate-400 mt-0.5 leading-snug">In pericolo, chiama prima i numeri qui sotto.</p>
          {offlineReady !== null && (
            <p className={`mt-1 text-[11px] font-semibold ${offlineReady ? 'text-emerald-300' : 'text-amber-300'}`} data-testid="sos-offline">
              {offlineReady ? 'Disponibile anche senza internet' : 'Senza internet potrebbe non aprirsi: scarica il pacchetto offline da “Oggi”.'}
            </p>
          )}
        </div>
      </header>

      {/* Chiamate rapide */}
      <div className="grid grid-cols-2 gap-2.5" data-testid="sos-calls">
        {EMERGENCY_NUMBERS.slice(0, 2).map((n, i) => (
          <a key={n.number} href={tel(n.number)} className={`min-h-[96px] rounded-3xl flex flex-col items-center justify-center gap-1 text-white shadow-lg active:scale-[0.98] ${i === 0 ? 'bg-blue-600' : 'bg-rose-600'}`} data-testid={`sos-call-${n.number}`}>
            <span className="text-4xl font-black tracking-tight font-mono">{n.number}</span>
            <span className="text-[11px] font-semibold px-2 text-center leading-tight">{n.label}</span>
          </a>
        ))}
        {EMERGENCY_NUMBERS.slice(2).map((n) => (
          <a key={n.number} href={tel(n.number)} className="col-span-2 min-h-[56px] rounded-2xl bg-slate-800 text-white flex items-center justify-center gap-3 px-3" data-testid={`sos-call-${n.number}`}>
            <Phone className="w-5 h-5 text-emerald-300" /> <span className="text-xl font-black font-mono">{n.number}</span> <span className="text-[11px] text-slate-300 leading-tight">{n.label}</span>
          </a>
        ))}
      </div>

      {/* Dove sono */}
      <Section title="Dove sono" icon={<LocateFixed className="w-4 h-4 text-cyan-300" />} testId="sos-position">
        {myPos ? (
          <>
            <p className="text-2xl font-mono font-bold text-white tabular-nums leading-tight break-all" data-testid="sos-coords">{myPos[0].toFixed(5)}, {myPos[1].toFixed(5)}</p>
            <p className="text-[11px] text-slate-400">Da dare a chi risponde al 119 o al 112, oppure da mandare al gruppo.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={shareOrCopy} className="min-h-[44px] rounded-xl bg-cyan-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2" data-testid="sos-share-pos">
                {copied ? <><Check className="w-4 h-4" /> Copiata</> : typeof navigator !== 'undefined' && 'share' in navigator ? <><Share2 className="w-4 h-4" /> Invia</> : <><Copy className="w-4 h-4" /> Copia</>}
              </button>
              <button type="button" onClick={locate} disabled={posBusy} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
                {posBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />} Aggiorna
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={locate} disabled={posBusy} className="w-full min-h-[48px] rounded-xl bg-cyan-500 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60" data-testid="sos-locate">
            {posBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />} Leggi la mia posizione
          </button>
        )}
        {posError && <p className="text-xs text-amber-300 flex gap-1.5" role="alert"><CircleAlert className="w-4 h-4 shrink-0" />{posError}</p>}
        {iAmLost ? (
          <button type="button" onClick={() => clearLost()} className="w-full min-h-[48px] rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold" data-testid="sos-lost-clear">Li ho ritrovati</button>
        ) : lostConfirm ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setLostConfirm(false)} className="min-h-[48px] rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold">Annulla</button>
            <button type="button" onClick={() => { setLostConfirm(false); reportLost(); }} className="min-h-[48px] rounded-xl bg-rose-500 text-white text-sm font-bold" data-testid="sos-lost-send">Avvisa il gruppo</button>
          </div>
        ) : (
          <button type="button" onClick={() => setLostConfirm(true)} className="w-full min-h-[48px] rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-100 text-sm font-bold flex items-center justify-center gap-2" data-testid="sos-lost-open">
            <LifeBuoy className="w-4 h-4" /> Ho perso il gruppo
          </button>
        )}
      </Section>

      {/* Alloggio */}
      <Section title="Il mio alloggio" icon={<Home className="w-4 h-4 text-blue-300" />} testId="sos-home">
        {homeKo ? (
          <div className="rounded-2xl bg-white text-slate-950 p-4 text-center" data-testid="sos-home-ko">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Per il tassista</p>
            <p className="text-5xl font-black leading-tight mt-1 break-keep">{homeKo}</p>
            <p className="text-lg font-bold mt-1">{`${withDirectionParticle(homeKo)} 가 주세요.`}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nome coreano non disponibile per questo alloggio.</p>
        )}
        <p className="text-xs text-slate-300 leading-snug">{home.name}</p>
        {local.address && !editing && (
          <div className="rounded-2xl bg-slate-950 border border-slate-700 p-3" data-testid="sos-address">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Indirizzo preciso (salvato qui)</p>
            <p className="text-2xl font-bold text-white leading-snug mt-1 break-words">{local.address}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {homeLoc && (
            <a href={getNaverMapSearchUrl(homeLoc)} target="_blank" rel="noopener noreferrer" className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 text-emerald-200 text-xs font-semibold flex items-center gap-1.5"><ExternalLink className="w-3.5 h-3.5" /> Apri su Naver</a>
          )}
          <button type="button" onClick={() => setEditing((v) => !v)} className="min-h-[44px] px-3.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1.5" data-testid="sos-edit"><Pencil className="w-3.5 h-3.5" /> {editing ? 'Fatto' : 'Aggiungi l’indirizzo preciso'}</button>
        </div>
        {editing && (
          <label className="block">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Indirizzo in coreano (copialo dalla prenotazione)</span>
            <textarea value={local.address} onChange={(e) => saveLocal({ address: e.target.value })} rows={2} className={`${input} py-2 resize-none`} placeholder="서울특별시 마포구 …" data-testid="sos-address-input" />
          </label>
        )}
      </Section>

      {/* Ospedale e farmacia */}
      <Section title="Ospedale e farmacia vicini" icon={<HeartPulse className="w-4 h-4 text-rose-300" />} testId="sos-health">
        <div className="grid grid-cols-2 gap-2">
          <a href={`https://www.google.com/maps/search/hospital${near}`} target="_blank" rel="noopener noreferrer" className="min-h-[48px] rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-100 text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="sos-hospital">
            <HeartPulse className="w-4 h-4" /> Ospedale
          </a>
          <a href={`https://www.google.com/maps/search/pharmacy${near}`} target="_blank" rel="noopener noreferrer" className="min-h-[48px] rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-100 text-sm font-semibold flex items-center justify-center gap-1.5" data-testid="sos-pharmacy">
            <Pill className="w-4 h-4" /> Farmacia
          </a>
          <a href="https://map.naver.com/p/search/응급실" target="_blank" rel="noopener noreferrer" className="min-h-[40px] rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5">Pronto soccorso su Naver (응급실)</a>
          <a href="https://map.naver.com/p/search/약국" target="_blank" rel="noopener noreferrer" className="min-h-[40px] rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5">Farmacia su Naver (약국)</a>
        </div>
        {!myPos && <p className="text-[11px] text-slate-500">Leggi prima la tua posizione qui sopra: la ricerca partirà da dove sei.</p>}
      </Section>

      {/* Persone e assicurazione */}
      <Section title="Contatti e salute" icon={<UserRound className="w-4 h-4 text-amber-300" />} testId="sos-personal">
        {snap.contactPhone ? (
          <a href={tel(snap.contactPhone)} className="min-h-[56px] rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center gap-3 px-3 font-bold" data-testid="sos-contact">
            <Phone className="w-5 h-5" /> Chiama {snap.contactName || 'il contatto di emergenza'} <span className="font-mono text-sm">{snap.contactPhone}</span>
          </a>
        ) : (
          <p className="text-xs text-slate-400">Nessun contatto di emergenza: aggiungilo nel tuo profilo.</p>
        )}
        {snap.insurance && (
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-sm text-slate-200" data-testid="sos-insurance">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Assicurazione di viaggio</p>
            <p className="mt-0.5">{snap.insurance}</p>
          </div>
        )}
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Numero di assistenza dell’assicurazione (resta su questo telefono)</span>
          <input value={local.assistancePhone} onChange={(e) => saveLocal({ assistancePhone: e.target.value })} inputMode="tel" placeholder="+39 …" className={input} data-testid="sos-assistance-input" />
        </label>
        {local.assistancePhone && (
          <a href={tel(local.assistancePhone)} className="min-h-[48px] rounded-xl bg-slate-800 text-amber-100 text-sm font-semibold flex items-center justify-center gap-2" data-testid="sos-assistance-call"><Phone className="w-4 h-4" /> Chiama l’assistenza</a>
        )}
        {snap.allergies && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/40 p-3 text-sm text-amber-100" data-testid="sos-allergies">
            <p className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">Allergie e condizioni mediche</p>
            <p className="mt-0.5">{snap.allergies}</p>
          </div>
        )}
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Altre note mediche (gruppo sanguigno, farmaci…)</span>
          <textarea value={local.medical} onChange={(e) => saveLocal({ medical: e.target.value })} rows={2} className={`${input} py-2 resize-none`} data-testid="sos-medical-input" />
        </label>
        <p className="text-[11px] text-slate-500">I campi qui sopra restano solo su questo telefono, non vengono caricati online.</p>
      </Section>

      {/* Frasi */}
      <Section title="Cosa dire" icon={<ShieldAlert className="w-4 h-4 text-rose-300" />} testId="sos-phrases">
        <ul className="space-y-2">
          {emergencyPhrases.map((p) => (
            <li key={p.ko} className="rounded-2xl bg-slate-950 border border-slate-800 px-3.5 py-2.5">
              <p className="text-xl font-bold text-white leading-snug">{p.ko}</p>
              <p className="text-[11px] text-slate-500">{p.rom}</p>
              <p className="text-xs text-slate-300 mt-0.5">{p.it}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Ambasciata */}
      <Section title={EMBASSY.name} icon={<Building2 className="w-4 h-4 text-indigo-300" />} testId="sos-embassy">
        <div className="text-sm text-slate-200 space-y-1.5">
          <p>{EMBASSY.address}</p>
          <p className="text-lg font-bold text-white">{EMBASSY.addressKo}</p>
          <p className="text-xs text-slate-400">Orari: {EMBASSY.hours}</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <a href={tel(EMBASSY.emergencyPhone)} className="min-h-[48px] rounded-xl bg-indigo-500 text-white text-sm font-bold flex items-center justify-center gap-2" data-testid="sos-embassy-emergency">
            <Phone className="w-4 h-4" /> Emergenza fuori orario · {EMBASSY.emergencyPhone}
          </a>
          <a href={tel(EMBASSY.phone)} className="min-h-[44px] rounded-xl bg-slate-800 text-slate-100 text-sm font-semibold flex items-center justify-center gap-2" data-testid="sos-embassy-phone"><Phone className="w-4 h-4" /> Centralino · {EMBASSY.phone}</a>
          <a href={`https://map.naver.com/p/search/${encodeURIComponent(EMBASSY.addressKo)}`} target="_blank" rel="noopener noreferrer" className="min-h-[44px] rounded-xl bg-slate-800 text-emerald-200 text-sm font-semibold flex items-center justify-center gap-2"><MapPin className="w-4 h-4" /> Apri su Naver</a>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">
          Il numero di emergenza è solo per casi di comprovata emergenza o minaccia alla sicurezza. Dati dal sito ufficiale (30/10/2026), da ricontrollare prima di partire:{' '}
          <a href={EMBASSY.contactsUrl} target="_blank" rel="noopener noreferrer" className="underline">contatti</a>,{' '}
          <a href={EMBASSY.emergencyUrl} target="_blank" rel="noopener noreferrer" className="underline">emergenze</a>.
        </p>
      </Section>
    </div>
  );
};

export default SosView;
