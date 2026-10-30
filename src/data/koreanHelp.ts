/**
 * Frasi in coreano da mostrare a tassisti, ristoratori e personale.
 * Ogni frase ha la lettura in lettere latine (pronuncia semplificata) e la traduzione in italiano.
 */
import { DIETARY_OPTIONS } from '../shared/travelerProfile';

export interface Phrase {
  ko: string;
  rom: string;
  it: string;
}

export interface PhraseGroup {
  id: string;
  title: string;
  phrases: Phrase[];
}

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** Ultima sillaba hangul della parola: indice della consonante finale (0 = nessuna, 8 = ㄹ). */
function finalConsonant(word: string): number | null {
  for (let i = word.length - 1; i >= 0; i--) {
    const code = word.charCodeAt(i);
    if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % 28;
  }
  return null;
}

/** "로" dopo vocale o ㄹ, "으로" dopo le altre consonanti. Se non è hangul, usa "(으)로". */
export function withDirectionParticle(word: string): string {
  const fin = finalConsonant(word);
  if (fin === null) return `${word}(으)로`;
  return fin === 0 || fin === 8 ? `${word}로` : `${word}으로`;
}

/** "가" dopo vocale, "이" dopo consonante. */
export function withSubjectParticle(word: string): string {
  const fin = finalConsonant(word);
  if (fin === null) return `${word}이/가`;
  return fin === 0 ? `${word}가` : `${word}이`;
}

export const hasHangul = (s?: string) => !!s && /[가-힣]/.test(s);

/** Prima parte del nome coreano (alcuni hanno varianti separate da "/"). */
export const cleanKoreanName = (s: string) => s.split('/')[0].trim();

/* ---------- Allergeni: dall'italiano al coreano ---------- */

interface Allergen {
  keys: string[];
  ko: string;
  rom: string;
  it: string;
}

const ALLERGENS: Allergen[] = [
  { keys: ['arachid', 'noccioline', 'peanut'], ko: '땅콩', rom: 'ttangkong', it: 'arachidi' },
  { keys: ['frutta a guscio', 'frutta secca', 'noci', 'mandorl', 'nocciol', 'anacard', 'pistacch'], ko: '견과류', rom: 'gyeongwaryu', it: 'frutta a guscio' },
  { keys: ['latte', 'latticin', 'lattosio', 'formagg'], ko: '우유', rom: 'uyu', it: 'latte e latticini' },
  { keys: ['uov', 'uovo'], ko: '달걀', rom: 'dalgyal', it: 'uova' },
  { keys: ['glutine', 'frumento', 'grano', 'celiac'], ko: '밀', rom: 'mil', it: 'glutine / grano' },
  { keys: ['soia'], ko: '대두', rom: 'daedu', it: 'soia' },
  { keys: ['sesamo'], ko: '참깨', rom: 'chamkkae', it: 'sesamo' },
  { keys: ['gamber', 'crostacei', 'granchi', 'aragost', 'scampi'], ko: '갑각류', rom: 'gapgakryu', it: 'crostacei (gamberi, granchi)' },
  { keys: ['molluschi', 'cozze', 'vongole', 'calamar', 'polpo', 'seppia'], ko: '조개류', rom: 'jogaeryu', it: 'molluschi' },
  { keys: ['pesce', 'pesci'], ko: '생선', rom: 'saengseon', it: 'pesce' },
  { keys: ['maiale', 'suino'], ko: '돼지고기', rom: 'dwaejigogi', it: 'carne di maiale' },
  { keys: ['manzo', 'bovino'], ko: '소고기', rom: 'sogogi', it: 'carne di manzo' },
  { keys: ['pollo'], ko: '닭고기', rom: 'dakgogi', it: 'pollo' },
  { keys: ['solfiti'], ko: '아황산염', rom: 'ahwangsanyeom', it: 'solfiti' },
  { keys: ['pesca', 'pesche'], ko: '복숭아', rom: 'boksunga', it: 'pesca' }
];

export const ALLERGEN_OPTIONS = ALLERGENS.map((a) => ({ key: a.keys[0], it: a.it, ko: a.ko }));

export function detectAllergens(text: string): Allergen[] {
  const t = text.toLowerCase();
  return ALLERGENS.filter((a) => a.keys.some((k) => t.includes(k)));
}

/* ---------- Carta personale: dieta e allergie ---------- */

export type DietKind = 'any' | 'mild' | 'veg' | 'vegan' | 'allergy';

export function dietKind(pref: string | undefined): DietKind {
  const idx = DIETARY_OPTIONS.findIndex((o) => o === pref);
  return (['any', 'mild', 'veg', 'vegan', 'allergy'] as const)[idx] ?? 'any';
}

export interface DietCard {
  title: string;
  lines: Phrase[];
  /** Allergeni riconosciuti automaticamente, con la traduzione */
  recognized: { ko: string; rom: string; it: string }[];
  /** Testo libero che non siamo riusciti a tradurre */
  unrecognized: string;
}

export function buildDietCard(pref: string | undefined, allergies: string | undefined, severe: boolean): DietCard {
  const kind = dietKind(pref);
  const lines: Phrase[] = [];
  const allergyText = (allergies ?? '').trim();
  const found = allergyText ? detectAllergens(allergyText) : [];

  if (kind === 'mild') {
    lines.push({ ko: '안 맵게 해 주세요.', rom: 'An maepge hae juseyo.', it: 'Non piccante, per favore.' });
    lines.push({ ko: '고추장과 매운 국물은 빼 주세요.', rom: 'Gochujang-gwa maeun gungmul-eun ppae juseyo.', it: 'Senza gochujang e brodi piccanti.' });
  }
  if (kind === 'veg') {
    lines.push({ ko: '저는 고기를 먹지 않아요.', rom: 'Jeoneun gogireul meokji anayo.', it: 'Non mangio carne.' });
    lines.push({ ko: '고기와 고기 육수는 빼 주세요.', rom: 'Gogiwa gogi yuksuneun ppae juseyo.', it: 'Senza carne e senza brodo di carne.' });
    lines.push({ ko: '멸치 육수도 안 돼요.', rom: 'Myeolchi yuksudo an dwaeyo.', it: 'Niente nemmeno brodo di acciuga (è molto comune).' });
  }
  if (kind === 'vegan') {
    lines.push({ ko: '저는 비건이에요.', rom: 'Jeoneun bigeon-ieyo.', it: 'Sono vegano/a.' });
    lines.push({ ko: '고기, 생선, 달걀, 우유, 젓갈, 육수는 빼 주세요.', rom: 'Gogi, saengseon, dalgyal, uyu, jeotgal, yuksuneun ppae juseyo.', it: 'Senza carne, pesce, uova, latte, salse di pesce fermentate e brodo.' });
  }
  if (kind === 'allergy' || found.length > 0 || allergyText) {
    if (found.length > 0) {
      const list = found.map((f) => f.ko).join(', ');
      lines.push({
        ko: `저는 ${list} 알레르기가 있어요.`,
        rom: `Jeoneun ${found.map((f) => f.rom).join(', ')} allereugi-ga isseoyo.`,
        it: `Sono allergico/a a: ${found.map((f) => f.it).join(', ')}.`
      });
      const last = found[found.length - 1].ko;
      lines.push({
        ko: `${withSubjectParticle(last)} 들어가면 안 돼요.`,
        rom: 'Deureogamyeon an dwaeyo.',
        it: 'Non deve contenerli (nemmeno tracce).'
      });
    } else if (kind === 'allergy') {
      lines.push({ ko: '저는 음식 알레르기가 있어요.', rom: 'Jeoneun eumsik allereugi-ga isseoyo.', it: 'Ho un’allergia alimentare.' });
    }
    if (severe) {
      lines.push({ ko: '아주 심해요. 조금만 들어가도 위험해요.', rom: 'Aju simhaeyo. Jogeumman deureogado wiheomhaeyo.', it: 'È grave: anche una piccola quantità è pericolosa.' });
    }
    lines.push({ ko: '재료를 확인해 주세요.', rom: 'Jaeryoreul hwaginhae juseyo.', it: 'Può controllare gli ingredienti, per favore?' });
  }
  if (lines.length === 0) {
    lines.push({ ko: '저는 다 잘 먹어요. 매운 음식도 좋아해요.', rom: 'Jeoneun da jal meogeoyo. Maeun eumsikdo joahaeyo.', it: 'Mangio di tutto, anche il piccante.' });
  }

  const unrecognized = found.length === 0 ? allergyText : '';
  const title = kind === 'vegan' ? 'Vegano/a' : kind === 'veg' ? 'Vegetariano/a' : kind === 'mild' ? 'Poco piccante' : kind === 'allergy' || found.length ? 'Allergie' : 'Nessuna restrizione';
  return { title, lines, recognized: found.map(({ ko, rom, it }) => ({ ko, rom, it })), unrecognized };
}

/* ---------- Frasi utili ---------- */

export const PHRASE_GROUPS: PhraseGroup[] = [
  {
    id: 'taxi',
    title: 'Taxi',
    phrases: [
      { ko: '여기서 내려 주세요.', rom: 'Yeogiseo naeryeo juseyo.', it: 'Mi fa scendere qui, per favore.' },
      { ko: '카드로 계산할게요.', rom: 'Kadeuro gyesanhalgeyo.', it: 'Pago con la carta.' },
      { ko: '미터기를 켜 주세요.', rom: 'Miteogireul kyeo juseyo.', it: 'Accenda il tassametro, per favore.' },
      { ko: '트렁크를 열어 주세요.', rom: 'Teureongkeureul yeoreo juseyo.', it: 'Può aprire il bagagliaio?' },
      { ko: '조금 천천히 가 주세요.', rom: 'Jogeum cheoncheonhi ga juseyo.', it: 'Vada un po’ più piano, per favore.' }
    ]
  },
  {
    id: 'ristorante',
    title: 'Ristorante',
    phrases: [
      { ko: '세 명이에요. / 네 명이에요.', rom: 'Se myeong-ieyo. / Ne myeong-ieyo.', it: 'Siamo in tre. / Siamo in quattro.' },
      { ko: '메뉴판 주세요.', rom: 'Menyupan juseyo.', it: 'Il menù, per favore.' },
      { ko: '이거 주세요.', rom: 'Igeo juseyo.', it: 'Prendo questo (indicando).' },
      { ko: '추천해 주세요.', rom: 'Chucheonhae juseyo.', it: 'Cosa ci consiglia?' },
      { ko: '안 맵게 해 주세요.', rom: 'An maepge hae juseyo.', it: 'Non piccante, per favore.' },
      { ko: '물 주세요.', rom: 'Mul juseyo.', it: 'Dell’acqua, per favore.' },
      { ko: '따로 계산해 주세요.', rom: 'Ttaro gyesanhae juseyo.', it: 'Conto separato, per favore.' },
      { ko: '포장해 주세요.', rom: 'Pojanghae juseyo.', it: 'Da portare via, per favore.' },
      { ko: '계산해 주세요.', rom: 'Gyesanhae juseyo.', it: 'Il conto, per favore.' },
      { ko: '맛있어요!', rom: 'Masisseoyo!', it: 'Buonissimo!' }
    ]
  },
  {
    id: 'negozi',
    title: 'Negozi e metro',
    phrases: [
      { ko: '얼마예요?', rom: 'Eolmayeyo?', it: 'Quanto costa?' },
      { ko: '택스 리펀드 되나요?', rom: 'Taekseu ripeondeu doenayo?', it: 'C’è il tax refund?' },
      { ko: '화장실이 어디예요?', rom: 'Hwajangsiri eodiyeyo?', it: 'Dov’è il bagno?' },
      { ko: '티머니 카드를 충전하고 싶어요.', rom: 'Timeoni kadeureul chungjeonhago sipeoyo.', it: 'Vorrei ricaricare la T-money.' },
      { ko: '이 근처에 편의점 있어요?', rom: 'I geuncheoe pyeonuijeom isseoyo?', it: 'C’è un minimarket qui vicino?' }
    ]
  },
  {
    id: 'emergenza',
    title: 'Emergenze',
    phrases: [
      { ko: '도와주세요!', rom: 'Dowajuseyo!', it: 'Aiuto!' },
      { ko: '경찰을 불러 주세요.', rom: 'Gyeongchareul bulleo juseyo.', it: 'Chiami la polizia.' },
      { ko: '구급차를 불러 주세요.', rom: 'Gugeupchareul bulleo juseyo.', it: 'Chiami un’ambulanza.' },
      { ko: '병원에 가야 해요.', rom: 'Byeongwone gaya haeyo.', it: 'Devo andare in ospedale.' },
      { ko: '여권을 잃어버렸어요.', rom: 'Yeogwoneul ireobeoryeosseoyo.', it: 'Ho perso il passaporto.' },
      { ko: '지갑을 잃어버렸어요.', rom: 'Jigabeul ireobeoryeosseoyo.', it: 'Ho perso il portafoglio.' },
      { ko: '영어 하시는 분 계세요?', rom: 'Yeongeo hasineun bun gyeseyo?', it: 'C’è qualcuno che parla inglese?' }
    ]
  }
];

/** Numeri utili in Corea del Sud (da confermare prima della partenza). */
export const EMERGENCY_NUMBERS = [
  { number: '112', label: 'Polizia' },
  { number: '119', label: 'Ambulanza e vigili del fuoco' },
  { number: '1330', label: 'Assistenza turisti (Korea Travel Hotline, anche in inglese)' }
];
