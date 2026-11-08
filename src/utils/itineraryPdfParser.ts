/**
 * Legge il PDF dell'itinerario e ne ricava i giorni del programma (ItineraryDay).
 *
 * Il PDF ha una struttura fissa che si riconosce dalle posizioni del testo:
 *  - le "schede" dei giorni (numero grande, titolo in grassetto, elenco puntato);
 *  - le sezioni "N marzo: titolo" con un testo introduttivo, una tabella a due colonne (ora / cosa fare),
 *    riquadri con elenchi e paragrafi finali.
 * Il testo, con le posizioni, arriva da pdfTextExtract.ts. Qui non c'è nulla di legato al browser, così
 * lo stesso codice gira anche nel server (GitHub Actions) e nei test.
 *
 * Il risultato si unisce al programma già nel sito (buildItineraryFromPdf): quello che nel PDF non è cambiato
 * resta com'è (testi, riassunti, luoghi sulla mappa), quello che è cambiato viene riscritto dal PDF e riassunto.
 */
import type { ItineraryDay, MapLocation, ScheduleItem } from '../data/tripData';

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
  'ultima parte': 'Ultima parte'
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

interface Line {
  page: number;
  y: number;
  items: PdfItem[];
}

function toLines(items: { it: PdfItem; page: number }[], tol = 2.5): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.it.y - a.it.y || a.it.x - b.it.x);
  const lines: Line[] = [];
  for (const { it, page } of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === page && Math.abs(last.y - it.y) <= tol) last.items.push(it);
    else lines.push({ page, y: it.y, items: [it] });
  }
  return lines;
}

interface Anchor {
  kind: 'week' | 'card' | 'date' | 'other';
  page: number;
  top: number;
  item: PdfItem;
}
interface Region {
  anchor: Anchor;
  items: { it: PdfItem; page: number }[];
}

const DATE_HEADING = /^(\d{1,2})\s+marzo\s*:\s*(.*)$/i;

function findAnchor(it: PdfItem, page: number): Anchor | null {
  if (!it.bold) return null;
  if (it.x < 60 && DATE_HEADING.test(it.str.trim())) return { kind: 'date', page, top: it.y + 12, item: it };
  // Il titolo della scheda è accanto al numero e può stare più in alto della sua base: la soglia segue l'altezza del numero
  if (it.x >= 55 && it.x <= 95 && it.h >= 15 && /^\d{1,2}$/.test(it.str.trim())) return { kind: 'card', page, top: it.y + Math.max(9, it.h + 2), item: it };
  if (it.x < 60 && it.h >= 13) {
    const t = it.str.trim().toLowerCase();
    return { kind: PHASES[t] ? 'week' : 'other', page, top: it.y + 12, item: it };
  }
  return null;
}

function splitRegions(pages: PdfPage[]): Region[] {
  const regions: Region[] = [];
  pages.forEach((raw, p) => {
    // Intestazione e piè di pagina non servono
    const items = raw.filter((i) => i.str.trim() !== '' && i.y > 45 && i.y < 805);
    const anchors = items.map((i) => findAnchor(i, p)).filter((a): a is Anchor => a !== null).sort((a, b) => b.top - a.top);
    for (const it of items) {
      // Regione = l'ultima àncora con top >= y dell'elemento
      let owner = -1;
      anchors.forEach((a, idx) => {
        if (a.top >= it.y) owner = idx;
      });
      if (owner === -1) {
        // Prima della prima àncora della pagina: continua la regione della pagina precedente
        if (regions.length) regions[regions.length - 1].items.push({ it, page: p });
        continue;
      }
      let region = regions.find((r) => r.anchor === anchors[owner]);
      if (!region) {
        region = { anchor: anchors[owner], items: [] };
        regions.push(region);
      }
      region.items.push({ it, page: p });
    }
    // Àncore senza elementi (non dovrebbe succedere) non creano regioni
  });
  return regions;
}

// ───────────────────────── Schede dei giorni ─────────────────────────

function parseCard(region: Region): { n: number; title: string; bullets: string[] } {
  const n = Number(region.anchor.item.str.trim());
  const content = region.items.filter(({ it }) => it.x >= 110);
  const lines = toLines(content);
  const titleParts: string[] = [];
  const bullets: string[] = [];
  for (const line of lines) {
    const first = [...line.items].sort((a, b) => a.x - b.x)[0];
    // Il punto può essere un frammento a sé ("•") oppure stare nello stesso frammento della parola ("• Mattina:")
    if (/^•/.test(first.str.trim())) {
      const head = { ...first, str: first.str.trim().replace(/^•\s*/, '') };
      bullets.push(joinItems([head, ...line.items.filter((i) => i !== first)]));
    } else if (bullets.length > 0) {
      bullets[bullets.length - 1] += ' ' + joinItems(line.items);
    } else if (first.bold) {
      titleParts.push(joinItems(line.items));
    }
  }
  return { n, title: titleParts.join(' ').trim(), bullets: bullets.map((b) => b.replace(/\s+/g, ' ').trim()) };
}

// ───────────────────────── Sezioni "N marzo: ..." ─────────────────────────

const HEADER_FIRST = /^(ora|quando)\b/i;
const HEADER_SECOND = /^(cosa fare|linee guida)$/i;

function parseSection(region: Region): { n: number; section: ParsedSection } {
  const m = DATE_HEADING.exec(region.anchor.item.str.trim())!;
  const n = Number(m[1]);
  const headingText = m[2].trim();
  const section: ParsedSection = { title: headingText, zone: null, intro: [], rows: [], tail: [], callouts: [] };

  // Fuso: dal titolo ("(ora coreana)"), dall'etichetta a destra o dall'intestazione della tabella
  const zoneOf = (t: string): ParsedSection['zone'] => (/coreana|\(seul\)/i.test(t) ? 'KR' : /pechino|cines/i.test(t) ? 'CN' : null);
  section.zone = zoneOf(headingText);

  const lines = toLines(region.items.filter(({ it }) => it !== region.anchor.item));
  let x0 = 57;
  let x1 = 136;
  let state: 'intro' | 'table' | 'ignored' = 'intro';
  const tableLines: Line[] = [];
  let lastPara: { page: number; y: number } | null = null;
  let calloutOpen: { title: string; bullets: string[] } | null = null;

  const pushPara = (line: Line, target: string[]) => {
    const text = joinItems(line.items);
    if (lastPara && lastPara.page === line.page && lastPara.y - line.y <= 16 && target.length) target[target.length - 1] += ' ' + text;
    else target.push(text);
    lastPara = { page: line.page, y: line.y };
  };

  for (const line of lines) {
    const items = [...line.items].sort((a, b) => a.x - b.x);
    const text = joinItems(items);

    // Etichetta a destra del titolo ("martedì, ora locale", "ora coreana")
    if (items.every((i) => i.x > 380) && line.y > region.anchor.top - 14 && section.rows.length === 0 && tableLines.length === 0) {
      section.zone = section.zone ?? zoneOf(text);
      continue;
    }

    // Intestazione della tabella oraria
    const bolds = items.filter((i) => i.bold);
    if (bolds.length >= 2 && HEADER_FIRST.test(bolds[0].str.trim()) && HEADER_SECOND.test(bolds[1].str.trim())) {
      x0 = bolds[0].x;
      x1 = bolds[1].x;
      state = 'table';
      calloutOpen = null;
      lastPara = null;
      section.zone = section.zone ?? zoneOf(bolds[0].str);
      continue;
    }
    // Altre tabelle (es. costi): non fanno parte del programma
    if (bolds.length >= 2 && bolds[0].x < 70 && !HEADER_FIRST.test(bolds[0].str.trim()) && items.length === bolds.length && bolds[bolds.length - 1].x > 300) {
      state = 'ignored';
      continue;
    }

    const minX = items[0].x;
    const mid = items[0].x > x0 + 3 && items[0].x < x1 - 5;
    if (mid) {
      // Riquadro con titolo ed elenco
      state = state === 'ignored' ? 'ignored' : state;
      const bullet = items.find((i) => i.str.trim() === '•');
      if (bullet) {
        if (!calloutOpen) {
          calloutOpen = { title: '', bullets: [] };
          section.callouts.push(calloutOpen);
        }
        calloutOpen.bullets.push(joinItems(items.filter((i) => i !== bullet)));
      } else if (items[0].bold && items[0].x < x0 + 45) {
        calloutOpen = { title: text, bullets: [] };
        section.callouts.push(calloutOpen);
      } else if (calloutOpen && calloutOpen.bullets.length) {
        calloutOpen.bullets[calloutOpen.bullets.length - 1] += ' ' + text;
      }
      if (state === 'ignored') state = 'ignored';
      lastPara = null;
      continue;
    }
    calloutOpen = null;

    if (minX < x0 - 3) {
      // Paragrafo fuori dalla tabella
      if (state === 'ignored') state = 'table';
      pushPara(line, state === 'intro' ? section.intro : section.tail);
      if (state === 'table') state = 'intro' === (state as string) ? 'intro' : 'table';
      // Dopo un paragrafo la tabella è finita
      if (state === 'table') state = 'ignored';
      continue;
    }
    if (state === 'table') tableLines.push(line);
  }

  section.rows = buildRows(tableLines, x1);
  return { n, section };
}

function cluster(lines: { page: number; y: number; text: string; bold: boolean }[], gap = 16) {
  const groups: { page: number; ys: number[]; texts: string[]; bold: boolean }[] = [];
  for (const l of lines) {
    const g = groups[groups.length - 1];
    if (g && g.page === l.page && g.ys[g.ys.length - 1] - l.y <= gap) {
      g.ys.push(l.y);
      g.texts.push(l.text);
      g.bold = g.bold || l.bold;
    } else groups.push({ page: l.page, ys: [l.y], texts: [l.text], bold: l.bold });
  }
  return groups.map((g) => ({ page: g.page, y: g.ys.reduce((a, b) => a + b, 0) / g.ys.length, text: g.texts.join(' ').replace(/\s+/g, ' ').trim(), bold: g.bold }));
}

function buildRows(lines: Line[], x1: number): ParsedRow[] {
  const c1: { page: number; y: number; text: string; bold: boolean }[] = [];
  const c2: { page: number; y: number; text: string; bold: boolean }[] = [];
  for (const line of lines) {
    const left = line.items.filter((i) => i.x < x1 - 3);
    const right = line.items.filter((i) => i.x >= x1 - 3);
    if (left.length) c1.push({ page: line.page, y: line.y, text: joinItems(left), bold: left.some((i) => i.bold) });
    if (right.length) c2.push({ page: line.page, y: line.y, text: joinItems(right), bold: right.some((i) => i.bold) });
  }
  const times = cluster(c1);
  const texts = cluster(c2);
  const rows: ParsedRow[] = [];
  const used = new Set<number>();
  for (const t of times) {
    let best = -1;
    let bestDist = Infinity;
    texts.forEach((x, idx) => {
      if (used.has(idx) || x.page !== t.page) return;
      const d = Math.abs(x.y - t.y);
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    });
    if (best === -1) continue;
    used.add(best);
    rows.push({ time: normTime(t.text), text: texts[best].text, bold: texts[best].bold });
  }
  return rows;
}

function normTime(t: string): string {
  return t.replace(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g, '$1 - $2').replace(/\s+/g, ' ').trim();
}

// ───────────────────────── Dal PDF ai giorni ─────────────────────────

export function parseItineraryPages(pages: PdfPage[]): { days: ParsedDay[]; warnings: string[] } {
  const regions = splitRegions(pages);
  const byDay = new Map<number, ParsedDay>();
  const day = (n: number) => {
    let d = byDay.get(n);
    if (!d) {
      d = { n, cardBullets: [], sections: [] };
      byDay.set(n, d);
    }
    return d;
  };
  let phase: ItineraryDay['phase'] | undefined;
  const warnings: string[] = [];

  for (const region of regions) {
    switch (region.anchor.kind) {
      case 'week':
        phase = PHASES[region.anchor.item.str.trim().toLowerCase()];
        break;
      case 'card': {
        const c = parseCard(region);
        if (c.n < 1 || c.n > 31 || !c.title) {
          warnings.push(`Scheda del ${c.n} senza titolo: ignorata.`);
          break;
        }
        const d = day(c.n);
        d.cardTitle = c.title;
        d.cardBullets = c.bullets;
        d.phase = phase;
        break;
      }
      case 'date': {
        const { n, section } = parseSection(region);
        day(n).sections.push(section);
        break;
      }
      default:
        break;
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
