/**
 * Cinese (mandarino, caratteri semplificati) per lo scalo a Pechino.
 * Ogni frase ha il pinyin con i toni (con i cambi di tono di 不 e 一 già applicati, come si pronunciano)
 * e la traduzione in italiano. Le frasi sono brevi e neutre, da mostrare a tassisti, camerieri e personale.
 */
import { detectAllergens, dietKind } from './koreanHelp';
import type { DietCard } from './koreanHelp';
import type { ShowLine } from './showLanguage';

export interface ZhPhraseGroup {
  id: string;
  title: string;
  phrases: ShowLine[];
}

const p = (text: string, rom: string, it: string): ShowLine => ({ text, rom, it });

/* ---------- Luoghi dello scalo (per il tassista) ---------- */

export interface ZhDestination {
  id: string;
  /** Luogo collegato in MAP_LOCATIONS, se esiste */
  locationId?: string;
  it: string;
  /** Zona, in italiano */
  area: string;
  zh: string;
  py: string;
  /** Frase in più da mostrare sotto il nome (es. terminal e partenze) */
  extra?: ShowLine[];
}

export const ZH_DESTINATIONS: ZhDestination[] = [
  {
    id: 'pek_t3',
    locationId: 'beijing_airport_t3',
    it: 'Aeroporto Capitale, Terminal 3',
    area: 'Aeroporto di Pechino (PEK)',
    zh: '北京首都国际机场 3号航站楼',
    py: 'Běijīng Shǒudū Guójì Jīchǎng, sān hào hángzhànlóu',
    extra: [
      p('国际出发。', 'Guójì chūfā.', 'Partenze internazionali.'),
      p('不是大兴机场。', 'Bú shì Dàxīng Jīchǎng.', 'Non l’aeroporto di Daxing.')
    ]
  },
  {
    id: 'dongzhimen',
    locationId: 'beijing_dongzhimen',
    it: 'Stazione Dongzhimen (Airport Express)',
    area: 'Centro, capolinea dell’Airport Express',
    zh: '东直门站（机场快轨）',
    py: 'Dōngzhímén zhàn (jīchǎng kuàiguǐ)'
  },
  {
    id: 'qianmen',
    locationId: 'beijing_qianmen',
    it: 'Via pedonale di Qianmen',
    area: 'Centro storico, a sud di Tiananmen',
    zh: '前门大街',
    py: 'Qiánmén Dàjiē'
  },
  {
    id: 'dashilar',
    locationId: 'beijing_qianmen',
    it: 'Dashilar',
    area: 'Centro storico, accanto a Qianmen',
    zh: '大栅栏',
    py: 'Dàshílànr'
  },
  {
    id: 'quanjude_qianmen',
    locationId: 'beijing_qianmen',
    it: 'Quanjude Qianmen (anatra laccata)',
    area: 'Ristorante sulla via di Qianmen',
    zh: '全聚德 前门店',
    py: 'Quánjùdé, Qiánmén diàn'
  },
  {
    id: 'tiananmen',
    locationId: 'beijing_tiananmen',
    it: 'Piazza Tiananmen',
    area: 'Dongcheng, centro storico',
    zh: '天安门广场',
    py: 'Tiān’ānmén Guǎngchǎng'
  }
];

/** Frase per il tassista sopra il nome del luogo: non dipende dal nome, quindi è sempre corretta. */
export const ZH_TAXI_LINE = p('师傅，请带我们去这里。', 'Shīfu, qǐng dài wǒmen qù zhèlǐ.', 'Ci porti qui, per favore.');

/** Ricerca su Amap (Gaode), la mappa più usata in Cina: in Cina Google Maps non funziona senza roaming. */
export const amapSearchUrl = (zh: string) =>
  `https://uri.amap.com/search?keyword=${encodeURIComponent(zh.replace(/[（）()]/g, ' ').trim())}&city=${encodeURIComponent('北京')}&callnative=1`;

/* ---------- Frasi ---------- */

export const ZH_PHRASE_GROUPS: ZhPhraseGroup[] = [
  {
    id: 'taxi',
    title: 'Taxi',
    phrases: [
      p('师傅，请打表。', 'Shīfu, qǐng dǎ biǎo.', 'Accenda il tassametro, per favore.'),
      p('请在这里停车。', 'Qǐng zài zhèlǐ tíngchē.', 'Si fermi qui, per favore.'),
      p('可以用支付宝或者微信付款吗？', 'Kěyǐ yòng Zhīfùbǎo huòzhě Wēixìn fùkuǎn ma?', 'Posso pagare con Alipay o WeChat?'),
      p('请打开后备箱。', 'Qǐng dǎkāi hòubèixiāng.', 'Può aprire il bagagliaio?'),
      p('我们要赶飞机，请快一点。', 'Wǒmen yào gǎn fēijī, qǐng kuài yìdiǎn.', 'Dobbiamo prendere un aereo: un po’ più veloce, per favore.'),
      p('请给我发票。', 'Qǐng gěi wǒ fāpiào.', 'Mi dà la ricevuta, per favore.')
    ]
  },
  {
    id: 'ristorante',
    title: 'Ristorante',
    phrases: [
      p('我们四个人。', 'Wǒmen sì ge rén.', 'Siamo in quattro.'),
      p('有英文菜单或者图片菜单吗？', 'Yǒu Yīngwén càidān huòzhě túpiàn càidān ma?', 'C’è un menù in inglese o con le foto?'),
      p('我要这个。', 'Wǒ yào zhège.', 'Prendo questo (indicando).'),
      p('有什么推荐的？', 'Yǒu shénme tuījiàn de?', 'Cosa ci consiglia?'),
      p('一只烤鸭，我们四个人吃。', 'Yì zhī kǎoyā, wǒmen sì ge rén chī.', 'Un’anatra laccata intera, per noi quattro.'),
      p('半只烤鸭。', 'Bàn zhī kǎoyā.', 'Mezza anatra laccata.'),
      p('不要辣，谢谢。', 'Bú yào là, xièxie.', 'Non piccante, grazie.'),
      p('请给我们几杯水。', 'Qǐng gěi wǒmen jǐ bēi shuǐ.', 'Ci porta dell’acqua, per favore?'),
      p('请帮我们打包。', 'Qǐng bāng wǒmen dǎbāo.', 'Da portare via, per favore.'),
      p('买单。', 'Mǎidān.', 'Il conto, per favore.'),
      p('可以分开付吗？', 'Kěyǐ fēnkāi fù ma?', 'Possiamo pagare separatamente?'),
      p('很好吃！', 'Hěn hǎochī!', 'Buonissimo!')
    ]
  },
  {
    id: 'pagare',
    title: 'Pagare e negozi',
    phrases: [
      p('多少钱？', 'Duōshao qián?', 'Quanto costa?'),
      p('可以用支付宝吗？', 'Kěyǐ yòng Zhīfùbǎo ma?', 'Posso pagare con Alipay?'),
      p('我扫你，还是你扫我？', 'Wǒ sǎo nǐ, háishi nǐ sǎo wǒ?', 'Scansiono io il suo codice QR o lei il mio?'),
      p('可以刷卡吗？', 'Kěyǐ shuā kǎ ma?', 'Posso pagare con la carta?'),
      p('可以付现金吗？', 'Kěyǐ fù xiànjīn ma?', 'Posso pagare in contanti?'),
      p('厕所在哪里？', 'Cèsuǒ zài nǎlǐ?', 'Dov’è il bagno?')
    ]
  },
  {
    id: 'aeroporto',
    title: 'Aeroporto e metro',
    phrases: [
      p('机场快轨在哪里？', 'Jīchǎng kuàiguǐ zài nǎlǐ?', 'Dov’è l’Airport Express?'),
      p('地铁站在哪里？', 'Dìtiě zhàn zài nǎlǐ?', 'Dov’è la metropolitana?'),
      p('我要去三号航站楼。', 'Wǒ yào qù sān hào hángzhànlóu.', 'Devo andare al Terminal 3.'),
      p('中国国际航空的柜台在哪里？', 'Zhōngguó Guójì Hángkōng de guìtái zài nǎlǐ?', 'Dov’è il banco Air China?'),
      p('行李寄存在哪里？', 'Xíngli jìcún zài nǎlǐ?', 'Dov’è il deposito bagagli?')
    ]
  },
  {
    id: 'emergenza',
    title: 'Emergenze',
    phrases: [
      p('救命！', 'Jiùmìng!', 'Aiuto!'),
      p('请帮我报警。', 'Qǐng bāng wǒ bàojǐng.', 'Chiami la polizia, per favore.'),
      p('请叫救护车。', 'Qǐng jiào jiùhùchē.', 'Chiami un’ambulanza.'),
      p('我需要去医院。', 'Wǒ xūyào qù yīyuàn.', 'Devo andare in ospedale.'),
      p('我的护照丢了。', 'Wǒ de hùzhào diū le.', 'Ho perso il passaporto.'),
      p('我的钱包丢了。', 'Wǒ de qiánbāo diū le.', 'Ho perso il portafoglio.'),
      p('我和朋友走散了。', 'Wǒ hé péngyou zǒusàn le.', 'Ho perso di vista i miei amici.'),
      p('有人会说英语吗？', 'Yǒu rén huì shuō Yīngyǔ ma?', 'C’è qualcuno che parla inglese?')
    ]
  }
];

/** Da mostrare al banco del transito senza visto di 240 ore, all'arrivo al Terminal 3. */
export const ZH_TRANSIT_COUNTER: ShowLine[] = [
  p('我要办理240小时过境免签。', 'Wǒ yào bànlǐ èrbǎi sìshí xiǎoshí guòjìng miǎnqiān.', 'Vorrei il permesso di transito senza visto di 240 ore.'),
  p('这是我的护照和去米兰的机票。', 'Zhè shì wǒ de hùzhào hé qù Mǐlán de jīpiào.', 'Ecco il passaporto e il biglietto per Milano.'),
  p('我们的航班凌晨两点十五分起飞，去米兰。', 'Wǒmen de hángbān língchén liǎng diǎn shíwǔ fēn qǐfēi, qù Mǐlán.', 'Il nostro volo per Milano parte alle 02:15 di notte.')
];

/** Numeri di emergenza nella Cina continentale. */
export const ZH_EMERGENCY_NUMBERS = [
  { number: '110', label: 'Polizia' },
  { number: '120', label: 'Ambulanza' },
  { number: '119', label: 'Vigili del fuoco' },
  { number: '122', label: 'Incidenti stradali' },
  { number: '+86 10 8532 7600', label: 'Ambasciata d’Italia a Pechino' }
];

/* ---------- Carta personale: dieta e allergie ---------- */

export function buildDietCardZh(pref: string | undefined, allergies: string | undefined, severe: boolean): DietCard {
  const kind = dietKind(pref);
  const lines: ShowLine[] = [];
  const allergyText = (allergies ?? '').trim();
  const found = allergyText ? detectAllergens(allergyText) : [];

  if (kind === 'mild') {
    lines.push(p('不要辣，谢谢。', 'Bú yào là, xièxie.', 'Non piccante, per favore.'));
    lines.push(p('请不要放辣椒和花椒。', 'Qǐng bú yào fàng làjiāo hé huājiāo.', 'Senza peperoncino e senza pepe di Sichuan.'));
  }
  if (kind === 'veg') {
    lines.push(p('我吃素，不吃肉和鱼。', 'Wǒ chī sù, bù chī ròu hé yú.', 'Sono vegetariano/a: niente carne né pesce.'));
    lines.push(p('请不要用肉汤和猪油。', 'Qǐng bú yào yòng ròutāng hé zhūyóu.', 'Niente brodo di carne e niente strutto (è molto comune).'));
  }
  if (kind === 'vegan') {
    lines.push(p('我吃纯素。', 'Wǒ chī chúnsù.', 'Sono vegano/a.'));
    lines.push(p('不要肉、鱼、海鲜、鸡蛋和奶制品。', 'Bú yào ròu, yú, hǎixiān, jīdàn hé nǎizhìpǐn.', 'Niente carne, pesce, frutti di mare, uova e latticini.'));
    lines.push(p('也不要猪油、蚝油和肉汤。', 'Yě bú yào zhūyóu, háoyóu hé ròutāng.', 'Niente strutto, salsa d’ostrica e brodo di carne.'));
  }
  if (kind === 'allergy' || found.length > 0 || allergyText) {
    if (found.length > 0) {
      lines.push(
        p(
          `我对${found.map((f) => f.zh).join('、')}过敏。`,
          `Wǒ duì ${found.map((f) => f.py).join(', ')} guòmǐn.`,
          `Sono allergico/a a: ${found.map((f) => f.it).join(', ')}.`
        )
      );
      lines.push(p('菜里不能有这些。', 'Cài lǐ bù néng yǒu zhèxiē.', 'Il piatto non deve contenerli.'));
    } else if (kind === 'allergy') {
      lines.push(p('我有食物过敏。', 'Wǒ yǒu shíwù guòmǐn.', 'Ho un’allergia alimentare.'));
    }
    if (severe) {
      lines.push(p('我过敏很严重，一点点也很危险。', 'Wǒ guòmǐn hěn yánzhòng, yìdiǎndiǎn yě hěn wēixiǎn.', 'È grave: anche una piccola quantità è pericolosa.'));
    }
    lines.push(p('请帮我确认一下配料。', 'Qǐng bāng wǒ quèrèn yíxià pèiliào.', 'Può controllare gli ingredienti, per favore?'));
  }
  if (lines.length === 0) {
    lines.push(p('我什么都吃，辣的也可以。', 'Wǒ shénme dōu chī, là de yě kěyǐ.', 'Mangio di tutto, anche il piccante.'));
  }

  const unrecognized = found.length === 0 ? allergyText : '';
  const title = kind === 'vegan' ? 'Vegano/a' : kind === 'veg' ? 'Vegetariano/a' : kind === 'mild' ? 'Poco piccante' : kind === 'allergy' || found.length ? 'Allergie' : 'Nessuna restrizione';
  return {
    title,
    lines: lines.map((l) => ({ ko: l.text, rom: l.rom, it: l.it })),
    recognized: found.map(({ zh, py, it }) => ({ ko: zh, rom: py, it })),
    unrecognized
  };
}

/* ---------- Scalo: orari e momenti ---------- */

/** Atterraggio a Pechino del 19 marzo (CA124, 14:20 ora di Pechino) */
export const BEIJING_LANDING_MS = Date.parse('2027-03-19T14:20:00+08:00');
/** Rientro tassativo al Terminal 3 (22:45 ora di Pechino) */
export const BEIJING_RETURN_MS = Date.parse('2027-03-19T22:45:00+08:00');
/** Decollo per Milano (CA949, 02:15 del 20 marzo ora di Pechino) */
export const BEIJING_DEPARTURE_MS = Date.parse('2027-03-20T02:15:00+08:00');

/**
 * Momenti in cui il cinese serve più del coreano: il cambio aereo dell'andata (2 marzo, solo in aeroporto)
 * e lo scalo del ritorno, dall'imbarco a Incheon fino al decollo per Milano.
 */
const CHINESE_WINDOWS: [number, number][] = [
  [Date.parse('2027-03-02T05:00:00+08:00'), Date.parse('2027-03-02T09:00:00+08:00')],
  [Date.parse('2027-03-19T12:40:00+09:00'), Date.parse('2027-03-20T03:00:00+08:00')]
];

export const isChineseMoment = (ms: number) => CHINESE_WINDOWS.some(([a, b]) => ms >= a && ms <= b);

/** Ora di Pechino, es. "18:05" */
export const beijingClock = (ms: number) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
