import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { formatAccommodationEur, type AccommodationOption } from '../../data/tripData';
import { useAuth } from '../../auth/AuthContext';
import { useSeoulHome } from '../../services/homeInfoService';
import { locateNow } from '../../utils/tripClock';
import { SeoulHomeCard } from '../SeoulHomeCard';
import './mobile.css';

type MobileAccTab = 'compare' | 'home' | 'rules';

const CODE_TONE: Record<string, string> = {
  A: '#52d9e6',
  B: '#a78bfa',
  C: '#f472b6',
  D: '#fbbf24'
};

const QUICK_SPECS: Record<string, { spaces: string; hongdae: string; note: string }> = {
  A: { spaces: '2 bagni · 4° piano senza ascensore', hongdae: '25–30 min da Hongdae', note: 'Il più economico (−95 € da C)' },
  B: { spaces: '2 camere, 1 bagno · seminterrato', hongdae: '20–25 min da Hongdae', note: 'AREX e KTX diretti a piedi' },
  C: { spaces: 'Monolocale con divano letto · ascensore', hongdae: '10–15 min da Hongdae', note: 'Il più comodo per la sera' },
  D: { spaces: '2 camere, 3 letti queen veri', hongdae: '30–35 min da Hongdae', note: 'Si dorme più larghi' }
};

const RULES_ITEMS: { id: string; title: string; badge: string; summary: string; detail: string }[] = [
  {
    id: 'pick',
    title: 'Quale scegliere tra i quattro',
    badge: 'A, C o D',
    summary: 'C per le serate, A per risparmiare, D per avere veri letti.',
    detail:
      'Mapo (C) costa circa 26–31 € in più rispetto a B e D, ma fa risparmiare tempo e taxi ogni sera rientrando da Hongdae. Myeongdong (A) taglia 95 € a testa se i letti bastano e accettate il 4° piano a piedi. Sinseol-dong (D) offre 3 letti queen e 2 camere vere, ma dopo mezzanotte è più lontana. Seoul Station (B) conviene meno di A e C.'
  },
  {
    id: 'split',
    title: 'Come si divide l’affitto',
    badge: '8 vs 17 notti',
    summary: 'Ogni notte si divide solo tra chi dorme in casa quella sera.',
    detail:
      'Dal 2 al 9 marzo (8 notti) si divide per 4; dal 10 al 18 marzo (9 notti, dopo la partenza di Pietro) si divide tra i 3 che restano. Esempio su C (748 €, 44 €/notte): Pietro paga 88 €, ognuno degli altri tre paga 220 €.'
  },
  {
    id: 'ask',
    title: 'Cosa chiedere all’host prima di pagare',
    badge: '3 domande',
    summary: 'Letti e biancheria, check-in il 2 marzo, bagagli il 19.',
    detail:
      'Verificare sempre che le date siano 2–19 marzo (17 notti) e chiedere: 1) numero esatto di letti, coperte e asciugamani inclusi; 2) check-in anticipato o deposito valigie il 2 marzo (atterriamo a Incheon alle 11:40); 3) eventuali extra luce/utenze a fine soggiorno.'
  },
  {
    id: 'cancel',
    title: 'Cancellazione e rimborsi Enko Stay',
    badge: '24 ore gratis',
    summary: 'Rimborso totale entro 24 ore dal pagamento (o se l’host rifiuta).',
    detail:
      'Passate le 24 ore dalla conferma, la commissione Enko non è più rimborsabile. Sull’annuncio di Mapo il rimborso è quasi totale fino al 17 gennaio, poi penale del 10% fino al 31 gennaio, 50% fino al 16 febbraio, 70% fino al 23 febbraio e 100% a ridosso del 2 marzo.'
  }
];

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';
const HEADING_FONT: React.CSSProperties = { fontFamily: "'Outfit', system-ui, sans-serif" };
const eur = formatAccommodationEur;

interface Props {
  accs: AccommodationOption[];
  myVote: string | null;
  votersByAcc: Record<string, { name: string; color: string }[]>;
  leadingId: string | null;
  voteError: string | null;
  busy: boolean;
  returnedFromDetail?: boolean;
  onVote: (id: string) => void;
  onOpen: (id: string) => void;
}

export const MobileAlloggi: React.FC<Props> = ({
  accs,
  myVote,
  votersByAcc,
  leadingId,
  voteError,
  busy,
  returnedFromDetail = false,
  onVote,
  onOpen
}) => {
  const { user } = useAuth();
  const { homeDoc, configured } = useSeoulHome();
  const hasHome = configured || Boolean(homeDoc.confirmedAccId);

  const [tab, setTab] = useState<MobileAccTab>(() => {
    const inTrip = locateNow(Date.now()).phase === 'during';
    return inTrip && hasHome ? 'home' : 'compare';
  });
  const [stayMode, setStayMode] = useState<'17n' | '8n'>(() => (user?.travelerId === 't1' ? '8n' : '17n'));
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);

  const totalVotes = useMemo(
    () => Object.values(votersByAcc).reduce((sum, list) => sum + list.length, 0),
    [votersByAcc]
  );
  const leadingAcc = useMemo(() => accs.find((a) => a.id === leadingId) ?? null, [accs, leadingId]);

  const maxPersonPrice = useMemo(() => {
    const vals = accs.map((a) => (stayMode === '8n' ? a.pietroCost8Nights : a.other3Cost17Nights));
    return Math.max(1, ...vals);
  }, [accs, stayMode]);

  return (
    <div
      className={`pb-6 selection:bg-[#52d9e6]/25 selection:text-white${returnedFromDetail ? ' alloggi-list-return' : ''}`}
      data-testid="mobile-alloggi"
    >
      {/* Sotto-schede piatte */}
      <div role="tablist" aria-label="Sezioni alloggi" className="ms-seg">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'compare'}
          onClick={() => setTab('compare')}
          className={FOCUS_RING}
        >
          Confronto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'home'}
          onClick={() => setTab('home')}
          className={`inline-flex items-center gap-1.5 ${FOCUS_RING}`}
        >
          Casa nostra
          {hasHome && (
            <span
              style={{ borderRadius: 999, background: '#52d9e6' }}
              className="inline-block w-1.5 h-1.5"
              aria-hidden="true"
            />
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'rules'}
          onClick={() => setTab('rules')}
          className={FOCUS_RING}
        >
          Regole
        </button>
      </div>

      {/* ================= TAB 1: CONFRONTO 4 ALLOGGI ================= */}
      {tab === 'compare' && (
        <div key="tab-compare" className="pt-4 space-y-4 alloggi-tab-in">
          {/* Controllo quota con cursore scorrevole + riepilogo voti */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div
              style={{ borderRadius: 12, background: 'var(--ms-fill)' }}
              className="relative grid grid-cols-2 p-1"
            >
              <span
                aria-hidden="true"
                style={{
                  borderRadius: 9,
                  background: '#52d9e6',
                  width: 'calc(50% - 4px)',
                  transform: stayMode === '8n' ? 'translateX(100%)' : 'translateX(0%)'
                }}
                className="pointer-events-none absolute top-1 bottom-1 left-1 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              />
              <button
                type="button"
                onClick={() => setStayMode('17n')}
                aria-pressed={stayMode === '17n'}
                className={`relative z-10 min-h-11 px-3 text-[13.5px] font-semibold transition-colors whitespace-nowrap ${FOCUS_RING} ${
                  stayMode === '17n' ? 'text-[#04242a]' : 'text-[#eaf0f6]/80'
                }`}
              >
                17 notti · 3 pers.
              </button>
              <button
                type="button"
                onClick={() => setStayMode('8n')}
                aria-pressed={stayMode === '8n'}
                className={`relative z-10 min-h-11 px-3 text-[13.5px] font-semibold transition-colors whitespace-nowrap ${FOCUS_RING} ${
                  stayMode === '8n' ? 'text-[#04242a]' : 'text-[#eaf0f6]/80'
                }`}
              >
                8 notti · Pietro
              </button>
            </div>

            <div className="text-right text-[13px] text-[#97a5b9] tabular-nums">
              {leadingAcc && totalVotes > 0 ? (
                <span>
                  In testa <strong className="text-[#eaf0f6] font-semibold">{leadingAcc.code}</strong> · {totalVotes}/4 voti
                </span>
              ) : (
                <span>0/4 voti espressi</span>
              )}
            </div>
          </div>

          {voteError && (
            <p role="alert" className="text-[13.5px] text-[#f87171]">
              {voteError}
            </p>
          )}

          {/* Lista dei 4 alloggi con barra proporzionale del prezzo e azioni dirette */}
          <div className="border-t border-[rgba(234,240,246,0.11)]">
            {accs.map((acc) => {
              const mine = myVote === acc.id;
              const voters = votersByAcc[acc.id] ?? [];
              const isConfirmed = homeDoc.confirmedAccId === acc.id;
              const isLeading = leadingId === acc.id && totalVotes > 0;
              const personPrice = stayMode === '8n' ? acc.pietroCost8Nights : acc.other3Cost17Nights;
              const barPct = Math.round((personPrice / maxPersonPrice) * 100);
              const spec = QUICK_SPECS[acc.code] ?? {
                spaces: acc.typeDescription,
                hongdae: acc.hongdaeTransit,
                note: acc.highlightBadge
              };

              return (
                <article
                  key={acc.id}
                  className="py-4 border-b border-[rgba(234,240,246,0.11)] space-y-3"
                >
                  {/* Parte alta tappabile -> apre scheda completa con foto */}
                  <button
                    type="button"
                    onClick={() => onOpen(acc.id)}
                    data-testid={`open-${acc.id}`}
                    className={`alloggi-tap w-full text-left flex items-start justify-between gap-3 ${FOCUS_RING}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span
                        className="text-[36px] font-normal leading-[0.9] shrink-0 tabular-nums"
                        style={{ ...HEADING_FONT, color: CODE_TONE[acc.code] ?? '#eaf0f6' }}
                      >
                        {acc.code}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[18px] font-medium text-[#eaf0f6] leading-tight" style={HEADING_FONT}>
                            {acc.district}
                          </h3>
                          {isConfirmed ? (
                            <span className="text-[12px] font-semibold text-[#52d9e6]">Scelto</span>
                          ) : isLeading ? (
                            <span className="text-[12px] font-semibold text-[#52d9e6]">In testa</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[13.5px] text-[#eaf0f6]/90 leading-snug">{spec.spaces}</p>
                        <p className="mt-0.5 text-[13px] text-[#97a5b9] leading-snug">
                          {spec.hongdae} · {spec.note}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        key={`${acc.id}-${stayMode}`}
                        className="alloggi-price-pop block text-[26px] font-medium leading-none text-[#eaf0f6] tabular-nums whitespace-nowrap"
                        style={HEADING_FONT}
                      >
                        {eur(personPrice)}
                      </span>
                      <span className="mt-1.5 block text-[12.5px] text-[#97a5b9] tabular-nums whitespace-nowrap">
                        {eur(acc.totalEur17Nights)} tot.
                      </span>
                    </div>
                  </button>

                  {/* Barra proporzionale immediata del prezzo */}
                  <div
                    style={{ borderRadius: 999, background: 'rgba(234,240,246,0.08)' }}
                    className="h-1.5 w-full overflow-hidden"
                    aria-hidden="true"
                  >
                    <div
                      style={{
                        width: `${barPct}%`,
                        borderRadius: 999,
                        background: mine || isConfirmed || isLeading ? '#52d9e6' : CODE_TONE[acc.code] ?? '#97a5b9',
                        opacity: mine || isConfirmed || isLeading ? 1 : 0.65
                      }}
                      className="h-full transition-[width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
                    />
                  </div>

                  {/* Azioni rapide: voto + chi ha votato + apri scheda */}
                  <div className="flex items-center justify-between gap-3 pt-0.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        key={`${acc.id}-${mine ? 'on' : 'off'}`}
                        type="button"
                        disabled={busy}
                        aria-pressed={mine}
                        onClick={() => onVote(acc.id)}
                        style={{
                          borderRadius: 10,
                          background: mine ? '#52d9e6' : 'var(--ms-fill)'
                        }}
                        className={`alloggi-tap${mine ? ' alloggi-vote-pop' : ''} min-h-11 px-3.5 text-[13.5px] font-semibold inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 ${FOCUS_RING} ${
                          mine ? 'text-[#04242a]' : 'text-[#eaf0f6]'
                        }`}
                      >
                        {mine && <Check className="w-3.5 h-3.5" strokeWidth={2.8} />}
                        {mine ? `Votato ${acc.code}` : `Vota ${acc.code}`}
                      </button>

                      {voters.length > 0 && (
                        <span className="flex items-center gap-1.5 min-w-0 text-[12.5px] text-[#97a5b9] truncate">
                          <span className="flex items-center -space-x-1 shrink-0">
                            {voters.map((v) => (
                              <span
                                key={v.name}
                                style={{ backgroundColor: v.color, borderRadius: 999 }}
                                className="w-2.5 h-2.5 ring-2 ring-[#0a1119]"
                                aria-hidden="true"
                              />
                            ))}
                          </span>
                          <span className="truncate">{voters.map((v) => v.name.split(' ')[0]).join(', ')}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpen(acc.id)}
                      className={`group alloggi-tap min-h-11 pl-2 text-[13.5px] font-semibold text-[#52d9e6] inline-flex items-center gap-1 shrink-0 ${FOCUS_RING}`}
                    >
                      Dettagli <ChevronRight className="w-4 h-4 transition-transform duration-150 group-active:translate-x-1 motion-reduce:transition-none" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= TAB 2: CASA NOSTRA (PIN, WI-FI, CHECK-OUT) ================= */}
      {tab === 'home' && (
        <div key="tab-home" className="alloggi-tab-in">
          <SeoulHomeCard variant="mobile-tab" />
        </div>
      )}

      {/* ================= TAB 3: REGOLE & CONSIGLI DI SCELTA ================= */}
      {tab === 'rules' && (
        <div key="tab-rules" className="pt-2 divide-y divide-[rgba(234,240,246,0.11)] alloggi-tab-in">
          {RULES_ITEMS.map((item) => {
            const isOpen = openRuleId === item.id;
            return (
              <div key={item.id}>
                <button
                  type="button"
                  onClick={() => setOpenRuleId(isOpen ? null : item.id)}
                  aria-expanded={isOpen}
                  className={`w-full min-h-[60px] py-3.5 flex items-start justify-between gap-3 text-left ${FOCUS_RING}`}
                >
                  <span className="min-w-0">
                    <span className="block text-[16.5px] font-medium text-[#eaf0f6]" style={HEADING_FONT}>
                      {item.title}
                    </span>
                    <span className="block text-[13.5px] text-[#97a5b9] mt-0.5 leading-snug">{item.summary}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="text-[13px] font-semibold text-[#52d9e6] tabular-nums whitespace-nowrap">
                      {item.badge}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#97a5b9] transition-transform duration-200 motion-reduce:transition-none ${
                        isOpen ? 'rotate-180 text-[#52d9e6]' : ''
                      }`}
                    />
                  </span>
                </button>

                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-4 text-[14.5px] leading-relaxed text-[#c3cfdd]">{item.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MobileAlloggi;
