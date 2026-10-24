import React, { useMemo, useState } from 'react';
import { History, GitCommit, ExternalLink, Search, ChevronDown, ChevronUp, Sparkles, Tag } from 'lucide-react';
import { APP_VERSION, CHANGELOG, REPO_URL, seriesOf, type ChangelogEntry } from '../data/changelog';

const PAGE_SIZE = 25;
const COLLAPSED_ITEMS = 4;

const dateFormat = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

const EntryCard: React.FC<{ entry: ChangelogEntry; isLatest: boolean; isCurrent: boolean }> = ({ entry, isLatest, isCurrent }) => {
  const [open, setOpen] = useState(false);
  const date = new Date(entry.date);
  const shown = open ? entry.items : entry.items.slice(0, COLLAPSED_ITEMS);
  const hidden = entry.items.length - shown.length;

  return (
    <article
      id={`v${entry.version}`}
      className={`rounded-2xl border p-4 sm:p-5 space-y-3 scroll-mt-40 ${
        isLatest ? 'border-cyan-500/40 bg-gradient-to-br from-cyan-950/20 to-slate-900/90' : 'border-slate-800 bg-slate-900/70'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-bold px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-cyan-300">
          v{entry.version}
        </span>
        {isLatest && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Ultima
          </span>
        )}
        {isCurrent && !isLatest && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            In uso
          </span>
        )}
        {entry.release && (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/40 flex items-center gap-1">
            <Tag className="w-3 h-3" />
            Nuova serie {seriesOf(entry.version)}
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-400 font-mono tabular-nums">
          {dateFormat.format(date)} · {timeFormat.format(date)}
        </span>
      </div>

      <h3 className="text-sm sm:text-base font-bold text-white leading-snug">{entry.title}</h3>

      {entry.items.length > 0 && (
        <div className="space-y-1.5">
          <ul className="space-y-1.5">
            {shown.map((item, i) => (
              <li key={i} className="text-xs sm:text-[13px] text-slate-300 flex items-start gap-2 leading-relaxed">
                <span className="text-cyan-400 font-bold shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {entry.items.length > COLLAPSED_ITEMS && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
            >
              {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {open ? 'Mostra meno' : `Mostra altre ${hidden} voci`}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[11px] text-slate-500">
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-slate-400 hover:text-cyan-300"
        >
          <GitCommit className="w-3 h-3" />
          {entry.short}
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
        {entry.author && <span>di {entry.author}</span>}
      </div>
    </article>
  );
};

/** Elenco degli aggiornamenti pubblicati su GitHub, con numero di versione. */
export const ChangelogView: React.FC = () => {
  const entries = CHANGELOG?.entries ?? [];
  const [series, setSeries] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const seriesList = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(seriesOf(e.version), (counts.get(seriesOf(e.version)) ?? 0) + 1);
    return [...counts.entries()];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (series !== 'all' && seriesOf(e.version) !== series) return false;
      if (!q) return true;
      return (
        e.version.includes(q) ||
        e.short.includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.items.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [entries, series, query]);

  const shown = filtered.slice(0, visible);
  const oldest = entries[entries.length - 1];
  const generated = CHANGELOG ? new Date(CHANGELOG.generatedAt) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
            <History className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold font-display text-white flex flex-wrap items-center gap-2">
              Changelog
              {APP_VERSION && (
                <span className="font-mono text-sm px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 text-cyan-300">
                  v{APP_VERSION}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {entries.length > 0 ? (
                <>
                  Ogni aggiornamento pubblicato su GitHub ha il suo numero di versione: {entries.length}{' '}
                  {entries.length === 1 ? 'aggiornamento' : 'aggiornamenti'}
                  {oldest && ` dal ${dateFormat.format(new Date(oldest.date))}`}. Versione in uso: v{APP_VERSION}.
                </>
              ) : (
                'La cronologia degli aggiornamenti non è disponibile in questa copia del sito.'
              )}
            </p>
          </div>
        </div>
        <a
          href={`${REPO_URL}/commits/main`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 self-start md:self-auto px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Apri su GitHub
        </a>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
          <p className="text-sm text-slate-300">Nessun aggiornamento da mostrare.</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Il changelog si crea dalla cronologia git quando si esegue <span className="font-mono">npm run build</span> (o{' '}
            <span className="font-mono">npm run dev</span>) dentro il repository clonato da GitHub. Una copia scaricata come zip non
            contiene la cronologia.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => { setSeries('all'); setVisible(PAGE_SIZE); }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  series === 'all' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                Tutte ({entries.length})
              </button>
              {seriesList.map(([s, n]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSeries(s); setVisible(PAGE_SIZE); }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all font-mono ${
                    series === s ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {s}.x ({n})
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                inputMode="search"
                placeholder="Cerca una novità o una versione…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setVisible(PAGE_SIZE); }}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950/80 border border-slate-700/80 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {shown.map((entry) => (
              <EntryCard key={entry.sha} entry={entry} isLatest={entry === entries[0]} isCurrent={entry.version === APP_VERSION} />
            ))}

            {filtered.length === 0 && (
              <div className="p-10 text-center bg-slate-900/40 border border-slate-800 rounded-2xl space-y-2">
                <p className="text-slate-400 text-sm">Nessun aggiornamento corrisponde a "{query}".</p>
                <button
                  type="button"
                  onClick={() => { setQuery(''); setSeries('all'); }}
                  className="text-xs text-cyan-400 hover:underline"
                >
                  Reimposta filtri
                </button>
              </div>
            )}

            {filtered.length > shown.length && (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="w-full py-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"
              >
                <ChevronDown className="w-4 h-4" />
                Mostra altri {Math.min(PAGE_SIZE, filtered.length - shown.length)} aggiornamenti
              </button>
            )}
          </div>

          {generated && (
            <p className="text-[11px] text-slate-600 text-center">
              Elenco generato alla pubblicazione del {dateFormat.format(generated)} alle {timeFormat.format(generated)}.
            </p>
          )}
        </>
      )}
    </div>
  );
};
