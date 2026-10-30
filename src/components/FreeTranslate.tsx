import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Languages, Loader2, Maximize2, Star, Trash2, AlertTriangle, Copy, Check } from 'lucide-react';
import { translate, translateStatus, TranslateError, type TranslateDir } from '../services/translateService';
import { romanize } from '../utils/romanize';
import type { Phrase } from '../data/koreanHelp';

interface Entry {
  id: string;
  dir: TranslateDir;
  src: string;
  out: string;
  star: boolean;
  at: number;
}

const KEY = 'seul2027:translate:history';
const MAX = 30;

function load(): Entry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((e) => e && typeof e.src === 'string' && typeof e.out === 'string') : [];
  } catch {
    return [];
  }
}
function save(list: Entry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* niente */
  }
}

/** Entry -> frase da mostrare a schermo intero (sempre coreano grande, italiano sotto) */
const toPhrase = (e: Entry): Phrase =>
  e.dir === 'it-ko' ? { ko: e.out, rom: romanize(e.out), it: e.src } : { ko: e.src, rom: romanize(e.src), it: e.out };

export const FreeTranslate: React.FC<{ onShow: (p: Phrase) => void }> = ({ onShow }) => {
  const [dir, setDir] = useState<TranslateDir>('it-ko');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Entry | null>(null);
  const [history, setHistory] = useState<Entry[]>(load);
  const [copied, setCopied] = useState(false);
  const status = translateStatus();
  const disabled = status === 'disabled';

  useEffect(() => save(history), [history]);

  const run = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const out = await translate(text, dir);
      const e: Entry = { id: `${Date.now()}`, dir, src: text.trim(), out, star: false, at: Date.now() };
      setResult(e);
      setHistory((h) => [e, ...h.filter((x) => !(x.src === e.src && x.dir === e.dir))].slice(0, MAX * 2).filter((x, i) => x.star || i < MAX));
    } catch (err) {
      setResult(null);
      setError(err instanceof TranslateError ? err.message : 'Traduzione non riuscita.');
    } finally {
      setBusy(false);
    }
  }, [text, dir]);

  const toggleStar = (id: string) => {
    setHistory((h) => h.map((x) => (x.id === id ? { ...x, star: !x.star } : x)));
    setResult((r) => (r && r.id === id ? { ...r, star: !r.star } : r));
  };
  const remove = (id: string) => setHistory((h) => h.filter((x) => x.id !== id));
  const swap = () => {
    setDir((d) => (d === 'it-ko' ? 'ko-it' : 'it-ko'));
    setText('');
    setResult(null);
    setError(null);
  };
  const copy = async (s: string) => {
    try {
      await navigator.clipboard.writeText(s);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* niente */
    }
  };

  const [from, to] = dir === 'it-ko' ? ['Italiano', 'Coreano'] : ['Coreano', 'Italiano'];
  const starred = history.filter((h) => h.star);
  const recent = history.filter((h) => !h.star);
  const resultStarred = result ? history.find((h) => h.id === result.id)?.star ?? result.star : false;

  return (
    <div className="space-y-4" data-testid="free-translate">
      {disabled && (
        <p className="text-xs text-slate-300 flex gap-2 rounded-xl bg-slate-800/60 border border-slate-700 p-3" data-testid="translate-disabled">
          <Languages className="w-4 h-4 shrink-0" />
          La traduzione libera non è ancora attiva: verrà abilitata prima del viaggio. Nel frattempo usa le frasi pronte.
        </p>
      )}
      {status === 'missing' && (
        <p className="text-xs text-amber-200 flex gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3" data-testid="translate-unconfigured">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Traduzione libera non ancora configurata (manca la chiave Google). Le frasi pronte funzionano comunque.
        </p>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 text-sm font-bold text-white">
          <span>{from}</span>
          <button type="button" onClick={swap} aria-label="Inverti lingue" className="w-10 h-10 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center" data-testid="translate-swap">
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <span>{to}</span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={500}
          disabled={disabled}
          lang={dir === 'it-ko' ? 'it' : 'ko'}
          placeholder={dir === 'it-ko' ? 'Scrivi in italiano, es. "Dov’è la fermata del bus per Gangnam?"' : 'Incolla o scrivi il testo in coreano'}
          className="w-full rounded-2xl bg-slate-950 border border-slate-700 p-3 text-base text-slate-100 focus:outline-none focus:border-rose-500 resize-none"
          data-testid="translate-input"
        />
        <button
          type="button"
          onClick={run}
          disabled={disabled || busy || !text.trim()}
          className="w-full min-h-[48px] rounded-2xl bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-bold flex items-center justify-center gap-2"
          data-testid="translate-go"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />} Traduci
        </button>
        {error && <p role="alert" className="text-xs text-rose-300" data-testid="translate-error">{error}</p>}
      </div>

      {result && (
        <div className="rounded-3xl border border-rose-500/30 bg-slate-900 p-4 space-y-2" data-testid="translate-result">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{to}</div>
          <div className="text-2xl font-black text-white leading-snug break-keep" lang={dir === 'it-ko' ? 'ko' : 'it'} data-testid="translate-out">{result.out}</div>
          {dir === 'it-ko' && <div className="text-sm italic text-slate-400" data-testid="translate-rom">{romanize(result.out)}</div>}
          <p className="text-[11px] text-slate-500">Traduzione automatica: per allergie ed emergenze usa le frasi pronte.</p>
          <div className="flex gap-2 pt-1">
            {dir === 'it-ko' && (
              <button type="button" onClick={() => onShow(toPhrase(result))} className="flex-1 min-h-[44px] rounded-xl bg-slate-100 text-slate-950 text-sm font-bold flex items-center justify-center gap-2" data-testid="translate-show">
                <Maximize2 className="w-4 h-4" /> Mostra
              </button>
            )}
            <button type="button" onClick={() => copy(result.out)} aria-label="Copia" className="w-11 min-h-[44px] rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button type="button" onClick={() => toggleStar(result.id)} aria-label="Salva nei preferiti" aria-pressed={resultStarred} className="w-11 min-h-[44px] rounded-xl bg-slate-800 flex items-center justify-center" data-testid="translate-star">
              <Star className={`w-4 h-4 ${resultStarred ? 'text-amber-300 fill-amber-300' : 'text-slate-300'}`} />
            </button>
          </div>
        </div>
      )}

      {[{ title: 'Preferiti', list: starred }, { title: 'Recenti', list: recent }].map(
        (g) =>
          g.list.length > 0 && (
            <div key={g.title} data-testid={`translate-${g.title === 'Preferiti' ? 'favs' : 'recent'}`}>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-2">{g.title}</div>
              <ul className="space-y-2">
                {g.list.map((e) => {
                  const p = toPhrase(e);
                  return (
                    <li key={e.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-3 flex items-start gap-2" data-testid="translate-item">
                      <button type="button" onClick={() => onShow(p)} className="min-w-0 flex-1 text-left">
                        <span className="block text-base font-bold text-white break-keep" lang="ko">{p.ko}</span>
                        <span className="block text-[11px] italic text-slate-500">{p.rom}</span>
                        <span className="block text-xs text-slate-300">{p.it}</span>
                      </button>
                      <button type="button" onClick={() => toggleStar(e.id)} aria-label="Preferito" className="w-9 h-9 flex items-center justify-center"><Star className={`w-4 h-4 ${e.star ? 'text-amber-300 fill-amber-300' : 'text-slate-500'}`} /></button>
                      <button type="button" onClick={() => remove(e.id)} aria-label="Elimina" className="w-9 h-9 flex items-center justify-center text-slate-500"><Trash2 className="w-4 h-4" /></button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )
      )}
    </div>
  );
};
