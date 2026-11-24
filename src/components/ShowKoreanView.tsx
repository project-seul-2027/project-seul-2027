import './mobile/mobile.css';
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuickIntent } from '../utils/quickIntent';
import { Search, X, ExternalLink, Phone, Maximize2, Car, Utensils, MessageCircle, Languages, Siren, AlertTriangle, Home, Plane, Clock, Volume2, Square } from 'lucide-react';
import { ACCOMMODATIONS, ITINERARY_DAYS, MAP_LOCATIONS, PRE_TRIP_CHECKLIST, getNaverMapSearchUrl, type MapLocation } from '../data/tripData';
import { useAuth } from '../auth/AuthContext';
import {
  ALLERGEN_OPTIONS, EMERGENCY_NUMBERS, PHRASE_GROUPS, buildDietCard, cleanKoreanName, dietKind, hasHangul,
  withDirectionParticle, spokenPlaceName, type Phrase
} from '../data/koreanHelp';
import {
  BEIJING_DEPARTURE_MS, BEIJING_LANDING_MS, BEIJING_RETURN_MS, ZH_DESTINATIONS, ZH_EMERGENCY_NUMBERS, ZH_PHRASE_GROUPS, ZH_TAXI_LINE,
  ZH_TRANSIT_COUNTER, amapSearchUrl, beijingClock, buildDietCardZh, isChineseMoment, type ZhDestination
} from '../data/chineseHelp';
import { SHOW_LANGS, wrapClass, type ShowLang, type ShowLine } from '../data/showLanguage';
import { FreeTranslate } from './FreeTranslate';
import { MenuScanner } from './MenuScanner';
import { KoreanPriceGuide } from './KoreanPriceGuide';
import { formatCountdown, locateNow } from '../utils/tripClock';
import { nowOrSim } from '../shared/tripPresence';
import { useSpeech } from '../utils/speech';

type Section = 'dest' | 'transit' | 'food' | 'phrases' | 'free' | 'sos';

const SECTIONS_BY_LANG: Record<ShowLang, { id: Section; label: string; icon: React.ElementType }[]> = {
  ko: [
    { id: 'dest', label: 'Dove', icon: Car },
    { id: 'food', label: 'Cibo', icon: Utensils },
    { id: 'phrases', label: 'Frasi', icon: MessageCircle },
    { id: 'free', label: 'Traduci', icon: Languages },
    { id: 'sos', label: 'Aiuto', icon: Siren }
  ],
  zh: [
    { id: 'transit', label: 'Scalo', icon: Plane },
    { id: 'dest', label: 'Dove', icon: Car },
    { id: 'food', label: 'Cibo', icon: Utensils },
    { id: 'phrases', label: 'Frasi', icon: MessageCircle },
    { id: 'free', label: 'Traduci', icon: Languages },
    { id: 'sos', label: 'Aiuto', icon: Siren }
  ]
};

const LANG_KEY = 'seul2027:show:lang';

/** Lingua iniziale: quella scelta in questa sessione, altrimenti il cinese solo durante gli scali a Pechino. */
function initialLang(): ShowLang {
  try {
    const saved = sessionStorage.getItem(LANG_KEY);
    if (saved === 'ko' || saved === 'zh') return saved;
  } catch {
    /* niente */
  }
  return isChineseMoment(nowOrSim()) ? 'zh' : 'ko';
}

const fromPhrase = (p: Phrase): ShowLine => ({ text: p.ko, rom: p.rom, it: p.it });
const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, '')}`;
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';

interface OverlayContent {
  kicker?: string;
  lang: ShowLang;
  lines: ShowLine[];
  /** Testo esatto da pronunciare, se diverso dalle righe mostrate (evita ripetizioni) */
  spoken?: string;
  /** Nome del luogo, in grande sopra la frase */
  place?: { text: string; it: string; mapUrl: string; mapLabel: string };
}

/** Schermo intero bianco con testo grande: si legge da lontano e sotto il sole. */
const ShowOverlay: React.FC<{
  content: OverlayContent;
  onClose: () => void;
  speechSupported: boolean;
  speakingId: string | null;
  speechError: string | null;
  onSpeak: (text: string, lang: ShowLang, id: string) => void;
}> = ({ content, onClose, speechSupported, speakingId, speechError, onSpeak }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const htmlLang = SHOW_LANGS[content.lang].htmlLang;
  const wrap = wrapClass(content.lang);
  const linesText = content.lines.map((l) => l.text).join(' ');
  const placeIncluded = !!content.place?.text && linesText.includes(content.place.text);
  const spokenText = content.spoken ?? (placeIncluded ? linesText : [content.place?.text, linesText].filter(Boolean).join(' '));
  const isSpeaking = speakingId === 'overlay';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Da mostrare in ${SHOW_LANGS[content.lang].label.toLowerCase()}`}
      className="fixed inset-0 z-[90] bg-white text-slate-950 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      data-keep-style
      data-testid="show-overlay"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 shrink-0">
        <span className="text-xs font-semibold text-slate-500">{content.kicker ?? 'Da mostrare'}</span>
        <div className="flex items-center gap-2">
          {speechSupported && spokenText && (
            <button
              type="button"
              onClick={() => onSpeak(spokenText, content.lang, 'overlay')}
              aria-label={isSpeaking ? 'Ferma audio' : 'Ascolta pronuncia'}
              aria-pressed={isSpeaking}
              data-keep-style
              className={`h-12 px-4 rounded-full font-semibold text-sm flex items-center gap-2 transition-colors ${FOCUS_RING} ${
                isSpeaking ? 'bg-cyan-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
              }`}
              data-testid="overlay-speak"
            >
              {isSpeaking ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
              {isSpeaking ? 'Stop' : 'Ascolta'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            data-keep-style
            className={`w-12 h-12 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-colors ${FOCUS_RING}`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>
      {speechError && (
        <div role="alert" className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 text-center shrink-0">
          {speechError}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-8 flex flex-col justify-center gap-7 text-center">
        {content.place && (
          <div>
            <div className={`font-black leading-tight ${wrap} text-[clamp(2.4rem,11vw,5.5rem)]`} lang={htmlLang}>{content.place.text}</div>
            <div className="mt-1.5 text-sm text-slate-500">{content.place.it}</div>
          </div>
        )}
        {content.lines.map((l, i) => (
          <div key={i}>
            <div className={`font-extrabold leading-snug ${wrap} ${content.place ? 'text-[clamp(1.5rem,6.5vw,2.8rem)]' : 'text-[clamp(1.7rem,7.5vw,3.2rem)]'}`} lang={htmlLang}>{l.text}</div>
            <div className="mt-1.5 text-[clamp(0.9rem,3.2vw,1.15rem)] text-slate-600">{l.it}</div>
          </div>
        ))}
      </div>
      {content.place && (
        <div className="px-4 py-3 border-t border-slate-200 shrink-0">
          <a
            href={content.place.mapUrl}
            target="_blank"
            rel="noreferrer"
            className={`w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${FOCUS_RING}`}
          >
            <ExternalLink className="w-4 h-4" /> {content.place.mapLabel}
          </a>
        </div>
      )}
    </div>,
    document.body
  );
};

const PhraseRow: React.FC<{
  p: ShowLine;
  lang: ShowLang;
  onShow: () => void;
  speechSupported?: boolean;
  speaking?: boolean;
  onSpeak?: () => void;
}> = ({ p, lang, onShow, speechSupported, speaking, onSpeak }) => (
  <div className="border-t border-white/10 lg:hover:bg-white/[0.03] flex items-center gap-2 min-h-[64px] transition-colors">
    <button
      type="button"
      onClick={onShow}
      className={`min-w-0 flex-1 text-left py-3.5 lg:pl-3 flex items-center gap-3 ${FOCUS_RING}`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block text-base sm:text-lg font-semibold text-white leading-snug ${wrapClass(lang)}`} lang={SHOW_LANGS[lang].htmlLang}>{p.text}</span>
        {p.rom && <span className="block text-xs text-slate-400 italic mt-0.5">{p.rom}</span>}
        <span className="block text-xs sm:text-sm text-slate-300 mt-0.5">{p.it}</span>
      </span>
      <Maximize2 className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
    </button>
    {speechSupported && onSpeak && (
      <button
        type="button"
        onClick={onSpeak}
        aria-label={speaking ? `Ferma audio: ${p.it}` : `Ascolta: ${p.it}`}
        aria-pressed={speaking}
        data-keep-style
        className={`mr-0 lg:mr-2 min-h-11 min-w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${FOCUS_RING} ${
          speaking ? 'bg-[#52d9e6] text-[#04242a]' : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] hover:text-white'
        }`}
        data-testid="phrase-speak"
      >
        {speaking ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-4 h-4" />}
      </button>
    )}
  </div>
);

const SectionHeading: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({ children, icon }) => (
  <h3 className="font-display text-sm font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
    {icon}
    {children}
  </h3>
);

/* ---------- Scalo a Pechino ---------- */

/** Voci della Guida che riguardano lo scalo: stessa memoria della Guida, così la spunta vale in entrambi i posti. */
const GUIDE_CHECK_KEY = 'seoul2027_checklist';
const GUIDE_TRANSIT_IDS = ['ch_2', 'ch_3', 'ch_9', 'ch_10', 'ch_7', 'ch_8', 'ch_5', 'ch_4', 'ch_12'];
/** Voci del giorno stesso, solo qui */
const DAY_CHECK_KEY = 'seul2027:transit:checklist';
const DAY_ITEMS = [
  { id: 't_bags', label: 'Al check-in di Incheon: valigie etichettate fino a Milano (MXP)' },
  { id: 't_boarding', label: 'Entrambe le carte d’imbarco: Incheon–Pechino e Pechino–Milano' },
  { id: 't_qr', label: 'QR della Arrival Card salvato o in screenshot' }
];

function readChecks(key: string): Record<string, boolean> {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    return raw && typeof raw === 'object' ? (raw as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

const shortLabel = (s: string) => s.replace(/\s*\(.*\)\s*$/, '');

const CheckRow: React.FC<{ on: boolean; label: string; required?: boolean; onToggle: () => void }> = ({ on, label, required, onToggle }) => (
  <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} className={`ms-ck ${FOCUS_RING}`}>
    <span className="box" data-on={on}>{on && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
    <span className={on ? 'done' : ''}>
      {label}
      {required && !on && <em>obbligatorio</em>}
    </span>
  </button>
);

const TransitPanel: React.FC<{ onShow: (c: OverlayContent) => void }> = ({ onShow }) => {
  const [now, setNow] = useState(nowOrSim);
  useEffect(() => {
    const t = window.setInterval(() => setNow(nowOrSim()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const [guideChecks, setGuideChecks] = useState(() => readChecks(GUIDE_CHECK_KEY));
  const [dayChecks, setDayChecks] = useState(() => readChecks(DAY_CHECK_KEY));
  // Rilegge dal telefono prima di scrivere, per non cancellare le spunte messe nella Guida
  const toggle = (key: string, id: string, set: (v: Record<string, boolean>) => void) => {
    const next = { ...readChecks(key), [id]: !readChecks(key)[id] };
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* niente */
    }
    set(next);
  };

  const guideItems = GUIDE_TRANSIT_IDS.map((id) => PRE_TRIP_CHECKLIST.find((i) => i.id === id)).filter((i): i is (typeof PRE_TRIP_CHECKLIST)[number] => !!i);
  const total = guideItems.length + DAY_ITEMS.length;
  const done = guideItems.filter((i) => guideChecks[i.id]).length + DAY_ITEMS.filter((i) => dayChecks[i.id]).length;

  // Programma a Pechino: le tappe del giorno dello scalo, dall'atterraggio in poi
  const day = ITINERARY_DAYS.find((d) => d.locationIds.includes('beijing_qianmen') && d.schedule?.length);
  const schedule = day?.schedule ?? [];
  const fromIdx = schedule.findIndex((s) => /pechino/i.test(s.time));
  const beijingItems = fromIdx >= 0 ? schedule.slice(fromIdx) : [];
  const fallbackTip = day?.tips?.[0];

  const onDay = now >= BEIJING_LANDING_MS - 6 * 3_600_000 && now <= BEIJING_DEPARTURE_MS;
  let status: { title: string; sub: string; urgent?: boolean };
  if (now < BEIJING_LANDING_MS - 6 * 3_600_000) {
    status = { title: 'Rientro al Terminal 3 entro le 22:45', sub: '19 marzo, ora di Pechino: atterraggio alle 14:20, decollo per Milano alle 02:15.' };
  } else if (now < BEIJING_LANDING_MS) {
    status = { title: 'Atterraggio a Pechino alle 14:20', sub: 'Poi banco transito 240h. Rientro al Terminal 3 entro le 22:45.' };
  } else if (now < BEIJING_RETURN_MS) {
    const left = BEIJING_RETURN_MS - now;
    status = { title: `Al Terminal 3 entro le 22:45: mancano ${formatCountdown(left)}`, sub: 'Ultimo Airport Express da Dongzhimen verso le 22:30 (da verificare): partire entro le 21:15.', urgent: left <= 90 * 60_000 };
  } else if (now < BEIJING_DEPARTURE_MS) {
    status = { title: 'Ora si sta al Terminal 3', sub: 'Check-in Air China dalle 23:15, decollo per Milano alle 02:15.', urgent: true };
  } else {
    status = { title: 'Scalo concluso', sub: 'Il volo per Milano è partito alle 02:15 del 20 marzo.' };
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 items-start" data-testid="transit-panel">
      <div className="space-y-6">
        <section
          className="rounded-xl bg-[#101c29] px-4 py-4"
          data-keep-style
          data-testid="transit-status"
          aria-live="polite"
        >
          <p className={`flex items-start gap-2.5 text-base font-semibold ${status.urgent ? 'text-amber-200' : 'text-white'}`}>
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#52d9e6]" aria-hidden="true" />
            {status.title}
          </p>
          <p className="mt-1.5 pl-6.5 text-sm leading-relaxed text-slate-300">{status.sub}</p>
          {onDay && <p className="mt-2 pl-6.5 text-xs text-slate-400">Ora a Pechino: <span className="tabular-nums text-slate-200">{beijingClock(now)}</span></p>}
        </section>

        <section data-testid="transit-counter">
          <h3 className="font-display text-base font-semibold text-white">Al banco transito 240h</h3>
          <p className="mt-1 text-sm text-slate-400">All’arrivo al Terminal 3 seguire “Transit 240h” e tenere pronti:</p>
          <ul className="mt-2.5 space-y-1.5 text-sm text-slate-200 list-disc pl-5 marker:text-[#52d9e6]">
            <li>Passaporto</li>
            <li>Carta d’imbarco o prenotazione Pechino–Milano (CA949)</li>
            <li>QR della Arrival Card</li>
            <li>Eventuale prenotazione dell’hotel</li>
          </ul>
          <button
            type="button"
            onClick={() => onShow({ kicker: 'Al banco transito 240h', lang: 'zh', lines: ZH_TRANSIT_COUNTER })}
            className={`mt-4 w-full sm:w-auto sm:px-6 min-h-[48px] rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${FOCUS_RING}`}
            data-keep-style
            data-testid="show-transit-counter"
          >
            <Maximize2 className="w-4 h-4" /> Mostra all’agente
          </button>
        </section>

        {beijingItems.length > 0 && (
          <section data-testid="transit-schedule">
            <h3 className="font-display text-base font-semibold text-white">Il programma a Pechino</h3>
            <ol className="mt-3 divide-y divide-white/[0.08]">
              {beijingItems.map((s, i) => (
                <li key={`${s.time}-${i}`} className="grid grid-cols-[6rem_1fr] gap-3 py-2.5 text-sm">
                  <span className={`tabular-nums ${s.isHighlight ? 'text-[#52d9e6] font-semibold' : 'text-slate-400'}`}>{s.time.replace(/\s*\(Pechino\)/i, '')}</span>
                  <span className="text-slate-200">{s.summary ?? s.activity}</span>
                </li>
              ))}
            </ol>
            {fallbackTip && <p className="mt-3 text-xs leading-relaxed text-slate-400">{fallbackTip}</p>}
          </section>
        )}
      </div>

      <section data-testid="transit-checklist">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-white">Prima dello scalo</h3>
          <span className="text-sm tabular-nums text-slate-400"><b className="text-white">{done}</b> di {total}</span>
        </div>
        <p className="mt-1 mb-3 text-xs text-slate-400">Le voci della Guida restano spuntate anche lì.</p>
        <div>
          {guideItems.map((item) => (
            <CheckRow key={item.id} on={!!guideChecks[item.id]} label={shortLabel(item.label)} required={item.required} onToggle={() => toggle(GUIDE_CHECK_KEY, item.id, setGuideChecks)} />
          ))}
        </div>
        <h4 className="mt-5 mb-2 font-display text-sm font-semibold text-slate-300">Il giorno stesso</h4>
        <div>
          {DAY_ITEMS.map((item) => (
            <CheckRow key={item.id} on={!!dayChecks[item.id]} label={item.label} onToggle={() => toggle(DAY_CHECK_KEY, item.id, setDayChecks)} />
          ))}
        </div>
      </section>
    </div>
  );
};

export const ShowKoreanView: React.FC = () => {
  const { user, group } = useAuth();
  const speech = useSpeech();
  const [lang, setLangState] = useState<ShowLang>(initialLang);
  const [section, setSection] = useState<Section>(() => (initialLang() === 'zh' ? 'transit' : 'dest'));
  // Pulsante + → Traduci
  useQuickIntent('translate', () => setSection('free'));
  const [overlay, setOverlay] = useState<OverlayContent | null>(null);
  const [query, setQuery] = useState('');
  const sections = SECTIONS_BY_LANG[lang];
  const meta = SHOW_LANGS[lang];
  const htmlLang = meta.htmlLang;

  const setLang = (next: ShowLang) => {
    if (next === lang) return;
    setLangState(next);
    setQuery('');
    try {
      sessionStorage.setItem(LANG_KEY, next);
    } catch {
      /* niente */
    }
    if (!SECTIONS_BY_LANG[next].some((s) => s.id === section)) setSection('dest');
  };

  /* ---------- Destinazioni ---------- */
  const todayStopIds = useMemo(() => {
    const where = locateNow(Date.now());
    return where.phase === 'during' ? ITINERARY_DAYS[where.dayIndex].locationIds : [];
  }, []);

  const destinations = useMemo(
    () => MAP_LOCATIONS.filter((l) => (l.city === 'Seul' || l.city === 'Dintorni / Gite') && hasHangul(l.koreanName)),
    []
  );
  const homeId = user?.accommodationPreference ?? 'acc_c';
  const home = ACCOMMODATIONS.find((a) => a.id === homeId);
  const homeLoc = destinations.find((d) => d.id === homeId);

  const q = query.trim().toLowerCase();
  const filtered = destinations.filter((d) => !q || `${d.italianName} ${d.name} ${d.district} ${d.koreanName ?? ''}`.toLowerCase().includes(q));
  const today = filtered.filter((d) => todayStopIds.includes(d.id) && d.id !== homeId);
  const others = filtered.filter((d) => !todayStopIds.includes(d.id) || d.id === homeId);
  const zhFiltered = ZH_DESTINATIONS.filter((d) => !q || `${d.it} ${d.area} ${d.zh} ${d.py}`.toLowerCase().includes(q));

  const openDestination = (d: MapLocation) => {
    const ko = cleanKoreanName(d.koreanName ?? '');
    setOverlay({
      kicker: 'Per il tassista',
      lang: 'ko',
      place: { text: ko, it: spokenPlaceName(d.italianName), mapUrl: getNaverMapSearchUrl(d), mapLabel: 'Apri su Naver Map' },
      lines: [{ text: `${withDirectionParticle(ko)} 가 주세요.`, rom: '', it: `Mi porti a: ${spokenPlaceName(d.italianName)}, per favore.` }]
    });
  };

  const openZhDestination = (d: ZhDestination) =>
    setOverlay({
      kicker: 'Per il tassista',
      lang: 'zh',
      place: { text: d.zh, it: d.it, mapUrl: amapSearchUrl(d.zh), mapLabel: 'Apri su Amap' },
      lines: [ZH_TAXI_LINE, ...(d.extra ?? [])]
    });

  const DestButton = ({ d, tag }: { d: MapLocation; tag?: string }) => (
    <button
      type="button"
      onClick={() => openDestination(d)}
      className={`w-full text-left border-t border-white/10 py-3.5 lg:px-3 lg:hover:bg-white/[0.03] flex items-center gap-3 min-h-[60px] transition-colors ${FOCUS_RING}`}
      data-testid="dest-row"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-100 truncate">{d.italianName}</span>
          {tag && <span className="text-xs font-semibold text-[#52d9e6] shrink-0">{tag}</span>}
        </span>
        <span className="block text-xs text-slate-400 truncate mt-0.5">{d.district}</span>
      </span>
      <span className="text-base font-semibold text-white shrink-0" lang="ko">{cleanKoreanName(d.koreanName ?? '')}</span>
    </button>
  );

  const ZhDestButton = ({ d }: { d: ZhDestination }) => (
    <button
      type="button"
      onClick={() => openZhDestination(d)}
      className={`w-full text-left border-t border-white/10 py-3.5 lg:px-3 lg:hover:bg-white/[0.03] flex items-center gap-3 min-h-[60px] transition-colors ${FOCUS_RING}`}
      data-testid="dest-row-zh"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-100 truncate">{d.it}</span>
        <span className="block text-xs text-slate-400 truncate mt-0.5">{d.area}</span>
      </span>
      <span className="max-w-[45%] text-right text-base font-semibold text-white break-words" lang="zh-CN">{d.zh}</span>
    </button>
  );

  /* ---------- Cibo: dieta e allergie ---------- */
  const people = useMemo(() => {
    const list: { key: string; label: string; diet: string; allergies: string }[] = [];
    if (user) {
      list.push({ key: 'me', label: 'Io', diet: user.dietaryPreference, allergies: user.allergies ?? '' });
    }
    group.forEach((m) => {
      if (user && m.travelerId === user.travelerId) return;
      list.push({ key: m.id, label: m.displayName || m.firstName, diet: m.dietaryPreference, allergies: m.allergies ?? '' });
    });
    return list;
  }, [user, group]);
  const [personKey, setPersonKey] = useState('me');
  const person = people.find((p) => p.key === personKey) ?? people[0];
  const [severe, setSevere] = useState(false);
  const [extraAllergens, setExtraAllergens] = useState<string[]>([]);
  useEffect(() => setExtraAllergens([]), [personKey]);

  const diet = useMemo(() => {
    const build = lang === 'zh' ? buildDietCardZh : buildDietCard;
    return build(person?.diet, `${person?.allergies ?? ''} ${extraAllergens.join(' ')}`, severe);
  }, [person, severe, extraAllergens, lang]);
  const dietLines = diet.lines.map(fromPhrase);
  const showDiet = () =>
    setOverlay({
      kicker: `Per il ristorante · ${person?.label ?? ''}`,
      lang,
      lines: dietLines
    });
  const toggleAllergen = (key: string) =>
    setExtraAllergens((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const noRestriction = dietKind(person?.diet) === 'any' && diet.recognized.length === 0 && !diet.unrecognized;
  const phraseGroups = lang === 'zh' ? ZH_PHRASE_GROUPS : PHRASE_GROUPS.map((g) => ({ id: g.id, title: g.title, phrases: g.phrases.map(fromPhrase) }));
  const emergencyGroup = phraseGroups.find((g) => g.id === 'emergenza');
  const numbers = lang === 'zh' ? ZH_EMERGENCY_NUMBERS : EMERGENCY_NUMBERS;

  return (
    <div className="space-y-5 pb-6 animate-in fade-in duration-200 ms-kr" data-testid="show-korean-view" data-lang={lang}>
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold font-display text-white lg:hidden">Mostra in {meta.label.toLowerCase()}</h2>
        <p className="text-sm text-slate-400 max-w-2xl">
          {lang === 'zh'
            ? 'Per lo scalo a Pechino. Tocca una scheda per aprirla a schermo intero in cinese semplificato.'
            : 'Tocca una scheda: si apre a schermo intero, con testo grande da far leggere a tassista o cameriere.'}
        </p>
      </div>

      {/* Lingua */}
      {speech.error && (
        <p role="alert" className="text-xs text-amber-300 flex items-start gap-2" data-testid="speech-error">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{speech.error}</span>
        </p>
      )}
      <div role="radiogroup" aria-label="Lingua" className="flex gap-2 lg:max-w-md" data-testid="show-lang">
        {(['ko', 'zh'] as const).map((l) => {
          const selected = l === lang;
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setLang(l)}
              data-keep-style
              className={`min-h-11 flex-1 rounded-xl px-4 text-sm flex items-center justify-center gap-2 transition-colors ${FOCUS_RING} ${
                selected ? 'bg-[#52d9e6] font-semibold text-[#04242a]' : 'bg-[#101c29] text-slate-200 hover:bg-[#152536]'
              }`}
              data-testid={`lang-${l}`}
            >
              {l === 'ko' ? 'Seul' : 'Scalo a Pechino'}
              <span lang={SHOW_LANGS[l].htmlLang} className={selected ? 'text-[#04242a]/70 text-xs font-medium' : 'text-slate-400 text-xs font-medium'}>{SHOW_LANGS[l].native}</span>
            </button>
          );
        })}
      </div>

      {/* Sezioni */}
      <div role="tablist" className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
        {sections.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSection(s.id)}
              className={`relative min-h-[44px] px-3 sm:px-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${FOCUS_RING} ${
                active ? 'text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
              data-testid={`sec-${s.id}`}
            >
              <s.icon className={`w-4 h-4 ${active ? 'text-[#52d9e6]' : 'text-slate-500'}`} aria-hidden="true" />
              {s.label}
              {active && <span aria-hidden="true" className="hidden lg:block absolute inset-x-0 bottom-0 h-0.5 bg-[#52d9e6]" />}
            </button>
          );
        })}
      </div>

      {section === 'transit' && lang === 'zh' && <TransitPanel onShow={setOverlay} />}

      {section === 'dest' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === 'zh' ? 'Cerca un luogo (es. Qianmen, aeroporto)' : 'Cerca un luogo (es. Hongdae, Namsan)'}
                className="w-full bg-[#101c29] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#52d9e6]"
                data-keep-style
              />
            </div>
            {lang === 'ko' && home && homeLoc && !query && (
              <div>
                <SectionHeading icon={<Home className="w-4 h-4 text-[#52d9e6]" aria-hidden="true" />}>Il tuo alloggio</SectionHeading>
                <DestButton d={homeLoc} tag="casa" />
              </div>
            )}
            {lang === 'ko' && today.length > 0 && (
              <div>
                <SectionHeading>Tappe di oggi</SectionHeading>
                <div>{today.map((d) => <DestButton key={d.id} d={d} tag="oggi" />)}</div>
              </div>
            )}
            {lang === 'zh' && (
              <p className="text-xs text-slate-400 leading-relaxed">
                In Cina Google Maps non funziona senza roaming: il pulsante della scheda apre Amap. I taxi si pagano anche con Alipay o WeChat Pay.
              </p>
            )}
          </div>
          <div>
            <SectionHeading>{lang === 'zh' ? 'Luoghi dello scalo' : 'Tutti i luoghi'}</SectionHeading>
            <div>
              {lang === 'ko' ? (
                <>
                  {others.map((d) => <DestButton key={d.id} d={d} />)}
                  {others.length === 0 && today.length === 0 && <p className="text-sm text-slate-400 py-3">Nessun luogo trovato.</p>}
                </>
              ) : (
                <>
                  {zhFiltered.map((d) => <ZhDestButton key={d.id} d={d} />)}
                  {zhFiltered.length === 0 && <p className="text-sm text-slate-400 py-3">Nessun luogo trovato.</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {section === 'food' && (
        <div className="space-y-6">
          <MenuScanner
            lang={lang}
            groupProfiles={people.map((p) => ({ name: p.label, diet: p.diet, allergies: p.allergies }))}
            onOrderDish={(dish, line) =>
              setOverlay({
                kicker: 'Per il cameriere',
                lang,
                lines: [
                  { text: dish.original, rom: '', it: dish.italian },
                  line
                ]
              })
            }
          />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-5">
            {people.length > 1 && (
              <div>
                <SectionHeading>Per chi ordini</SectionHeading>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => {
                    const active = person?.key === p.key;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => setPersonKey(p.key)}
                        aria-pressed={active}
                        data-keep-style
                        className={`px-4 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${FOCUS_RING} ${
                          active ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-[#101c29] text-slate-200 hover:bg-[#152536]'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="rounded-xl bg-[#101c29] p-4 text-sm text-slate-300 space-y-1.5" data-keep-style>
              <div><span className="text-slate-400">Dieta:</span> {person?.diet || 'non indicata'}</div>
              <div><span className="text-slate-400">Allergie:</span> {person?.allergies?.trim() || (person?.key === 'me' ? 'nessuna indicata nel profilo' : 'non condivise')}</div>
              {diet.unrecognized && (
                <p className="text-xs text-amber-300 flex gap-2 pt-1"><AlertTriangle className="w-4 h-4 shrink-0" /> Non riconosco “{diet.unrecognized}”: scegli qui sotto gli alimenti da evitare, così li traduco.</p>
              )}
            </div>
            <div>
              <SectionHeading>Aggiungi alimenti da evitare</SectionHeading>
              <div className="flex flex-wrap gap-2">
                {ALLERGEN_OPTIONS.map((a) => {
                  const active = extraAllergens.includes(a.key);
                  return (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => toggleAllergen(a.key)}
                      aria-pressed={active}
                      data-keep-style
                      className={`px-3 min-h-[40px] rounded-xl text-xs font-medium transition-colors ${FOCUS_RING} ${
                        active ? 'bg-[#52d9e6] text-[#04242a] font-semibold' : 'bg-[#101c29] text-slate-200 hover:bg-[#152536]'
                      }`}
                    >
                      {a.it} <span className={active ? 'text-[#04242a]/70' : 'text-slate-400'} lang={htmlLang}>{lang === 'zh' ? a.zh : a.ko}</span>
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 flex items-center gap-3 text-sm text-slate-200 min-h-[44px] cursor-pointer">
                <input type="checkbox" checked={severe} onChange={(e) => setSevere(e.target.checked)} className="w-5 h-5 accent-[#52d9e6]" />
                Allergia grave (anche tracce sono pericolose)
              </label>
            </div>
          </div>

          <div className="rounded-xl bg-[#101c29] p-5 space-y-4" data-keep-style data-testid="diet-card">
            <div className="font-display text-sm font-semibold text-[#52d9e6]">{diet.title}</div>
            <div className="space-y-3">
              {dietLines.map((l, i) => (
                <div key={i}>
                  <div className={`text-lg font-semibold text-white leading-snug ${wrapClass(lang)}`} lang={htmlLang}>{l.text}</div>
                  <div className="text-xs text-slate-400 italic mt-0.5">{l.rom}</div>
                  <div className="text-xs sm:text-sm text-slate-300 mt-0.5">{l.it}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={showDiet}
                data-keep-style
                className={`flex-1 min-h-[48px] rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] text-[#04242a] font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${FOCUS_RING}`}
                data-testid="show-diet"
              >
                <Maximize2 className="w-4 h-4" /> {noRestriction ? 'Mostra la scheda' : 'Mostra al cameriere'}
              </button>
              {speech.supported && (
                <button
                  type="button"
                  onClick={() => speech.speak(dietLines.map((l) => l.text).join(' '), lang, 'diet-card')}
                  aria-label="Ascolta la scheda dieta"
                  aria-pressed={speech.speakingId === 'diet-card'}
                  data-keep-style
                  className={`min-h-[48px] px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-colors ${FOCUS_RING} ${
                    speech.speakingId === 'diet-card' ? 'bg-[#52d9e6] text-[#04242a]' : 'bg-white/[0.07] hover:bg-white/[0.12] text-slate-200'
                  }`}
                >
                  {speech.speakingId === 'diet-card' ? <Square className="w-4 h-4 fill-current" /> : <Volume2 className="w-4 h-4" />}
                  <span className="hidden sm:inline">{speech.speakingId === 'diet-card' ? 'Stop' : 'Ascolta'}</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {lang === 'zh'
                ? 'Le allergie gravi vanno sempre ricontrollate: nella cucina cinese salsa di soia, salsa d’ostrica e strutto sono molto comuni anche quando non si vedono.'
                : 'Le allergie gravi vanno sempre ricontrollate: nei piatti coreani brodi e salse spesso contengono pesce, soia o glutine anche quando non si vede.'}
            </p>
          </div>
          </div>
        </div>
      )}

      {section === 'free' && <FreeTranslate key={lang} lang={lang} onShow={(l) => setOverlay({ kicker: 'Traduzione', lang, lines: [l] })} />}

      {section === 'phrases' && (
        <div className="space-y-6">
          {lang === 'ko' && (
            <KoreanPriceGuide
              speechSupported={speech.supported}
              speakingId={speech.speakingId}
              onSpeak={(text, id) => speech.speak(text, 'ko', id)}
              onShow={(kicker, line, spoken) => setOverlay({ kicker, lang: 'ko', lines: [line], spoken })}
            />
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
            {phraseGroups.filter((g) => g.id !== 'emergenza').map((g) => (
              <div key={g.id}>
                <SectionHeading>{g.title}</SectionHeading>
                <div>
                  {g.phrases.map((p) => {
                    const pid = `ph-${lang}-${p.text}`;
                    return (
                      <PhraseRow
                        key={p.text}
                        p={p}
                        lang={lang}
                        onShow={() => setOverlay({ kicker: g.title, lang, lines: [p] })}
                        speechSupported={speech.supported}
                        speaking={speech.speakingId === pid}
                        onSpeak={() => speech.speak(p.text, lang, pid)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {section === 'sos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6 items-start">
          <div>
            <SectionHeading>Numeri in {meta.country}</SectionHeading>
            <div className="divide-y divide-white/10 border-t border-white/10">
              {numbers.map((n) => {
                const isLong = n.number.length > 6;
                return (
                  <a
                    key={n.number}
                    href={telHref(n.number)}
                    data-keep-style
                    className={`group flex items-center justify-between gap-4 py-3.5 lg:px-3 hover:bg-white/[0.03] min-h-[64px] transition-colors ${FOCUS_RING}`}
                  >
                    {isLong ? (
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-300">{n.label}</span>
                        <span className="mt-0.5 block text-lg sm:text-xl font-bold font-display text-white tabular-nums whitespace-nowrap">{n.number}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-4 min-w-0 flex-1">
                        <span className="text-2xl font-bold font-display text-white tabular-nums whitespace-nowrap min-w-[4.25rem]">{n.number}</span>
                        <span className="text-sm text-slate-200 leading-snug">{n.label}</span>
                      </span>
                    )}
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/12 text-rose-400 group-hover:bg-rose-500/20 transition-colors" aria-hidden="true">
                      <Phone className="w-4 h-4" />
                    </span>
                  </a>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              {lang === 'zh'
                ? 'Tocca un numero per chiamare direttamente. In Cina per chiamare l’Italia serve il prefisso internazionale +39.'
                : 'Prima di partire salva anche il numero dell’Ambasciata d’Italia a Seul dal sito del Ministero degli Esteri: qui non l’ho riportato perché non l’ho verificato.'}
            </p>
          </div>
          {emergencyGroup && (
            <div>
              <SectionHeading>Frasi per le emergenze</SectionHeading>
              <div>
                {emergencyGroup.phrases.map((p) => {
                  const pid = `sos-${lang}-${p.text}`;
                  return (
                    <PhraseRow
                      key={p.text}
                      p={p}
                      lang={lang}
                      onShow={() => setOverlay({ kicker: 'Emergenza', lang, lines: [p] })}
                      speechSupported={speech.supported}
                      speaking={speech.speakingId === pid}
                      onSpeak={() => speech.speak(p.text, lang, pid)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {overlay && (
        <ShowOverlay
          content={overlay}
          onClose={() => {
            speech.stop();
            setOverlay(null);
          }}
          speechSupported={speech.supported}
          speakingId={speech.speakingId}
          speechError={speech.error}
          onSpeak={speech.speak}
        />
      )}
    </div>
  );
};

export default ShowKoreanView;
