/**
 * Legge il PDF dell'itinerario e ne ricava i giorni del programma (ItineraryDay).
 *
 * Nel PDF si riconoscono:
 *  - le "schede" dei giorni (numero grande a sinistra, titolo accanto, elenco puntato);
 *  - le sezioni "N marzo: titolo" con un testo introduttivo, una tabella a due colonne (ora / cosa fare),
 *    riquadri con elenchi e paragrafi finali.
 * Titoli e colonne si riconoscono dalle proporzioni del testo (pdfLayout.ts), non da coordinate fisse
 * né dal grassetto, così il parser regge anche se il PDF viene reimpaginato.
 * Il testo, con le posizioni, arriva da pdfTextExtract.ts. Qui non c'è nulla di legato al browser, così
 * lo stesso codice gira anche nel server (GitHub Actions) e nei test.
 *
 * Il risultato si unisce al programma già nel sito (buildItineraryFromPdf): quello che nel PDF non è cambiato
 * resta com'è (testi, riassunti, luoghi sulla mappa), quello che è cambiato viene riscritto dal PDF e riassunto.
 */
import type { ItineraryDay, MapLocation, ScheduleItem } from '../data/tripData';
import { isContent, isHeading, measureLayout, type PdfLayout } from './pdfLayout';

export interface PdfItem {
  x: number;
  y: number;
  w: number;
  h: number;
  bold: boolean;
  str: string;
}
export type PdfPage = PdfItem[];

export interface ParsedRow {
  time: string;
  text: string;
  bold: boolean;
}
export interface ParsedSection {
  title: string;
  /** Fuso indicato dal titolo o dalla tabella */
  zone: 'KR' | 'CN' | null;
  intro: string[];
  rows: ParsedRow[];
  tail: string[];
  callouts: { title: string; bullets: string[] }[];
}
export interface ParsedDay {
  /** Giorno di marzo 2027 (1-20) */
  n: number;
  cardTitle?: string;
  cardBullets: string[];
  phase?: ItineraryDay['phase'];
  sections: ParsedSection[];
}

export interface DayReport {
  n: number;
  status: 'invariato' | 'modificato' | 'nuovo' | 'non trovato';
  detail?: string;
}
export interface BuildResult {
  days: ItineraryDay[];
  report: DayReport[];
  warnings: string[];
  /** Falso se il PDF non contiene un programma riconoscibile: non si cambia nulla */
  ok: boolean;
}

// ───────────────────────── Testo e posizioni ─────────────────────────

const PHASES: Record<string, ItineraryDay['phase']> = {
  'prima settimana': 'Prima settimana',
  'seconda settimana': 'Seconda settimana',
  'ultima parte': 'Ultima parte',
  'ultimi giorni': 'Ultima parte'
};

export function joinItems(items: PdfItem[]): string {
  let out = '';
  let prevEnd = -Infinity;
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const gap = it.x - prevEnd;
    const space = out !== '' && gap > 1.2 && !/^[.,;:)!?]/.test(it.str) && !out.endsWith('(');
    out += (space ? ' ' : '') + it.str;
    prevEnd = it.x + it.w;
  }
  return out.replace(/\s+/g, ' ').trim();
}

interface Placed {
  it: PdfItem;
  page: number;
}

interface Line {
  page: number;
  y: number;
  /** Frammenti da sinistra a destra */
  items: PdfItem[];
}

function toLines(placed: Placed[], tolerance = 2.5): Line[] {
  const sorted = [...placed].sort((a, b) => a.page - b.page || b.it.y - a.it.y || a.it.x - b.it.x);
  const lines: Line[] = [];
  for (const { it, page } of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === page && Math.abs(last.y - it.y) <= tolerance) last.items.push(it);
    else lines.push({ page, y: it.y, items: [it] });
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

const isBullet = (it: PdfItem) => it.str.trim().startsWith('•');
const withoutBullet = (it: PdfItem): PdfItem => ({ ...it, str: it.str.trim().replace(/^•\s*/, '') });

// ───────────────────────── Àncore e regioni ─────────────────────────
//
// Il PDF si divide in regioni: ognuna parte da un'àncora (titolo di settimana, scheda di un giorno,
// sezione "N marzo: ...", altro titolo) e contiene il testo fino all'àncora successiva.

type AnchorKind = 'week' | 'card' | 'date' | 'other';

interface Anchor {
  kind: AnchorKind;
  page: number;
  /** Tutto quello che sta sotto questa quota (fino all'àncora successiva) appartiene alla regione */
  top: number;
  item: PdfItem;
}

interface Region {
  anchor: Anchor;
  items: Placed[];
}

/** "1 marzo: ritrovo a Malpensa", "19 marzo a Pechino: orari" */
const DATE_HEADING = /^(\d{1,2})\s+marzo\b\s*([^:]{0,40}?)\s*:\s*(.*)$/i;

function findAnchor(it: PdfItem, page: number, layout: PdfLayout): Anchor | null {
  const text = it.str.trim();
  // Scheda di un giorno: un numero grande ("2" o "02") nella colonna di sinistra, con il titolo accanto e un po' più in alto
  if (/^\d{1,2}$/.test(text) && it.h >= layout.body * 1.5 && it.x < layout.left + 45) {
    return { kind: 'card', page, top: it.y + it.h + 2, item: it };
  }
  if (it.x > layout.left + 12 || !isHeading(it, layout)) return null;
  const top = it.y + Math.max(it.h, 12);
  if (DATE_HEADING.test(text)) return { kind: 'date', page, top, item: it };
  if (PHASES[text.toLowerCase()]) return { kind: 'week', page, top, item: it };
  if (it.h >= layout.body * 1.4) return { kind: 'other', page, top, item: it };
  return null;
}

function splitRegions(pages: PdfPage[], layout: PdfLayout): Region[] {
  const regions: Region[] = [];
  pages.forEach((raw, page) => {
    const items = raw.filter(isContent);
    // Dalla più alta alla più bassa: ogni elemento va all'ultima àncora che sta sopra di lui
    const anchors = items
      .map((it) => findAnchor(it, page, layout))
      .filter((a): a is Anchor => a !== null)
      .sort((a, b) => b.top - a.top);
    for (const it of items) {
      const owner = anchors.filter((a) => a.top >= it.y).pop();
      if (!owner) {
        // Testo in cima alla pagina, prima di ogni àncora: continua la regione della pagina precedente
        regions[regions.length - 1]?.items.push({ it, page });
        continue;
      }
      let region = regions.find((r) => r.anchor === owner);
      if (!region) {
        region = { anchor: owner, items: [] };
        regions.push(region);
      }
      region.items.push({ it, page });
    }
  });
  return regions;
}

// ───────────────────────── Schede dei giorni ─────────────────────────

/** Scheda: numero del giorno, titolo (le righe prima del primo punto) ed elenco puntato. */
function parseCard(region: Region): { n: number; title: string; bullets: string[] } {
  const number = region.anchor.item;
  const contentX = number.x + 40;
  const lines = toLines(region.items.filter(({ it }) => it.x >= contentX));
  const title: string[] = [];
  const bullets: string[] = [];
  for (const line of lines) {
    const [first, ...rest] = line.items;
    if (isBullet(first)) bullets.push(joinItems([withoutBullet(first), ...rest]));
    else if (bullets.length) bullets[bullets.length - 1] += ' ' + joinItems(line.items);
    else title.push(joinItems(line.items));
  }
  return {
    n: Number(number.str.trim()),
    title: title.join(' ').trim(),
    bullets: bullets.map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean)
  };
}

// ───────────────────────── Sezioni "N marzo: ..." ─────────────────────────
//
// Una sezione ha, in quest'ordine variabile: paragrafi introduttivi, una tabella oraria a due colonne
// ("Ora" / "Cosa fare"), riquadri rientrati con titolo ed elenco, paragrafi finali.
// Dopo un paragrafo che segue la tabella, eventuali altre tabelle (es. costi) non fanno parte del programma.

const TIME_HEADER = /^(ora|quando)\b/i;
const TEXT_HEADER = /^(cosa fare|linee guida)$/i;

const zoneOf = (t: string): ParsedSection['zone'] => (/coreana|\bseul\b/i.test(t) ? 'KR' : /pechino|cines/i.test(t) ? 'CN' : null);

function parseSection(region: Region, layout: PdfLayout): { n: number; section: ParsedSection } {
  const heading = region.anchor.item;
  const [, day, extra, rest] = DATE_HEADING.exec(heading.str.trim())!;
  const title = (extra ? `${extra}: ${rest}` : rest).trim();
  const section: ParsedSection = { title, zone: zoneOf(heading.str), intro: [], rows: [], tail: [], callouts: [] };

  // Colonne della tabella: valori tipici finché non si legge l'intestazione vera
  let timeX = layout.left + 6;
  let textX = layout.left + 85;
  let state: 'intro' | 'table' | 'after' = 'intro';
  const tableLines: Line[] = [];
  let callout: ParsedSection['callouts'][number] | null = null;
  let lastParagraph: Line | null = null;

  const addParagraph = (line: Line, target: string[]) => {
    const text = joinItems(line.items);
    const continues = lastParagraph && lastParagraph.page === line.page && lastParagraph.y - line.y <= 16 && target.length > 0;
    if (continues) target[target.length - 1] += ' ' + text;
    else target.push(text);
    lastParagraph = line;
  };

  for (const line of toLines(region.items.filter(({ it }) => it !== heading))) {
    const [first] = line.items;
    const text = joinItems(line.items);

    // Etichetta a destra del titolo ("martedì, ora locale")
    if (line.items.every((i) => i.x > 350) && line.y >= heading.y - 6) {
      section.zone ??= zoneOf(text);
      continue;
    }

    const textHeader = line.items.find((i, idx) => idx > 0 && TEXT_HEADER.test(i.str.trim()));
    if (TIME_HEADER.test(first.str.trim()) && textHeader) {
      timeX = first.x;
      textX = textHeader.x;
      state = 'table';
      callout = null;
      lastParagraph = null;
      section.zone ??= zoneOf(first.str);
      continue;
    }

    // Riquadro rientrato: titolo, punti elenco e righe che li continuano
    if (first.x > timeX + 3 && first.x < textX - 5) {
      if (isBullet(first)) {
        if (!callout) section.callouts.push((callout = { title: '', bullets: [] }));
        callout.bullets.push(joinItems([withoutBullet(first), ...line.items.slice(1)]).trim());
      } else if (isHeading(first, layout, 1.05)) {
        section.callouts.push((callout = { title: text, bullets: [] }));
      } else if (callout?.bullets.length) {
        callout.bullets[callout.bullets.length - 1] += ' ' + text;
      }
      lastParagraph = null;
      continue;
    }
    callout = null;

    if (first.x < timeX - 3) {
      addParagraph(line, state === 'intro' ? section.intro : section.tail);
      if (state === 'table') state = 'after';
      continue;
    }
    if (state === 'table') tableLines.push(line);
  }

  section.rows = buildRows(tableLines, textX);
  return { n: Number(day), section };
}

interface Cell {
  page: number;
  y: number;
  text: string;
  bold: boolean;
}

/** Unisce le righe vicine di una colonna in un'unica cella */
function mergeCells(cells: Cell[], gap = 16): Cell[] {
  const groups: { page: number; ys: number[]; texts: string[]; bold: boolean }[] = [];
  for (const c of cells) {
    const g = groups[groups.length - 1];
    if (g && g.page === c.page && g.ys[g.ys.length - 1] - c.y <= gap) {
      g.ys.push(c.y);
      g.texts.push(c.text);
      g.bold ||= c.bold;
    } else groups.push({ page: c.page, ys: [c.y], texts: [c.text], bold: c.bold });
  }
  return groups.map((g) => ({
    page: g.page,
    y: g.ys.reduce((a, b) => a + b, 0) / g.ys.length,
    text: g.texts.join(' ').replace(/\s+/g, ' ').trim(),
    bold: g.bold
  }));
}

/** Righe della tabella: ogni orario si accoppia alla cella di testo più vicina in altezza */
function buildRows(lines: Line[], textX: number): ParsedRow[] {
  const times: Cell[] = [];
  const texts: Cell[] = [];
  for (const line of lines) {
    const left = line.items.filter((i) => i.x < textX - 3);
    const right = line.items.filter((i) => i.x >= textX - 3);
    if (left.length) times.push({ page: line.page, y: line.y, text: joinItems(left), bold: left.some((i) => i.bold) });
    if (right.length) texts.push({ page: line.page, y: line.y, text: joinItems(right), bold: right.some((i) => i.bold) });
  }
  const cells = mergeCells(texts);
  const used = new Set<Cell>();
  const rows: ParsedRow[] = [];
  for (const time of mergeCells(times)) {
    const match = cells
      .filter((c) => !used.has(c) && c.page === time.page)
      .sort((a, b) => Math.abs(a.y - time.y) - Math.abs(b.y - time.y))[0];
    if (!match) continue;
    used.add(match);
    rows.push({ time: normTime(time.text), text: match.text, bold: match.bold });
  }
  return rows;
}

function normTime(t: string): string {
  return t.replace(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g, '$1 - $2').replace(/\s+/g, ' ').trim();
}

// ───────────────────────── Dal PDF ai giorni ─────────────────────────

export function parseItineraryPages(pages: PdfPage[]): { days: ParsedDay[]; warnings: string[] } {
  const layout = measureLayout(pages);
  const byDay = new Map<number, ParsedDay>();
  const day = (n: number) => {
    if (!byDay.has(n)) byDay.set(n, { n, cardBullets: [], sections: [] });
    return byDay.get(n)!;
  };
  let phase: ItineraryDay['phase'] | undefined;
  const warnings: string[] = [];

  for (const region of splitRegions(pages, layout)) {
    const { kind, item } = region.anchor;
    if (kind === 'week') phase = PHASES[item.str.trim().toLowerCase()];
    else if (kind === 'other') phase = undefined;
    else if (kind === 'card') {
      const card = parseCard(region);
      if (card.n < 1 || card.n > 31 || !card.title) {
        warnings.push(`Scheda del ${card.n} senza titolo: ignorata.`);
        continue;
      }
      Object.assign(day(card.n), { cardTitle: card.title, cardBullets: card.bullets, phase });
    } else if (kind === 'date') {
      const { n, section } = parseSection(region, layout);
      day(n).sections.push(section);
    }
  }
  return { days: [...byDay.values()].sort((a, b) => a.n - b.n), warnings };
}

// ───────────────────────── Riassunti ─────────────────────────

const WEEKDAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const dayOfWeek = (n: number) => WEEKDAYS[new Date(Date.UTC(2027, 2, n)).getUTCDay()];

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Frase breve: la prima proposizione senza costi tra parentesi, al massimo ~58 caratteri. */
export function shortSummary(text: string): string {
  let t = text
    .replace(/\((?:~|circa)?\s*[\d.,\-\s]+(?:€|eur|krw|cny)[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cut = t.search(/[.;](\s|$)|:\s/);
  if (cut > 14) t = t.slice(0, cut);
  if (t.length > 58) {
    const part = t.slice(0, 58);
    const at = Math.max(part.lastIndexOf(','), part.lastIndexOf(' e '), part.lastIndexOf(' '));
    t = (at > 24 ? part.slice(0, at) : part).trim();
  }
  t = t.replace(/[\s,;:(\-]+$/, '').replace(/\s+(e|di|a|in|per|con|da|il|la|le|i|un|una)$/i, '');
  return cap(t);
}

const STOP = new Set(['il', 'lo', 'la', 'le', 'gli', 'i', 'un', 'una', 'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra', 'e', 'o', 'ed', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'ai', 'alle', 'dal', 'dalla', 'nel', 'nella', 'che', 'si', 'non', 'circa']);
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9àèéìòù:]+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 1 && !STOP.has(w))
  );
const digits = (s: string) => (s.match(/\d+/g) ?? []).sort().join(',');

function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach((w) => B.has(w) && inter++);
  return inter / Math.min(A.size, B.size);
}

/** Stesso contenuto: parole quasi uguali e stessi numeri (orari, prezzi). */
const sameContent = (a: string, b: string) => similarity(a, b) >= 0.6 && digits(a) === digits(b);

const HIGHLIGHT = /^(atterraggio|decollo|ritrovo|partenza|check-in air china|check-out|imbarco)\b/i;

const LABELS = 'Mattina presto|Mattina|Pomeriggio e sera a [A-Za-zÀ-ú]+|Pomeriggio|Sera|Notte|Online|Dopo|Poi';

/** Un punto elenco della scheda può contenere più momenti ("Mattina libera. Pomeriggio: ..."): li separa. */
function splitCardBullet(bullet: string): string[] {
  return bullet.split(new RegExp(`(?<=[.!?])\\s+(?=(?:${LABELS})\\b)`, 'i')).map((x) => x.trim()).filter(Boolean);
}

function labelOf(bullet: string): { label: string; text: string } {
  const withColon = new RegExp(`^(${LABELS})(?:\\s+a\\s+[A-Za-zÀ-ú]+)?:\\s*(.+)$`, 'i').exec(bullet);
  if (withColon) return { label: cap(withColon[1].toLowerCase()), text: cap(withColon[2]) };
  const bare = /^(Mattina|Pomeriggio|Sera|Notte)\b/i.exec(bullet);
  if (bare) return { label: cap(bare[1].toLowerCase()), text: cap(bullet) };
  // Senza etichetta si guarda come comincia la frase: "Nel pomeriggio...", "Cena a...", "Poi..."
  if (/^nel pomeriggio\b/i.test(bullet)) return { label: 'Pomeriggio', text: bullet };
  if (/^(cena|serata|ultima sera|ultima uscita)\b/i.test(bullet)) return { label: 'Sera', text: bullet };
  if (/^(poi|dopo)\b/i.test(bullet)) return { label: 'Poi', text: bullet };
  return { label: 'Giorno', text: bullet };
}

function costOf(text: string): string | undefined {
  const m = /~\s*(\d+(?:\s*-\s*\d+)?)\s*€/.exec(text);
  return m ? `Circa ${m[1].replace(/\s*-\s*/, '-')} € a testa` : undefined;
}

function locationsIn(text: string, locations: MapLocation[]): string[] {
  const hay = text.toLowerCase();
  const out: string[] = [];
  for (const loc of locations) {
    if (loc.category === 'alloggio') continue;
    const names = [loc.name, loc.italianName]
      .map((n) => n.replace(/\(.*?\)/g, '').trim().toLowerCase())
      .filter((n) => n.length >= 5);
    if (names.some((n) => hay.includes(n))) out.push(loc.id);
  }
  return out;
}

function mergeSchedule(parsed: ScheduleItem[], base: ScheduleItem[] | undefined): { items: ScheduleItem[]; reused: number } {
  const pool = [...(base ?? [])];
  let reused = 0;
  const items = parsed.map((p) => {
    // Cerca la stessa voce nel programma già presente
    let hit = -1;
    let score = 0;
    pool.forEach((b, i) => {
      const s = similarity(p.activity, b.activity);
      if (s > score && sameContent(p.activity, b.activity)) {
        score = s;
        hit = i;
      }
    });
    if (hit === -1) return p;
    const b = pool.splice(hit, 1)[0];
    reused++;
    return { ...b, time: p.time };
  });
  return { items, reused };
}

/** Orari del giorno 19 (Seul → Pechino → Milano): il sito li legge con l'etichetta del fuso. */
function labelZones(n: number, section: ParsedSection, rows: ParsedRow[], prior: { lastHour: number }): ParsedRow[] {
  if (n !== 19) return rows;
  let firstCn = true;
  return rows
    .filter((r) => !/^20\s+mar/i.test(r.time))
    .map((r) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(r.time);
      if (!m || /\(/.test(r.time)) return r;
      const hour = Number(m[1]);
      let time = r.time;
      if (section.zone === 'KR') time += ' (Seul)';
      else if (section.zone === 'CN') {
        if (firstCn) time += ' (Pechino)';
        firstCn = false;
        if (hour < 6 && prior.lastHour >= 12) time += ' (20 Mar)';
      }
      prior.lastHour = hour;
      return { ...r, time };
    });
}

export function buildItineraryFromPdf(pages: PdfPage[], base: ItineraryDay[], locations: MapLocation[]): BuildResult {
  const { days: parsed, warnings } = parseItineraryPages(pages);
  const report: DayReport[] = [];
  const result: ItineraryDay[] = [];
  const found = new Set(parsed.map((d) => d.n));
  const programDays = parsed.filter((d) => d.cardTitle || d.sections.some((s) => s.rows.length > 0));

  if (programDays.length < 15) {
    warnings.push(`Nel PDF ho riconosciuto solo ${programDays.length} giorni su 20: il programma non è stato cambiato.`);
    return { days: base, report: [], warnings, ok: false };
  }

  for (const b of base) {
    const n = b.id + 1;
    const d = parsed.find((x) => x.n === n);
    const hasProgram = d && (d.cardTitle || d.sections.some((s) => s.rows.length));
    if (!d || !hasProgram) {
      result.push(b);
      report.push({ n, status: 'non trovato', detail: 'giorno assente nel PDF: lasciato com\'era' });
      continue;
    }

    // ── Programma del giorno ──
    const prior = { lastHour: 0 };
    const tableRows = d.sections.flatMap((s) => labelZones(n, s, s.rows, prior));
    let schedule: ScheduleItem[] = tableRows.map((r) => ({
      time: r.time,
      summary: shortSummary(r.text),
      activity: r.text,
      ...(r.bold && HIGHLIGHT.test(r.text) ? { isHighlight: true } : HIGHLIGHT.test(r.text) ? { isHighlight: true } : {})
    }));

    const lastClock = (() => {
      const hours = tableRows.map((r) => /^(\d{1,2}):/.exec(r.time)).filter(Boolean).map((m) => Number(m![1]));
      return hours.length ? Math.max(...hours.filter((h) => h >= 6)) : 0;
    })();
    const cardItems = d.cardBullets.flatMap(splitCardBullet).map((bl) => {
      const { label, text } = labelOf(bl);
      return { time: label, summary: shortSummary(text), activity: text } as ScheduleItem;
    });
    if (schedule.length === 0) {
      schedule = cardItems.map((c, i) => (i === cardItems.length - 1 || /^(sera|notte|dopo)/i.test(c.time) ? { ...c, isHighlight: true } : c));
    } else if (lastClock < 17) {
      // La tabella copre solo il mattino: serata e pomeriggio vengono dalla scheda
      const labels = new Set(schedule.map((s) => s.time.toLowerCase()));
      for (const c of cardItems) if (/^(pomeriggio|sera|notte|dopo|online)/i.test(c.time) && !labels.has(c.time.toLowerCase())) schedule.push({ ...c, isHighlight: /^sera/i.test(c.time) });
    }

    const merged = mergeSchedule(schedule, b.schedule);
    const unchanged = merged.reused === schedule.length && schedule.length === (b.schedule?.length ?? 0);

    // ── Campi del giorno ──
    const title = cap(d.cardTitle ?? d.sections[0].title);
    const text = [title, ...schedule.map((s) => s.activity), ...d.sections.flatMap((s) => s.intro)].join(' ');
    let out: ItineraryDay;
    if (unchanged && sameContent(title, b.title)) {
      out = { ...b, schedule: merged.items };
      report.push({ n, status: 'invariato' });
    } else {
      const intro = d.sections.flatMap((s) => s.intro).join(' ');
      const description = intro || d.cardBullets.map((x) => (/[.!?]$/.test(x) ? x : x + '.')).join(' ');
      const tips = [...d.sections.flatMap((s) => s.tail), ...d.sections.flatMap((s) => s.callouts.flatMap((c) => c.bullets)).slice(0, 6)];
      const found = locationsIn(text, locations);
      const similar = similarity(text, [b.title, ...(b.schedule ?? []).map((s) => s.activity)].join(' ')) >= 0.5;
      const locationIds = similar ? [...new Set([...b.locationIds, ...found])] : found.length ? found : b.locationIds;
      const highlights = merged.items.filter((s) => s.isHighlight).map((s) => s.summary ?? '');
      out = {
        id: b.id,
        dateStr: `${n} marzo 2027`,
        dayOfWeek: dayOfWeek(n),
        phase: n === 1 ? 'Partenza' : d.phase ?? b.phase,
        title,
        subtitle: similar && sameContent(title, b.title) ? b.subtitle : cap((d.cardBullets[0] ?? intro ?? title).replace(/\s*\(.*?\)/g, '')).slice(0, 90).replace(/[\s,;:]+$/, ''),
        description,
        schedule: merged.items,
        bulletPoints: (highlights.length ? highlights : merged.items.map((s) => s.summary ?? '')).filter(Boolean).slice(0, 5),
        costsEstimate: costOf(text) ?? (similar ? b.costsEstimate : undefined),
        locationIds,
        tags: similar ? b.tags : [title],
        tips: tips.length ? tips : similar ? b.tips : undefined,
        isSpecialEvent: b.isSpecialEvent || /^[A-ZÀ-Ú0-9 !]{8,}/.test(title)
      };
      report.push({ n, status: 'modificato', detail: `${schedule.length - merged.reused} voci nuove o cambiate su ${schedule.length}` });
    }
    result.push(out);
  }

  for (const d of parsed) if (!base.some((b) => b.id + 1 === d.n) && (d.cardTitle || d.sections.length)) warnings.push(`Il PDF contiene il giorno ${d.n} che il sito non ha: ignorato.`);
  void found;
  return { days: result, report, warnings, ok: true };
}
