/**
 * Lingue delle schede "da mostrare": coreano per Seul, cinese (mandarino semplificato) per lo scalo a Pechino.
 * Una riga da mostrare ha il testo nella lingua locale, la lettura in lettere latine e la traduzione in italiano.
 */
export type ShowLang = 'ko' | 'zh';

export interface ShowLine {
  /** Testo nella lingua locale (hangul o caratteri cinesi semplificati) */
  text: string;
  /** Lettura in lettere latine (romanizzazione coreana o pinyin con i toni) */
  rom: string;
  it: string;
}

export const SHOW_LANGS: Record<ShowLang, { htmlLang: string; label: string; native: string; country: string }> = {
  ko: { htmlLang: 'ko', label: 'Coreano', native: '한국어', country: 'Corea del Sud' },
  zh: { htmlLang: 'zh-CN', label: 'Cinese', native: '中文', country: 'Cina' }
};

/**
 * Il coreano non va a capo dentro le parole (keep-all); il cinese non ha spazi,
 * quindi deve poter andare a capo tra un carattere e l'altro.
 */
export const wrapClass = (lang: ShowLang) => (lang === 'ko' ? 'break-keep' : 'break-words');
