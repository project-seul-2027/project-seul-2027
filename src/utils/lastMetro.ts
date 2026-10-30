/**
 * Avviso "ultima metro": ricavato dagli orari ufficiali per linea (seoulMetroOfficialData).
 * Non conosce la stazione esatta, quindi dà l'intervallo di tutte le linee e invita a controllare.
 */
import { OFFICIAL_METRO_LINE_DATA } from '../data/seoulMetroOfficialData';

const toMin = (hh: string, mm: string) => Number(hh) * 60 + Number(mm);

function lastTrainMinutes(): number[] {
  const out: number[] = [];
  Object.values(OFFICIAL_METRO_LINE_DATA).forEach((l) => {
    [l.lastTrainWeekday, l.lastTrainWeekend].forEach((s) => {
      for (const m of s.matchAll(/(\d{1,2}):(\d{2})/g)) {
        const v = toMin(m[1], m[2]);
        // Gli orari dopo mezzanotte (00:xx) contano come 24:xx
        const norm = v < 4 * 60 ? v + 24 * 60 : v;
        if (norm >= 22 * 60) out.push(norm);
      }
    });
  });
  return out;
}

const fmt = (m: number) => {
  const x = m % (24 * 60);
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

export type LastMetroLevel = 'none' | 'soon' | 'now' | 'closed';
export interface LastMetroStatus {
  level: LastMetroLevel;
  title: string;
  text: string;
}

export function lastMetroStatus(nowMs: number): LastMetroStatus {
  const all = lastTrainMinutes();
  const earliest = Math.min(...all);
  const latest = Math.max(...all);
  const kst = new Date(nowMs + 9 * 3_600_000);
  let m = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  if (m < 4 * 60) m += 24 * 60;
  const range = `${fmt(earliest)} e le ${fmt(latest)}`;

  if (m >= earliest - 60 && m < earliest) {
    return { level: 'soon', title: 'Ultima metro in arrivo', text: `Le ultime corse partono tra le ${range}, a seconda di linea e stazione. Se sei lontano dall’alloggio, conviene muoversi adesso.` };
  }
  if (m >= earliest && m <= latest + 15) {
    return { level: 'now', title: 'Ultime corse in questo momento', text: `Le ultime metro partono tra le ${range}. Controlla la tua stazione su Naver Map e vai subito.` };
  }
  if (m > latest + 15 && m < 29 * 60) {
    return { level: 'closed', title: 'Metro chiusa', text: 'Le prime corse ripartono verso le 5:00-5:30. Per tornare ora: taxi (carta o app Kakao T) oppure bus notturni.' };
  }
  return { level: 'none', title: '', text: '' };
}
