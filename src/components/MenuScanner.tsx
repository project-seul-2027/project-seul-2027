import React, { useRef, useState } from 'react';
import { AlertTriangle, Camera, Image as ImageIcon, Loader2, Maximize2, RotateCcw, Sparkles } from 'lucide-react';
import { SHOW_LANGS, wrapClass, type ShowLang, type ShowLine } from '../data/showLanguage';
import { scanMenuPhoto, VisionScanError } from '../services/visionScanService';
import type { GroupDietProfile, MenuDish, MenuScanResult } from '../shared/visionScan';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52d9e6]';

const CURRENCY_PREFIX: Record<string, string> = { KRW: '₩', CNY: '¥', EUR: '€' };

function formatDishPrice(price: number | undefined, currency: string | undefined): string | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  const sym = CURRENCY_PREFIX[currency ?? 'KRW'] ?? '';
  return `${sym}${price.toLocaleString('it-IT', { maximumFractionDigits: currency === 'KRW' ? 0 : 2 })}`;
}

const SPICY_LABEL: Record<'mild' | 'hot', string> = {
  mild: 'leggermente piccante',
  hot: 'piccante'
};

interface MenuScannerProps {
  lang: ShowLang;
  groupProfiles: GroupDietProfile[];
  onOrderDish: (dish: MenuDish, line: ShowLine) => void;
}

/**
 * Scansione menu con fotocamera o galleria: traduce i piatti in italiano
 * e segnala automaticamente eventuali conflitti con diete e allergie salvate nei profili del gruppo.
 */
export const MenuScanner: React.FC<MenuScannerProps> = ({ lang, groupProfiles, onOrderDish }) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MenuScanResult | null>(null);

  const htmlLang = SHOW_LANGS[lang].htmlLang;
  const wrap = wrapClass(lang);
  const checkedNames = groupProfiles.filter((p) => p.diet || p.allergies).map((p) => p.name);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const scanned = await scanMenuPhoto(file, lang, groupProfiles);
      setResult(scanned);
    } catch (err) {
      setError(err instanceof VisionScanError ? err.message : 'Impossibile leggere il menu: riprova con una foto più nitida.');
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const orderPhrase = (dish: MenuDish): ShowLine =>
    lang === 'zh'
      ? { text: '我要这个。', rom: 'Wǒ yào zhège.', it: `Prendo: ${dish.italian}` }
      : { text: '이거 주세요.', rom: 'Igeo juseyo.', it: `Prendo: ${dish.italian}` };

  return (
    <section className="rounded-xl bg-[#101c29] p-4 sm:p-5 space-y-4" data-keep-style data-testid="menu-scanner">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#52d9e6] shrink-0" aria-hidden="true" />
            Scansiona un menu
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
            Fotografa il menu in {SHOW_LANGS[lang].label.toLowerCase()}: traduce i piatti e controlla gli allergeni del gruppo.
          </p>
        </div>
        {result && !busy && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
            }}
            className={`min-h-10 px-2.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 inline-flex items-center gap-1.5 shrink-0 ${FOCUS_RING}`}
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Nuova foto
          </button>
        )}
      </div>

      {checkedNames.length > 0 && (
        <p className="text-xs text-slate-400">
          Profili controllati: <span className="text-slate-200">{checkedNames.join(', ')}</span>
        </p>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {!result && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            data-keep-style
            className={`flex-1 min-h-[48px] rounded-xl bg-[#52d9e6] hover:bg-[#6ae2ee] disabled:opacity-60 text-[#04242a] font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${FOCUS_RING}`}
            data-testid="menu-scan-camera"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {busy ? 'Analisi del menu…' : 'Scatta foto al menu'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
            data-keep-style
            className={`sm:w-auto px-4 min-h-[48px] rounded-xl bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-60 text-slate-200 font-medium text-sm flex items-center justify-center gap-2 transition-colors ${FOCUS_RING}`}
            data-testid="menu-scan-gallery"
          >
            <ImageIcon className="w-4 h-4" /> Galleria
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs sm:text-sm text-rose-300 flex items-start gap-2" data-testid="menu-scan-error">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      {result && (
        <div className="space-y-3" data-testid="menu-scan-results">
          {result.restaurantHint && (
            <p className="text-xs font-medium text-[#52d9e6]">{result.restaurantHint}</p>
          )}
          {result.dishes.length === 0 ? (
            <p className="text-sm text-slate-400">Nessun piatto leggibile trovato nella foto. Prova ad avvicinarti di più al testo.</p>
          ) : (
            <div className="divide-y divide-white/10 border-t border-white/10">
              {result.dishes.map((dish, idx) => {
                const price = formatDishPrice(dish.price, result.currency);
                return (
                  <div key={`${dish.original}-${idx}`} className="py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm sm:text-base font-semibold text-white">{dish.italian}</span>
                          {price && <span className="text-sm font-semibold tabular-nums text-[#52d9e6]">{price}</span>}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className={`text-xs text-slate-400 ${wrap}`} lang={htmlLang}>{dish.original}</span>
                          {dish.spicy && dish.spicy !== 'none' && (
                            <span className="text-[11px] font-medium text-amber-300">{SPICY_LABEL[dish.spicy]}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOrderDish(dish, orderPhrase(dish))}
                        aria-label={`Mostra ${dish.italian} al cameriere`}
                        data-keep-style
                        className={`min-h-10 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-medium inline-flex items-center gap-1.5 shrink-0 transition-colors ${FOCUS_RING}`}
                      >
                        <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" /> Mostra
                      </button>
                    </div>

                    {dish.description && (
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{dish.description}</p>
                    )}

                    {dish.warnings.length > 0 && (
                      <ul className="space-y-1 pt-0.5">
                        {dish.warnings.map((w, wi) => (
                          <li
                            key={wi}
                            className={`text-xs flex items-start gap-1.5 ${w.severity === 'high' ? 'text-rose-300 font-medium' : 'text-amber-300'}`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                            <span>
                              <b>{w.person}:</b> {w.reason}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {dish.allergens.length > 0 && dish.warnings.length === 0 && (
                      <p className="text-[11px] text-slate-400">Allergeni tipici: {dish.allergens.join(', ')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {result.notes && <p className="text-xs text-slate-400 leading-relaxed">{result.notes}</p>}
          <p className="text-[11px] text-slate-500 leading-snug">
            Traduzione automatica da foto: per allergie gravi conferma sempre mostrando la scheda allergeni qui accanto.
          </p>
        </div>
      )}
    </section>
  );
};
