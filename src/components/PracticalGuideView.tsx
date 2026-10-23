import React, { useState, useEffect } from 'react';
import { PRE_TRIP_CHECKLIST } from '../data/tripData';
import { 
  CheckSquare, Square, Smartphone, ShieldAlert, 
  HelpCircle, Home, Sparkles, ExternalLink, BatteryCharging, Wifi, FileCheck2
} from 'lucide-react';

export const PracticalGuideView: React.FC = () => {
  // Checklist checked items stored in localStorage
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

  return (
    <div className="space-y-6">
      {/* Top Banner / Progress Indicator */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              Checklist Pre-Partenza & Regole Cruciali
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Tutte le verifiche obbligatorie per volare senza intoppi verso Seul e durante lo scalo a Pechino.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-cyan-300 font-bold">
              {completedCount} / {totalItems} completati ({progressPercent}%)
            </span>
            <div className="w-28 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Interactive Checklist Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {PRE_TRIP_CHECKLIST.map((item) => {
            const isChecked = !!checkedIds[item.id];
            return (
              <div
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
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
                    <span className="font-mono text-[10px] text-slate-500 uppercase">
                      {item.category}
                    </span>
                    {item.required && (
                      <span className="text-[10px] font-bold text-red-400">
                        • Obbligatorio
                      </span>
                    )}
                  </div>
                  <p className={isChecked ? 'line-through text-slate-500' : 'text-slate-200'}>
                    {item.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Crucial Survival Guidelines Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* App & Navigazione */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>App Indispensabili sul Telefono</span>
          </div>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="font-bold text-emerald-400 flex items-center justify-between">
                <span>Naver Map (네이버지도)</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded">FONDAMENTALE</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-1">
                A causa delle leggi sulla sicurezza coreane, Google Maps non offre percorsi a piedi o indicazioni esatte. Scaricare Naver Map e abilitare la lingua inglese.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="font-bold text-cyan-400">Papago (Traduttore Naver)</div>
              <p className="text-slate-400 text-[11px] mt-1">
                Il miglior traduttore per il coreano, con riconoscimento fotografico istantaneo di cartelli e menu dei ristoranti.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="font-bold text-amber-400">Alipay & WeChat Pay</div>
              <p className="text-slate-400 text-[11px] mt-1">
                Per lo scalo a Pechino. In Cina i contanti sono quasi spariti e le carte estere non sono accettate nei piccoli negozi. Attivare l'Alipay Tour Pass.
              </p>
            </div>
          </div>
        </div>

        {/* Regole Power Bank & Firewall Cina */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2">
            <BatteryCharging className="w-4 h-4 text-amber-400" />
            <span>Power Bank 3C & Great Firewall</span>
          </div>
          <div className="space-y-3 text-xs text-slate-300">
            <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30">
              <div className="font-bold text-amber-300">Power Bank: Marchio 3C</div>
              <p className="text-amber-200/80 text-[11px] mt-1">
                In Cina le batterie esterne sono severamente controllate: devono riportare la marcatura stampata (Wh o mAh leggibili). Se privi di specifiche, vengono sequestrati immediatamente ai controlli di sicurezza.
              </p>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80">
              <div className="font-bold text-cyan-400">Firewall Cinese a Pechino</div>
              <p className="text-slate-400 text-[11px] mt-1">
                WhatsApp, Instagram, Google Maps e Gmail sono censurati. Soluzione: usare una eSIM abilitata al roaming internazionale o passare dalla connessione dati della SIM italiana (il traffico in roaming non è sottoposto al blocco!).
              </p>
            </div>
          </div>
        </div>

        {/* Check-out alloggio Enko Stay */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-xl">
          <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-2">
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
