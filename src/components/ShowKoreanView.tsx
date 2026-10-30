import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, ExternalLink, Phone, Maximize2, Car, Utensils, MessageCircle, Languages, Siren, AlertTriangle, Home } from 'lucide-react';
import { ACCOMMODATIONS, ITINERARY_DAYS, MAP_LOCATIONS, getNaverMapSearchUrl, type MapLocation } from '../data/tripData';
import { useAuth } from '../auth/AuthContext';
import {
  ALLERGEN_OPTIONS, EMERGENCY_NUMBERS, PHRASE_GROUPS, buildDietCard, cleanKoreanName, dietKind, hasHangul,
  withDirectionParticle, type Phrase
} from '../data/koreanHelp';
import { FreeTranslate } from './FreeTranslate';
import { locateNow } from '../utils/tripClock';

type Section = 'dest' | 'food' | 'phrases' | 'free' | 'sos';

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: 'dest', label: 'Dove', icon: Car },
  { id: 'food', label: 'Cibo', icon: Utensils },
  { id: 'phrases', label: 'Frasi', icon: MessageCircle },
  { id: 'free', label: 'Traduci', icon: Languages },
  { id: 'sos', label: 'Aiuto', icon: Siren }
];

interface OverlayContent {
  kicker?: string;
  lines: Phrase[];
  /** Nome del luogo, in grande sotto la frase */
  place?: { ko: string; it: string; naver: string };
}

/** Schermo intero bianco con testo grande: si legge da lontano e sotto il sole. */
const ShowOverlay: React.FC<{ content: OverlayContent; onClose: () => void }> = ({ content, onClose }) => {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Da mostrare in coreano"
      className="fixed inset-0 z-[90] bg-white text-slate-950 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      data-testid="show-overlay"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 shrink-0">
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{content.kicker ?? 'Da mostrare'}</span>
        <button type="button" onClick={onClose} aria-label="Chiudi" className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-6 flex flex-col justify-center gap-7 text-center">
        {content.place && (
          <div>
            <div className="font-black leading-tight break-keep text-[clamp(2.4rem,11vw,5.5rem)]" lang="ko">{content.place.ko}</div>
            <div className="mt-1 text-sm text-slate-500">{content.place.it}</div>
          </div>
        )}
        {content.lines.map((l, i) => (
          <div key={i}>
            <div className={`font-extrabold leading-snug break-keep ${content.place ? 'text-[clamp(1.5rem,6.5vw,2.8rem)]' : 'text-[clamp(1.7rem,7.5vw,3.2rem)]'}`} lang="ko">{l.ko}</div>
            <div className="mt-1.5 text-[clamp(0.9rem,3.2vw,1.15rem)] text-slate-600">{l.it}</div>
          </div>
        ))}
      </div>
      {content.place && (
        <div className="px-4 py-3 border-t border-slate-200 shrink-0">
          <a href={content.place.naver} target="_blank" rel="noreferrer" className="w-full min-h-[48px] rounded-2xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2">
            <ExternalLink className="w-4 h-4" /> Apri su Naver Map
          </a>
        </div>
      )}
    </div>
  );
};

const PhraseRow: React.FC<{ p: Phrase; onShow: () => void }> = ({ p, onShow }) => (
  <button
    type="button"
    onClick={onShow}
    className="w-full text-left rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-rose-500/40 px-4 py-3 flex items-center gap-3 min-h-[64px]"
  >
    <span className="min-w-0 flex-1">
      <span className="block text-lg font-bold text-white leading-snug" lang="ko">{p.ko}</span>
      <span className="block text-xs text-slate-400 italic">{p.rom}</span>
      <span className="block text-xs text-slate-300 mt-0.5">{p.it}</span>
    </span>
    <Maximize2 className="w-4 h-4 text-slate-500 shrink-0" />
  </button>
);

export const ShowKoreanView: React.FC = () => {
  const { user, group } = useAuth();
  const [section, setSection] = useState<Section>('dest');
  const [overlay, setOverlay] = useState<OverlayContent | null>(null);
  const [query, setQuery] = useState('');

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

  const filtered = destinations.filter((d) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${d.italianName} ${d.name} ${d.district} ${d.koreanName ?? ''}`.toLowerCase().includes(q);
  });
  const today = filtered.filter((d) => todayStopIds.includes(d.id) && d.id !== homeId);
  const others = filtered.filter((d) => !todayStopIds.includes(d.id) || d.id === homeId);

  const openDestination = (d: MapLocation) => {
    const ko = cleanKoreanName(d.koreanName ?? '');
    setOverlay({
      kicker: 'Per il tassista',
      place: { ko, it: d.italianName, naver: getNaverMapSearchUrl(d) },
      lines: [{ ko: `${withDirectionParticle(ko)} 가 주세요.`, rom: '', it: `Mi porti a: ${d.italianName}, per favore.` }]
    });
  };

  const DestButton = ({ d, tag }: { d: MapLocation; tag?: string }) => (
    <button
      type="button"
      onClick={() => openDestination(d)}
      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-900/80 hover:border-rose-500/40 px-4 py-3 flex items-center gap-3 min-h-[60px]"
      data-testid="dest-row"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-100 truncate">{d.italianName}</span>
          {tag && <span className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 bg-cyan-500/20 text-cyan-300 shrink-0">{tag}</span>}
        </span>
        <span className="block text-[11px] text-slate-500 truncate">{d.district}</span>
      </span>
      <span className="text-base font-bold text-white shrink-0" lang="ko">{cleanKoreanName(d.koreanName ?? '')}</span>
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

  const diet = useMemo(
    () => buildDietCard(person?.diet, `${person?.allergies ?? ''} ${extraAllergens.join(' ')}`, severe),
    [person, severe, extraAllergens]
  );
  const showDiet = () =>
    setOverlay({
      kicker: `Per il ristorante · ${person?.label ?? ''}`,
      lines: diet.lines.map((l) => ({ ko: l.ko, rom: l.rom, it: l.it }))
    });
  const toggleAllergen = (key: string) =>
    setExtraAllergens((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const noRestriction = dietKind(person?.diet) === 'any' && diet.recognized.length === 0 && !diet.unrecognized;

  return (
    <div className="space-y-4 animate-in fade-in duration-200" data-testid="show-korean-view">
      <div>
        <h2 className="text-xl sm:text-2xl font-black font-display text-white">Mostra in coreano</h2>
        <p className="text-xs text-slate-400">Tocca una scheda: si apre a schermo intero, con testo grande da far leggere a tassista o cameriere.</p>
      </div>

      {/* Sezioni */}
      <div role="tablist" className="grid grid-cols-5 gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={section === s.id}
            onClick={() => setSection(s.id)}
            className={`min-h-[48px] rounded-2xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 transition-colors ${
              section === s.id ? 'bg-rose-500/20 border-rose-500/50 text-rose-200' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            data-testid={`sec-${s.id}`}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
          </button>
        ))}
      </div>

      {section === 'dest' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cerca un luogo (es. Hongdae, Namsan)"
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60"
              />
            </div>
            {home && homeLoc && !query && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5"><Home className="w-3.5 h-3.5" /> Il tuo alloggio</div>
                <DestButton d={homeLoc} tag="casa" />
              </div>
            )}
            {today.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Tappe di oggi</div>
                <div className="space-y-2">{today.map((d) => <DestButton key={d.id} d={d} tag="oggi" />)}</div>
              </div>
            )}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Tutti i luoghi</div>
            <div className="space-y-2">
              {others.map((d) => <DestButton key={d.id} d={d} />)}
              {others.length === 0 && today.length === 0 && <p className="text-xs text-slate-500">Nessun luogo trovato.</p>}
            </div>
          </div>
        </div>
      )}

      {section === 'food' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            {people.length > 1 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Per chi ordini</div>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPersonKey(p.key)}
                      aria-pressed={person?.key === p.key}
                      className={`px-4 min-h-[44px] rounded-full border text-sm font-semibold ${person?.key === p.key ? 'bg-rose-500/20 border-rose-500/50 text-rose-100' : 'bg-slate-900 border-slate-800 text-slate-300'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-300 space-y-1">
              <div><span className="text-slate-500">Dieta:</span> {person?.diet || 'non indicata'}</div>
              <div><span className="text-slate-500">Allergie:</span> {person?.allergies?.trim() || (person?.key === 'me' ? 'nessuna indicata nel profilo' : 'non condivise')}</div>
              {diet.unrecognized && (
                <p className="text-xs text-amber-300 flex gap-2 pt-1"><AlertTriangle className="w-4 h-4 shrink-0" /> Non riconosco “{diet.unrecognized}”: scegli qui sotto gli alimenti da evitare, così li traduco.</p>
              )}
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">Aggiungi alimenti da evitare</div>
              <div className="flex flex-wrap gap-2">
                {ALLERGEN_OPTIONS.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => toggleAllergen(a.key)}
                    aria-pressed={extraAllergens.includes(a.key)}
                    className={`px-3 min-h-[40px] rounded-full border text-xs font-semibold ${extraAllergens.includes(a.key) ? 'bg-rose-500/25 border-rose-500/60 text-rose-100' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                  >
                    {a.it} <span className="text-slate-500" lang="ko">{a.ko}</span>
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-3 text-sm text-slate-300 min-h-[44px]">
                <input type="checkbox" checked={severe} onChange={(e) => setSevere(e.target.checked)} className="w-5 h-5 accent-rose-500" />
                Allergia grave (anche tracce sono pericolose)
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-rose-500/30 bg-slate-900 p-4 sm:p-5 space-y-3" data-testid="diet-card">
            <div className="text-[11px] font-bold uppercase tracking-widest text-rose-300">{diet.title}</div>
            {diet.lines.map((l, i) => (
              <div key={i}>
                <div className="text-lg font-bold text-white leading-snug break-keep" lang="ko">{l.ko}</div>
                <div className="text-xs text-slate-400 italic">{l.rom}</div>
                <div className="text-xs text-slate-300">{l.it}</div>
              </div>
            ))}
            <button
              type="button"
              onClick={showDiet}
              className="w-full min-h-[52px] rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm flex items-center justify-center gap-2"
              data-testid="show-diet"
            >
              <Maximize2 className="w-4 h-4" /> {noRestriction ? 'Mostra la scheda' : 'Mostra al cameriere'}
            </button>
            <p className="text-[11px] text-slate-500 leading-snug">
              Le allergie gravi vanno sempre ricontrollate: nei piatti coreani brodi e salse spesso contengono pesce, soia o glutine anche quando non si vede.
            </p>
          </div>
        </div>
      )}

      {section === 'free' && <FreeTranslate onShow={(p) => setOverlay({ kicker: 'Traduzione', lines: [p] })} />}

      {section === 'phrases' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-4 gap-y-5">
          {PHRASE_GROUPS.filter((g) => g.id !== 'emergenza').map((g) => (
            <div key={g.id}>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">{g.title}</div>
              <div className="space-y-2">
                {g.phrases.map((p) => <PhraseRow key={p.ko} p={p} onShow={() => setOverlay({ kicker: g.title, lines: [p] })} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {section === 'sos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Numeri in Corea del Sud</div>
            {EMERGENCY_NUMBERS.map((n) => (
              <a
                key={n.number}
                href={`tel:${n.number}`}
                className="flex items-center gap-4 rounded-2xl border border-red-500/30 bg-red-950/30 px-4 py-3 min-h-[64px]"
              >
                <span className="text-3xl font-black font-display text-white tabular-nums w-20">{n.number}</span>
                <span className="text-sm text-slate-200 flex-1">{n.label}</span>
                <Phone className="w-5 h-5 text-red-300 shrink-0" />
              </a>
            ))}
            <p className="text-[11px] text-slate-500 leading-snug">
              Prima di partire salva anche il numero dell’Ambasciata d’Italia a Seul dal sito del Ministero degli Esteri: qui non l’ho riportato perché non l’ho verificato.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Frasi per le emergenze</div>
            {PHRASE_GROUPS.find((g) => g.id === 'emergenza')!.phrases.map((p) => (
              <PhraseRow key={p.ko} p={p} onShow={() => setOverlay({ kicker: 'Emergenza', lines: [p] })} />
            ))}
          </div>
        </div>
      )}

      {overlay && <ShowOverlay content={overlay} onClose={() => setOverlay(null)} />}
    </div>
  );
};

export default ShowKoreanView;
