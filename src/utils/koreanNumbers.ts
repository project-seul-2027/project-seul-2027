/**
 * Numeri sino-coreani (per prezzi in KRW) e nativi coreani (per persone e pezzi),
 * con lettura in lettere latine e frasi lampo per ordinare o pagare al volo.
 */
import type { ShowLine } from '../data/showLanguage';

const DIGITS_KO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const DIGITS_ROM = ['', 'il', 'i', 'sam', 'sa', 'o', 'yuk', 'chil', 'pal', 'gu'];

/** Converte un blocco da 1 a 9999 in sino-coreano (es. 3500 -> 삼천오백 / samcheon-obaek). */
function chunkToKorean(n: number): { ko: string; rom: string } {
  const th = Math.floor(n / 1000);
  const hu = Math.floor((n % 1000) / 100);
  const te = Math.floor((n % 100) / 10);
  const on = n % 10;

  const koParts: string[] = [];
  const romParts: string[] = [];

  if (th > 0) {
    koParts.push(th === 1 ? '천' : `${DIGITS_KO[th]}천`);
    romParts.push(th === 1 ? 'cheon' : `${DIGITS_ROM[th]}cheon`);
  }
  if (hu > 0) {
    koParts.push(hu === 1 ? '백' : `${DIGITS_KO[hu]}백`);
    romParts.push(hu === 1 ? 'baek' : `${DIGITS_ROM[hu]}baek`);
  }
  if (te > 0) {
    koParts.push(te === 1 ? '십' : `${DIGITS_KO[te]}십`);
    romParts.push(te === 1 ? 'sip' : `${DIGITS_ROM[te]}sip`);
  }
  if (on > 0) {
    koParts.push(DIGITS_KO[on]);
    romParts.push(DIGITS_ROM[on]);
  }

  return { ko: koParts.join(''), rom: romParts.join('-') };
}

/**
 * Converte una cifra in won coreani (KRW) nella forma parlata standard.
 * Esempi:
 *  - 1.000   -> 천 원 (cheon won)
 *  - 10.000  -> 만 원 (man won)
 *  - 15.000  -> 만 오천 원 (man ocheon won)
 *  - 50.000  -> 오만 원 (oman won)
 *  - 100.000 -> 십만 원 (simman won)
 */
export function krwToKorean(raw: number): { hangul: string; rom: string } | null {
  const n = Math.floor(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 999_999_999) return null;

  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const rest = n % 10_000;

  const koGroups: string[] = [];
  const romGroups: string[] = [];

  if (eok > 0) {
    const c = chunkToKorean(eok);
    koGroups.push(`${eok === 1 ? '' : c.ko}억`);
    romGroups.push(`${eok === 1 ? '' : c.rom}eok`);
  }
  if (man > 0) {
    if (man === 1 && eok === 0) {
      koGroups.push('만');
      romGroups.push('man');
    } else {
      const c = chunkToKorean(man);
      // Assimilazione comune: 십만 si legge "simman"
      const romPrefix = c.rom.endsWith('sip') ? `${c.rom.slice(0, -3)}sim` : c.rom;
      koGroups.push(`${c.ko}만`);
      romGroups.push(`${romPrefix}man`);
    }
  }
  if (rest > 0) {
    const c = chunkToKorean(rest);
    koGroups.push(c.ko);
    romGroups.push(c.rom);
  }

  return {
    hangul: `${koGroups.join(' ')} 원`,
    rom: `${romGroups.join(' ')} won`
  };
}

export const KRW_PRESETS = [1000, 5000, 10000, 15000, 20000, 30000, 50000, 100000] as const;

export interface CountOption {
  n: number;
  ko: string;
  rom: string;
  phrase: ShowLine;
}

export const PEOPLE_COUNTS: CountOption[] = [
  { n: 1, ko: '한 명', rom: 'han myeong', phrase: { text: '한 명이에요.', rom: 'Han myeong-ieyo.', it: 'Sono da solo/a (1 persona).' } },
  { n: 2, ko: '두 명', rom: 'du myeong', phrase: { text: '두 명이에요.', rom: 'Du myeong-ieyo.', it: 'Siamo in due.' } },
  { n: 3, ko: '세 명', rom: 'se myeong', phrase: { text: '세 명이에요.', rom: 'Se myeong-ieyo.', it: 'Siamo in tre.' } },
  { n: 4, ko: '네 명', rom: 'ne myeong', phrase: { text: '네 명이에요.', rom: 'Ne myeong-ieyo.', it: 'Siamo in quattro.' } },
  { n: 5, ko: '다섯 명', rom: 'daseot myeong', phrase: { text: '다섯 명이에요.', rom: 'Daseot myeong-ieyo.', it: 'Siamo in cinque.' } }
];

export const ITEM_COUNTS: CountOption[] = [
  { n: 1, ko: '한 개', rom: 'han gae', phrase: { text: '이거 한 개 주세요.', rom: 'Igeo han gae juseyo.', it: 'Ne prendo uno di questo.' } },
  { n: 2, ko: '두 개', rom: 'du gae', phrase: { text: '이거 두 개 주세요.', rom: 'Igeo du gae juseyo.', it: 'Ne prendo due di questo.' } },
  { n: 3, ko: '세 개', rom: 'se gae', phrase: { text: '이거 세 개 주세요.', rom: 'Igeo se gae juseyo.', it: 'Ne prendo tre di questo.' } },
  { n: 4, ko: '네 개', rom: 'ne gae', phrase: { text: '이거 네 개 주세요.', rom: 'Igeo ne gae juseyo.', it: 'Ne prendo quattro di questo.' } },
  { n: 5, ko: '다섯 개', rom: 'daseot gae', phrase: { text: '이거 다섯 개 주세요.', rom: 'Igeo daseot gae juseyo.', it: 'Ne prendo cinque di questo.' } }
];

export const QUICK_COUNTER_PHRASES: ShowLine[] = [
  { text: '얼마예요?', rom: 'Eolmayeyo?', it: 'Quanto costa?' },
  { text: '안 맵게 해 주세요.', rom: 'An maepge hae juseyo.', it: 'Senza piccante, per favore.' },
  { text: '얼음 빼 주세요.', rom: 'Eoreum ppae juseyo.', it: 'Senza ghiaccio, per favore.' },
  { text: '카드로 계산할게요.', rom: 'Kadeuro gyesanhalgeyo.', it: 'Pago con la carta.' },
  { text: '택스 리펀드 되나요?', rom: 'Taekseu ripeondeu doenayo?', it: 'C’è il tax refund?' }
];
