import { useCallback, useEffect, useRef, useState } from 'react';
import { firebase, isFirebaseConfigured } from '../firebase/client';
import type { ShowLang } from '../data/showLanguage';

const BCP47: Record<ShowLang, string> = {
  ko: 'ko-KR',
  zh: 'zh-CN'
};

/** Cache in memoria per sessione (chiave = "ko:testo" -> blob URL): evita richieste doppie */
const audioCache = new Map<string, string>();

export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window || typeof Audio !== 'undefined';
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: ShowLang): SpeechSynthesisVoice | null {
  const target = BCP47[lang].toLowerCase();
  const prefix = lang.toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === target && v.localService) ??
    voices.find((v) => v.lang.toLowerCase() === target) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) ??
    null
  );
}

/** Scarica l'audio MP3 dal middleware dev (/api/tts) o dal Cloudflare Worker (/tts). */
async function fetchTtsBlobUrl(text: string, lang: ShowLang): Promise<string> {
  const cacheKey = `${lang}:${text}`;
  const cached = audioCache.get(cacheKey);
  if (cached) return cached;

  const trimmed = text.slice(0, 200);

  // 1. In sviluppo locale (localhost:3000): middleware Vite integrato
  if (import.meta.env.DEV) {
    const res = await fetch(`/api/tts?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(10_000)
    });
    if (res.ok && res.headers.get('content-type')?.includes('audio')) {
      const url = URL.createObjectURL(await res.blob());
      audioCache.set(cacheKey, url);
      return url;
    }
  }

  // 2. Produzione (o fallback): endpoint /tts sul Cloudflare Worker autenticato con Firebase
  const base = import.meta.env.VITE_MAP_SEARCH_URL?.trim();
  const user = isFirebaseConfigured ? firebase().auth.currentUser : null;
  if (base && user) {
    const res = await fetch(`${base.replace(/\/+$/, '')}/tts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: trimmed, lang }),
      signal: AbortSignal.timeout(10_000)
    });
    if (res.ok && res.headers.get('content-type')?.includes('audio')) {
      const url = URL.createObjectURL(await res.blob());
      audioCache.set(cacheKey, url);
      return url;
    }
  }

  throw new Error('tts-unavailable');
}

/**
 * Pronuncia vocale in coreano (ko-KR) e cinese (zh-CN).
 * 1) Se il dispositivo ha una voce nativa per la lingua, usa Web Speech API (funziona anche offline).
 * 2) Se manca la voce di sistema (es. Windows senza language pack o webview) o la sintesi non parte,
 *    usa automaticamente il fallback audio MP3 (in locale via Vite, in produzione via Cloudflare Worker).
 */
export function useSpeech() {
  const supported = isSpeechSupported();
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const watchdogRef = useRef<number | null>(null);
  const runSeqRef = useRef(0);

  const clearWatchdog = () => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const load = () => {
      voicesRef.current = synth.getVoices();
    };
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      clearWatchdog();
      try {
        synth.cancel();
      } catch {
        /* niente */
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stop = useCallback(() => {
    runSeqRef.current += 1;
    clearWatchdog();
    utteranceRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* niente */
      }
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  const playAudioFallback = useCallback(async (text: string, lang: ShowLang, id: string, seq: number) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      if (runSeqRef.current === seq) {
        setSpeakingId(null);
        setError(
          lang === 'zh'
            ? 'Sei offline e questo dispositivo non ha la voce cinese installata.'
            : 'Sei offline e questo dispositivo non ha la voce coreana installata.'
        );
      }
      return;
    }
    try {
      const url = await fetchTtsBlobUrl(text, lang);
      if (runSeqRef.current !== seq) return;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        if (runSeqRef.current === seq) {
          audioRef.current = null;
          setSpeakingId(null);
        }
      };
      audio.onerror = () => {
        if (runSeqRef.current === seq) {
          audioRef.current = null;
          setSpeakingId(null);
          setError('Impossibile riprodurre l’audio su questo browser.');
        }
      };
      await audio.play();
    } catch {
      if (runSeqRef.current === seq) {
        setSpeakingId(null);
        setError(
          lang === 'zh'
            ? 'Audio cinese non disponibile: installa la voce Cinese sul dispositivo oppure verifica la connessione.'
            : 'Audio coreano non disponibile: installa la voce Coreano sul dispositivo oppure verifica la connessione.'
        );
      }
    }
  }, []);

  const speak = useCallback(
    (text: string, lang: ShowLang, id: string) => {
      if (!supported) return;
      const clean = text.trim();
      if (!clean) return;

      if (speakingId === id) {
        stop();
        return;
      }

      stop();
      const seq = runSeqRef.current;
      setError(null);
      setSpeakingId(id);

      const hasSynth = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
      const synth = hasSynth ? window.speechSynthesis : null;
      const voices = synth ? (voicesRef.current.length ? voicesRef.current : synth.getVoices()) : [];
      const nativeVoice = pickVoice(voices, lang);

      // Se il sistema non ha una voce coreana/cinese installata, passa subito al fallback audio MP3
      if (!synth || !nativeVoice) {
        void playAudioFallback(clean, lang, id, seq);
        return;
      }

      const startNative = () => {
        if (runSeqRef.current !== seq) return;
        try {
          if (synth.paused) synth.resume();
          const u = new SpeechSynthesisUtterance(clean);
          u.lang = BCP47[lang];
          u.voice = nativeVoice;
          u.rate = 0.9;
          utteranceRef.current = u;

          let started = false;
          u.onstart = () => {
            started = true;
            clearWatchdog();
          };
          u.onend = () => {
            clearWatchdog();
            if (runSeqRef.current === seq) {
              utteranceRef.current = null;
              setSpeakingId(null);
            }
          };
          u.onerror = () => {
            clearWatchdog();
            if (runSeqRef.current === seq) {
              utteranceRef.current = null;
              void playAudioFallback(clean, lang, id, seq);
            }
          };

          // Watchdog: in alcuni webview Chromium speak() non lancia né onstart né onerror
          watchdogRef.current = window.setTimeout(() => {
            if (!started && runSeqRef.current === seq) {
              try {
                synth.cancel();
              } catch {
                /* niente */
              }
              utteranceRef.current = null;
              void playAudioFallback(clean, lang, id, seq);
            }
          }, 1100);

          synth.speak(u);
        } catch {
          void playAudioFallback(clean, lang, id, seq);
        }
      };

      // Fix Chromium/Windows: dopo cancel() serve un breve tick prima di speak()
      if (synth.speaking || synth.pending) {
        window.setTimeout(startNative, 50);
      } else {
        startNative();
      }
    },
    [supported, speakingId, stop, playAudioFallback]
  );

  return { supported, speakingId, error, clearError: () => setError(null), speak, stop };
}
