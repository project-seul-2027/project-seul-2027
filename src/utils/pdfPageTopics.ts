import { joinItems, type PdfItem, type PdfPage } from './itineraryPdfParser';
import { isContent, isHeading, measureLayout, type PdfLayout } from './pdfLayout';

/** Una parte del PDF per l'indice: titolo e inizio del testo di una pagina. */
export interface PageTopic {
  page: number;
  title: string;
  summary: string;
}

interface TextLine {
  y: number;
  /** Frammenti da sinistra a destra */
  items: PdfItem[];
}

const SUMMARY_MAX = 210;

function toTextLines(items: PdfItem[], tolerance = 2.5): TextLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextLine[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= tolerance) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

const isDayNumber = (s: string) => /^\d{1,2}$/.test(s.trim());
const isTableHeader = (s: string) => /^(ora|quando)\b.*\bcosa fare\b/i.test(s);

function cut(text: string): string {
  if (text.length <= SUMMARY_MAX) return text;
  const head = text.slice(0, SUMMARY_MAX);
  return head.slice(0, Math.max(head.lastIndexOf(' '), 40)).replace(/[\s,;:.]+$/, '') + '…';
}

/** La riga che fa da titolo alla pagina: il titolo più grande (a parità, il primo), esclusa la scritta della copertina. */
function headingLine(lines: TextLine[], layout: PdfLayout): TextLine | null {
  let best: TextLine | null = null;
  for (const line of lines) {
    const [first] = line.items;
    const usable =
      isHeading(first, layout) &&
      // Le intestazioni di tabella in grassetto hanno la dimensione del testo: non sono titoli
      first.h >= layout.body * 1.1 &&
      first.h <= layout.body * 3.2 &&
      !isDayNumber(first.str) &&
      !first.str.trim().startsWith('•') &&
      joinItems(line.items).length >= 4;
    if (usable && (!best || first.h > best.items[0].h + 1)) best = line;
  }
  return best;
}

/**
 * Indice di un PDF qualunque: per ogni pagina il titolo più grande e l'inizio del testo normale che lo segue.
 * Le misure (testo normale, margine) si ricavano dal documento, quindi funziona anche con un PDF impaginato diversamente.
 */
export function derivePageTopics(pages: PdfPage[]): PageTopic[] {
  const layout = measureLayout(pages);
  return pages.map((raw, p) => {
    const items = raw.filter(isContent);
    const lines = toTextLines(items);
    const heading = headingLine(lines, layout);
    if (!heading) return { page: p + 1, title: `Pagina ${p + 1}`, summary: '' };

    // Le etichette a destra del titolo ("martedì, ora locale") non fanno parte del titolo
    const [first] = heading.items;
    let title = joinItems(heading.items.filter((i) => i.h >= first.h - 1));
    // Titolo di una scheda di giorno: il numero grande sta a sinistra, poco più in basso
    if (first.x >= layout.left + 50) {
      const num = items.find((i) => isDayNumber(i.str) && i.h >= layout.body * 1.5 && i.x < layout.left + 45 && Math.abs(i.y - heading.y) <= 40);
      if (num) title = `${Number(num.str.trim())} marzo: ${title}`;
    }

    const parts: string[] = [];
    for (const line of lines.slice(lines.indexOf(heading) + 1)) {
      // Fuori le etichette piccole (giorno della settimana, "MARZO") e il margine destro
      const visible = line.items.filter((i) => i.h >= layout.body * 0.8 && i.x < 480);
      const body = visible[0]?.str.trim() === '•' ? visible.slice(1) : visible;
      if (!body.length || isHeading(body[0], layout)) continue;
      const text = joinItems(body).replace(/^•\s*/, '');
      if (isTableHeader(text)) continue;
      parts.push(text);
      if (parts.join(' ').length >= SUMMARY_MAX) break;
    }
    return { page: p + 1, title, summary: cut(parts.join(' ').replace(/\s+/g, ' ').trim()) };
  });
}
