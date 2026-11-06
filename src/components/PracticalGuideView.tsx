import React, { useState, useEffect } from 'react';
import { useMediaQuery } from '../pwa';
import { FoldText } from './mobile/FoldText';
import { PRE_TRIP_CHECKLIST } from '../data/tripData';
import { 
  CheckSquare, Square, Smartphone, ShieldAlert, 
  HelpCircle, Home, Sparkles, ExternalLink, BatteryCharging, Wifi, FileCheck2
} from 'lucide-react';

export const PracticalGuideView: React.FC = () => {
  // Checklist checked items stored in localStorage
  const desk = useMediaQuery('(min-width: 1024px)');
  const [checkedIds, setCheckedIds] = useState<{ [id: string]: boolean }>(() => {
    const saved = localStorage.getItem('seoul2027_checklist');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('seoul2027_checklist', JSON.stringify(checkedIds));
  }, [checkedIds]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const totalItems = PRE_TRIP_CHECKLIST.length;
  const completedCount = Object.values(checkedIds).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalItems) * 100);

  if (!desk) {
    const cats = Array.from(new Set(PRE_TRIP_CHECKLIST.map((i) => i.category)));
    const KNOW: { t: string; short: string; full: string; tone: string }[] = [
      { t: 'Naver Map', short: 'Per camminare e andare in metro serve lei, non Google Maps.', full: 'A causa delle leggi coreane sulla sicurezza, Google Maps non dà percorsi a piedi precisi. Scaricare Naver Map e impostare la lingua inglese.', tone: 'ms-cy' },
      { t: 'Papago', short: 'Il miglior traduttore per il coreano, anche con la fotocamera.', full: 'Riconosce testo da foto di cartelli e menu dei ristoranti e traduce all\'istante.', tone: 'ms-cy' },
      { t: 'Alipay e WeChat Pay', short: 'Per lo scalo a Pechino: i contanti sono quasi spariti.', full: 'In Cina le carte estere non sono accettate nei piccoli negozi. Attivare l\'Alipay Tour Pass prima di partire.', tone: 'ms-am' },
      { t: 'Power bank con marchio 3C', short: 'Solo nello zaino a mano e con le specifiche leggibili.', full: 'In Cina le batterie esterne sono controllate: devono riportare Wh o mAh leggibili. Se mancano, vengono sequestrate ai controlli di sicurezza.', tone: 'ms-am' },
      { t: 'Firewall a Pechino', short: 'WhatsApp, Instagram e Gmail non funzionano con una SIM locale.', full: 'Soluzione: una eSIM con roaming internazionale oppure la SIM italiana in roaming, il cui traffico non passa dal blocco.', tone: 'ms-am' },
      { t: 'Check-out del 19 marzo', short: 'Entro le 07:30, senza eccezioni.', full: 'Differenziata rigorosa (umido, plastica, lattine, indifferenziata). Fotografare ogni stanza prima di uscire. Rimettere le chiavi nella cassetta o chiudere la porta elettronica come da istruzioni dell\'host.', tone: 'ms-vi' },
    ];
    const FACTS: [string, string][] = [
      ['Fuso orario', 'Seul è 8 ore avanti a Milano, Pechino 7'],
      ['Prese', 'Tipo C e F, 220 V: gli adattatori europei bastano'],
      ['Mance', 'Non si lasciano: né al ristorante né in taxi'],
      ['Trasporti', 'Una T-money card vale per metro, bus e taxi'],
      ['Emergenze', '112 polizia, 119 ambulanza e vigili del fuoco'],
    ];
    return (
      <div data-testid="mobile-guida">
        <p className="ms-mute" style={{ marginBottom: 10 }}>Da fare prima di partire, e le cose da sapere su Seul e sullo scalo a Pechino.</p>

        <div className="ms-sec" style={{ paddingBottom: 6 }}>
          <div className="flex items-baseline justify-between">
            <h2 className="ms-h2">Prima di partire</h2>
            <span className="ms-mute ms-sm"><b style={{ color: 'var(--ms-text)' }}>{completedCount}</b> di {totalItems}</span>
          </div>
          <div style={{ height: 3, background: 'var(--ms-line)', margin: '12px 0 4px', borderRadius: 2 }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--ms-accent)', borderRadius: 2, transition: 'width .3s' }} />
          </div>
        </div>

        {cats.map((c) => (
          <section key={c} style={{ paddingTop: 10 }}>
            <h3 className="ms-sm ms-cy" style={{ fontWeight: 600 }}>{c}</h3>
            {PRE_TRIP_CHECKLIST.filter((i) => i.category === c).map((item) => {
              const on = !!checkedIds[item.id];
              return (
                <button key={item.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggleCheck(item.id)} className="ms-ck">
                  <span className="box" data-on={on}>{on && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
                  <span className={on ? 'done' : ''}>
                    {item.label.replace(/\s*\(.*\)\s*$/, '')}
                    {item.required && !on && <em>obbligatorio</em>}
                  </span>
                </button>
              );
            })}
          </section>
        ))}

        <section className="ms-sec" style={{ marginTop: 22, paddingBottom: 0 }}>
          <h2 className="ms-h2" style={{ marginBottom: 4 }}>Da sapere</h2>
          {KNOW.map((k) => (
            <details key={k.t} className="ms-know">
              <summary>
                <span>
                  <strong className={k.tone}>{k.t}</strong>
                  <span>{k.short}</span>
                </span>
              </summary>
              <p>{k.full}</p>
            </details>
          ))}
        </section>

        <section className="ms-sec" style={{ marginTop: 22, paddingBottom: 0 }}>
          <h2 className="ms-h2" style={{ marginBottom: 4 }}>In breve</h2>
          {FACTS.map(([a, b]) => (
            <div className="ms-row" key={a} style={{ gridTemplateColumns: '96px 1fr' }}>
              <span className="t" style={{ fontWeight: 600 }}>{a}</span>
              <p className="ms-mute">{b}</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Progress Indicator */}
      <div className={desk ? 'space-y-6' : 'bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4'}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              Checklist Pre-Partenza & Regole Cruciali
            </h3>
            <p className="hidden lg:block text-xs text-slate-400 mt-0.5">
              Tutte le verifiche obbligatorie per volare senza intoppi verso Seul e durante lo scalo a Pechino.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-cyan-300 font-bold">
              {completedCount} / {totalItems} completati ({progressPercent}%)
            </span>
            <div className={desk ? 'w-48 h-1.5 bg-white/10 rounded-full overflow-hidden' : 'w-28 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700'}>
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Interactive Checklist Grid */}
        <div className={desk ? 'grid grid-cols-1 md:grid-cols-2 gap-x-3 gap-y-2' : 'grid grid-cols-1 md:grid-cols-2 gap-3 pt-2'}>
          {PRE_TRIP_CHECKLIST.map((item) => {
            const isChecked = !!checkedIds[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={desk
                  ? `p-4 rounded-2xl cursor-pointer transition-colors flex items-start gap-3 select-none ${
                      isChecked ? 'bg-white/[0.02] text-slate-500' : 'bg-white/[0.05] hover:bg-white/[0.08] text-slate-200'
                    }`
                  : `p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                  isChecked
                    ? 'bg-slate-900/40 border-cyan-500/30 text-slate-400'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-200'
                }`}
              >
                <div className="pt-0.5 text-cyan-400 shrink-0">
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="max-lg:hidden font-mono text-[10px] text-slate-500 uppercase">
                      {item.category}
                    </span>
                    {item.required && (
                      <span className="max-lg:hidden text-[10px] font-bold text-red-400">
                        • Obbligatorio
                      </span>
                    )}
                  </div>
                  <p className={isChecked ? 'line-through text-slate-500' : 'text-slate-200'}>
                    <span className="lg:hidden">{item.label.replace(/\s*\(.*\)\s*$/, '')}</span>
                    <span className="max-lg:hidden">{item.label}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Crucial Survival Guidelines Grid */}
      <div className={desk ? 'grid grid-cols-1 lg:grid-cols-3 gap-x-10 gap-y-6' : 'grid grid-cols-1 lg:grid-cols-3 gap-5'}>
        {/* App & Navigazione */}
        <div className={desk ? 'space-y-4' : 'bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl'}>
          <div className={desk ? 'flex items-center gap-2 text-white font-bold text-base pb-1' : 'flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2'}>
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>App Indispensabili sul Telefono</span>
          </div>
          <div className="space-y-3 text-xs text-slate-300">
            <div className={desk ? 'p-4 rounded-2xl bg-white/[0.04]' : 'p-2.5 rounded-lg bg-slate-950 border border-slate-800/80'}>
              <div className="font-bold text-emerald-400 flex items-center justify-between">
                <span>Naver Map (네이버지도)</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded">FONDAMENTALE</span>
              </div>
              <FoldText className="text-slate-400 text-[11px] mt-1">A causa delle leggi sulla sicurezza coreane, Google Maps non offre percorsi a piedi o indicazioni esatte. Scaricare Naver Map e abilitare la lingua inglese.</FoldText>
            </div>

            <div className={desk ? 'p-4 rounded-2xl bg-white/[0.04]' : 'p-2.5 rounded-lg bg-slate-950 border border-slate-800/80'}>
              <div className="font-bold text-cyan-400">Papago (Traduttore Naver)</div>
              <FoldText className="text-slate-400 text-[11px] mt-1">Il miglior traduttore per il coreano, con riconoscimento fotografico istantaneo di cartelli e menu dei ristoranti.</FoldText>
            </div>

            <div className={desk ? 'p-4 rounded-2xl bg-white/[0.04]' : 'p-2.5 rounded-lg bg-slate-950 border border-slate-800/80'}>
              <div className="font-bold text-amber-400">Alipay & WeChat Pay</div>
              <FoldText className="text-slate-400 text-[11px] mt-1">Per lo scalo a Pechino. In Cina i contanti sono quasi spariti e le carte estere non sono accettate nei piccoli negozi. Attivare l'Alipay Tour Pass.</FoldText>
            </div>
          </div>
        </div>

        {/* Regole Power Bank & Firewall Cina */}
        <div className={desk ? 'space-y-4' : 'bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl'}>
          <div className={desk ? 'flex items-center gap-2 text-white font-bold text-base pb-1' : 'flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2'}>
            <BatteryCharging className="w-4 h-4 text-amber-400" />
            <span>Power Bank 3C & Great Firewall</span>
          </div>
          <div className="space-y-3 text-xs text-slate-300">
            <div className={desk ? 'p-4 rounded-2xl bg-amber-500/10' : 'p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30'}>
              <div className="font-bold text-amber-300">Power Bank: Marchio 3C</div>
              <FoldText className="text-amber-200/80 text-[11px] mt-1">In Cina le batterie esterne sono severamente controllate: devono riportare la marcatura stampata (Wh o mAh leggibili). Se privi di specifiche, vengono sequestrati immediatamente ai controlli di sicurezza.</FoldText>
            </div>

            <div className={desk ? 'p-4 rounded-2xl bg-white/[0.04]' : 'p-2.5 rounded-lg bg-slate-950 border border-slate-800/80'}>
              <div className="font-bold text-cyan-400">Firewall Cinese a Pechino</div>
              <FoldText className="text-slate-400 text-[11px] mt-1">WhatsApp, Instagram, Google Maps e Gmail sono censurati. Soluzione: usare una eSIM abilitata al roaming internazionale o passare dalla connessione dati della SIM italiana (il traffico in roaming non è sottoposto al blocco!).</FoldText>
            </div>
          </div>
        </div>

        {/* Check-out alloggio Enko Stay */}
        <div className={desk ? 'space-y-4' : 'bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl'}>
          <div className={desk ? 'flex items-center gap-2 text-white font-bold text-base pb-1' : 'flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2'}>
            <Home className="w-4 h-4 text-purple-400" />
            <span>Check-out Alloggio (Istruzioni Enko)</span>
          </div>
          <div className="space-y-3 text-xs text-slate-300">
            <p className="text-slate-300 text-[11px] leading-relaxed">
              La mattina del 19 marzo il check-out è fissato inderogabilmente per le <strong>07:30</strong>:
            </p>

            <ul className="space-y-2 text-[11px] text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Differenziata:</strong> In Corea la raccolta è rigorosissima. Separare umido, plastica, lattine e indifferenziata nei sacchetti corretti.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Foto stanze:</strong> Fotografare ogni stanza e l'ordine generale dell'appartamento prima di chiudere la porta.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span><strong>Chiavi/Codice:</strong> Riposizionare le chiavi nella cassetta di sicurezza o bloccare la porta elettronica come da istruzioni host.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
