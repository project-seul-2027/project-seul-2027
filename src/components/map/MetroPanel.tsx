import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Search, Crosshair, X, Loader2, RotateCcw, Layers, Route } from 'lucide-react';
import {
  METRO_GROUPS,
  lineLengthKm,
  lineStationKeys,
  normalizeSearch,
  readableTextOn,
  type MetroLine,
  type MetroNetwork
} from '../../data/seoulMetro';

interface MetroPanelProps {
  network: MetroNetwork | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  visible: Set<string>;
  onToggleLine: (id: string) => void;
  onSetVisible: (ids: string[]) => void;
  selected: string | null;
  onSelectLine: (id: string | null) => void;
  onFitLine: (id: string) => void;
  onFocusStation: (key: string, lineId?: string) => void;
  showGoogleLines: boolean;
  onToggleGoogleLines: () => void;
}

export const LineBadge: React.FC<{ line: MetroLine; size?: 'sm' | 'md' }> = ({ line, size = 'md' }) => (
  <span
    className={`inline-flex items-center justify-center rounded-full font-bold font-mono shrink-0 leading-none ${
      size === 'sm' ? 'min-w-[18px] h-[18px] px-1 text-[9px]' : 'min-w-[24px] h-6 px-1.5 text-[11px]'
    }`}
    style={{ backgroundColor: line.color, color: readableTextOn(line.color) }}
    aria-hidden="true"
  >
    {line.short}
  </span>
);

const MAX_RESULTS = 8;

export const MetroPanel: React.FC<MetroPanelProps> = ({
  network,
  loading,
  error,
  onRetry,
  visible,
  onToggleLine,
  onSetVisible,
  selected,
  onSelectLine,
  onFitLine,
  onFocusStation,
  showGoogleLines,
  onToggleGoogleLines
}) => {
  const [query, setQuery] = useState('');

  const linesById = useMemo(() => new Map(network?.lines.map((l) => [l.id, l]) ?? []), [network]);

  const stats = useMemo(() => {
    const m = new Map<string, { stations: number; km: number }>();
    network?.lines.forEach((l) => m.set(l.id, { stations: lineStationKeys(l).length, km: lineLengthKm(l) }));
    return m;
  }, [network]);

  const results = useMemo(() => {
    const q = normalizeSearch(query);
    if (!network || q.length < 2) return [];
    const scored: { key: string; score: number }[] = [];
    for (const [key, st] of Object.entries(network.stations)) {
      const en = normalizeSearch(st.en);
      const ko = normalizeSearch(st.ko);
      const score = en.startsWith(q) || ko.startsWith(q) ? 0 : en.includes(q) || ko.includes(q) ? 1 : -1;
      if (score >= 0) scored.push({ key, score });
    }
    return scored
      .sort((a, b) => a.score - b.score || network.stations[a.key].en.localeCompare(network.stations[b.key].en))
      .slice(0, MAX_RESULTS)
      .map((s) => s.key);
  }, [network, query]);

  if (!network) {
    return (
      <div className="p-6 text-center text-xs text-slate-400 space-y-3">
        {loading && (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            Carico i tracciati delle linee…
          </div>
        )}
        {error && (
          <>
            <p className="text-red-300">Impossibile caricare le linee della metro: {error}</p>
            <button
              onClick={onRetry}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Riprova
            </button>
          </>
        )}
      </div>
    );
  }

  const defaults = network.lines.filter((l) => l.defaultVisible).map((l) => l.id);
  const all = network.lines.map((l) => l.id);
  const sel = selected ? linesById.get(selected) : undefined;

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* Ricerca stazione */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca stazione: Hongik, Myeongdong, 명동…"
          aria-label="Cerca una stazione"
          className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
        />
      </div>
      {query.trim().length >= 2 && (
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/70">
          {results.length === 0 && <div className="p-3 text-xs text-slate-500">Nessuna stazione trovata.</div>}
          {results.map((key) => {
            const st = network.stations[key];
            const lines = Object.keys(st.at).map((id) => linesById.get(id)!);
            return (
              <button
                key={key}
                onClick={() => onFocusStation(key)}
                className="w-full text-left px-3 py-2 hover:bg-slate-800/60 flex items-center gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-100 truncate">{st.en}</div>
                  <div className="text-[11px] text-slate-400">{st.ko}</div>
                </div>
                <div className="flex gap-0.5 flex-wrap justify-end max-w-[45%]">
                  {lines.map((l) => (
                    <LineBadge key={l.id} line={l} size="sm" />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Linea selezionata */}
      {sel && (
        <SelectedLineCard
          line={sel}
          network={network}
          linesById={linesById}
          stats={stats.get(sel.id)!}
          onClose={() => onSelectLine(null)}
          onFit={() => onFitLine(sel.id)}
          onSolo={() => onSetVisible([sel.id])}
          onFocusStation={onFocusStation}
        />
      )}

      {/* Preset di visibilità */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Linee visibili {visible.size}/{all.length}
        </span>
        <div className="flex gap-1 text-[11px]">
          <button
            onClick={() => onSetVisible(defaults)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Linee 1–9, AREX, Gyeongui-Jungang, Suin-Bundang, Shinbundang, Ui-Sinseol, Sillim"
          >
            Principali
          </button>
          <button onClick={() => onSetVisible(all)} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
            Tutte
          </button>
          <button onClick={() => onSetVisible([])} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200">
            Nessuna
          </button>
        </div>
      </div>

      {/* Elenco linee per gruppo */}
      {METRO_GROUPS.map((group) => {
        const lines = network.lines.filter((l) => l.group === group.id);
        if (lines.length === 0) return null;
        const groupIds = lines.map((l) => l.id);
        const allOn = groupIds.every((id) => visible.has(id));
        return (
          <section key={group.id} className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-xs font-bold text-slate-200">{group.label}</h3>
                <p className="text-[10px] text-slate-500">{group.hint}</p>
              </div>
              <button
                onClick={() =>
                  onSetVisible(
                    allOn ? [...visible].filter((id) => !groupIds.includes(id)) : [...new Set([...visible, ...groupIds])]
                  )
                }
                className="text-[11px] text-cyan-400 hover:underline"
              >
                {allOn ? 'nascondi gruppo' : 'mostra gruppo'}
              </button>
            </div>
            <ul className="space-y-0.5">
              {lines.map((line) => {
                const on = visible.has(line.id);
                const isSel = selected === line.id;
                const s = stats.get(line.id)!;
                return (
                  <li
                    key={line.id}
                    className={`flex items-center gap-1 rounded-xl transition-colors ${
                      isSel ? 'bg-slate-800 ring-1 ring-cyan-500/40' : 'hover:bg-slate-800/50'
                    }`}
                  >
                    <button
                      onClick={() => onToggleLine(line.id)}
                      aria-pressed={on}
                      aria-label={`${on ? 'Nascondi' : 'Mostra'} ${line.it}`}
                      title={on ? 'Nascondi dalla mappa' : 'Mostra sulla mappa'}
                      className={`p-2 rounded-lg shrink-0 ${on ? 'text-slate-200 hover:text-white' : 'text-slate-600 hover:text-slate-300'}`}
                    >
                      {on ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => onSelectLine(isSel ? null : line.id)}
                      className={`flex-1 min-w-0 flex items-center gap-2 py-1.5 pr-2 text-left ${on ? '' : 'opacity-50'}`}
                      title="Seleziona e inquadra la linea"
                    >
                      <LineBadge line={line} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold text-slate-100 truncate">{line.it}</span>
                        <span className="block text-[10px] text-slate-500 truncate">{line.ko}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0 text-right">
                        {s.stations} staz.
                        <br />
                        {Math.round(s.km)} km
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* Confronto e attribuzione */}
      <div className="pt-2 border-t border-slate-800 space-y-2">
        <label className="flex items-start gap-2 text-[11px] text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showGoogleLines}
            onChange={onToggleGoogleLines}
            className="mt-0.5 accent-cyan-500"
          />
          <span>
            <span className="inline-flex items-center gap-1 font-semibold">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> Mostra anche le linee della mappa Google
            </span>
            <span className="block text-slate-500">Per confrontare i tracciati. Le linee Google non si possono nascondere una per una.</span>
          </span>
        </label>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Tracciati dai binari reali di OpenStreetMap (precisione ±3 m), aggiornati al{' '}
          {new Date(network.generated).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.{' '}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-slate-300">
            {network.attribution}
          </a>
        </p>
      </div>
    </div>
  );
};

const SelectedLineCard: React.FC<{
  line: MetroLine;
  network: MetroNetwork;
  linesById: Map<string, MetroLine>;
  stats: { stations: number; km: number };
  onClose: () => void;
  onFit: () => void;
  onSolo: () => void;
  onFocusStation: (key: string, lineId?: string) => void;
}> = ({ line, network, linesById, stats, onClose, onFit, onSolo, onFocusStation }) => {
  const multi = line.chains.length > 1;
  return (
    <div className="rounded-2xl border bg-slate-950/70 overflow-hidden" style={{ borderColor: `${line.color}88` }}>
      <div className="p-3 flex items-start gap-2.5" style={{ background: `linear-gradient(90deg, ${line.color}33, transparent)` }}>
        <LineBadge line={line} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">{line.it}</div>
          <div className="text-[11px] text-slate-400">
            {line.ko} · {line.en}
          </div>
          <div className="text-[11px] text-slate-300 mt-0.5 font-mono">
            {stats.stations} stazioni · {stats.km.toFixed(1)} km{multi ? ` · ${line.chains.length} rami` : ''}
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Chiudi linea">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-3 pb-2 flex gap-1.5 text-[11px]">
        <button onClick={onFit} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1">
          <Crosshair className="w-3.5 h-3.5" /> Inquadra
        </button>
        <button onClick={onSolo} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 inline-flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" /> Mostra solo questa
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto px-3 pb-3 space-y-3">
        {line.chains.map((chain, ci) => {
          const first = network.stations[chain.stations[0]];
          const last = network.stations[chain.stations[chain.stations.length - 1]];
          return (
            <div key={ci}>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <Route className="w-3 h-3" />
                {chain.loop ? 'Anello (circolare)' : multi ? `${ci === 0 ? 'Tratta principale' : 'Diramazione'}: ${first.en} → ${last.en}` : `${first.en} → ${last.en}`}
              </div>
              <ol className="relative">
                {chain.stations.map((key, i) => {
                  const st = network.stations[key];
                  const others = Object.keys(st.at)
                    .filter((id) => id !== line.id)
                    .map((id) => linesById.get(id)!);
                  const isEnd = !chain.loop && (i === 0 || i === chain.stations.length - 1);
                  return (
                    <li key={`${key}-${i}`} className="relative pl-5">
                      {/* filo della linea */}
                      <span
                        className="absolute left-[6px] w-[3px]"
                        style={{
                          backgroundColor: line.color,
                          top: i === 0 && !chain.loop ? '50%' : 0,
                          bottom: i === chain.stations.length - 1 && !chain.loop ? '50%' : 0
                        }}
                        aria-hidden="true"
                      />
                      <span
                        className="absolute left-[2px] top-1/2 -translate-y-1/2 rounded-full bg-white"
                        style={{
                          width: others.length || isEnd ? 11 : 9,
                          height: others.length || isEnd ? 11 : 9,
                          marginLeft: others.length || isEnd ? 0 : 1,
                          border: `2px solid ${others.length ? '#0b1220' : line.color}`
                        }}
                        aria-hidden="true"
                      />
                      <button
                        onClick={() => onFocusStation(key, line.id)}
                        className="w-full text-left py-1 px-1.5 rounded-lg hover:bg-slate-800/70 flex items-center gap-1.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className={`block text-xs truncate ${isEnd || others.length ? 'font-semibold text-slate-100' : 'text-slate-300'}`}>
                            {st.en}
                          </span>
                          <span className="block text-[10px] text-slate-500">{st.ko}</span>
                        </span>
                        {others.length > 0 && (
                          <span className="flex gap-0.5 flex-wrap justify-end max-w-[50%]">
                            {others.map((l) => (
                              <LineBadge key={l.id} line={l} size="sm" />
                            ))}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </div>
  );
};
