import { joinItems, type PdfItem, type PdfPage } from './itineraryPdfParser';

/** Una parte del PDF per l'indice: titolo e inizio del testo di una pagina. */
export interface PageTopic {
  page: number;
  title: string;
  summary: string;
}

interface TextLine {
  y: number;
  items: PdfItem[];
}

const SUMMARY_MAX = 210;

function toTextLines(items: PdfItem[], tol = 2.5): TextLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextLine[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= tol) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines;
}

const firstOf = (l: TextLine) => [...l.items].sort((a, b) => a.x - b.x)[0];
const isDigits = (s: string) => /^\d{1,2}$/.test(s.trim());

function cut(text: string): string {
  if (text.length <= SUMMARY_MAX) return text;
  const head = text.slice(0, SUMMARY_MAX);
  return head.slice(0, Math.max(head.lastIndexOf(' '), 40)).replace(/[\s,;:.]+$/, '') + '…';
}

/**
 * Ricava un indice da un PDF qualunque: il titolo di ogni pagina è la prima riga in grassetto di dimensione
 * da titolo (esclusi copertina, numeri dei giorni e intestazioni di tabella); il riassunto è l'inizio del
 * testo normale che la segue. Funziona anche con un PDF diverso da quello originale.
 */
export function derivePageTopics(pages: PdfPage[]): PageTopic[] {
  return pages.map((raw, p) => {
    const items = raw.filter((i) => i.str.trim() !== '' && i.y > 45 && i.y < 805);
    const lines = toTextLines(items);

    // Il titolo della pagina è la riga in grassetto più grande (a parità, la prima), esclusa la copertina
    let headingIdx = -1;
    lines.forEach((l, i) => {
      const f = firstOf(l);
      const text = joinItems(l.items.filter((x) => x.bold));
      const ok = f.bold && f.h >= 11 && f.h <= 30 && !isDigits(f.str) && !f.str.trim().startsWith('•') && text.length >= 4;
      if (ok && (headingIdx === -1 || f.h > firstOf(lines[headingIdx]).h + 1)) headingIdx = i;
    });

    if (headingIdx === -1) return { page: p + 1, title: `Pagina ${p + 1}`, summary: '' };

    const headingLine = lines[headingIdx];
    let title = joinItems(headingLine.items.filter((x) => x.bold));
    // Titolo di una scheda di giorno: il numero grande sta a sinistra, poco più in basso
    if (firstOf(headingLine).x >= 110) {
      const num = items.find((i) => i.bold && isDigits(i.str) && i.h >= 15 && i.x >= 55 && i.x <= 95 && Math.abs(i.y - headingLine.y) <= 40);
      if (num) title = `${Number(num.str.trim())} marzo: ${title}`;
    }

    const parts: string[] = [];
    for (const l of lines.slice(headingIdx + 1)) {
      // Fuori le etichette piccole (giorno della settimana, "MARZO") e quelle nel margine destro
      const sorted = l.items.filter((x) => x.h >= 7.5 && x.x < 480).sort((a, b) => a.x - b.x);
      if (!sorted.length) continue;
      const body = sorted[0].str.trim() === '•' ? sorted.slice(1) : sorted;
      if (!body.length || body[0].bold || body[0].h > 11.5) continue;
      parts.push(joinItems(body).replace(/^•\s*/, ''));
      if (parts.join(' ').length >= SUMMARY_MAX) break;
    }
    return { page: p + 1, title, summary: cut(parts.join(' ').replace(/\s+/g, ' ').trim()) };
  });
}
