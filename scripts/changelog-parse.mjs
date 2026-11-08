/**
 * Lettura del messaggio di un commit per la pagina Novità.
 *
 * Forma attesa del messaggio (come in COMMIT_MSG.txt):
 *   Titolo del commit
 *   <riga vuota>
 *   Paragrafo introduttivo, anche su più righe (diventa un testo).
 *   <riga vuota>
 *   Titolo di sezione             ← una sola riga, seguita da punti elenco
 *   - Voce
 *     continua alla riga dopo     ← le righe indentate chiudono la voce
 *   - Altra voce
 *   <riga vuota>
 *   Co-Authored-By: ...           ← i trailer vengono esclusi
 *
 * Un messaggio senza punti elenco (commit vecchi) diventa un unico elenco con una voce per riga.
 */

export const TRAILER = /^((co-authored-by|claude-session|signed-off-by|generated with)\b|release:)/i;
const BULLET = /^[-*•]\s+(.*)$/;

export const clean = (s) => String(s ?? '').replace(/^﻿/, '').replace(/\s+/g, ' ').trim();

/**
 * @returns {{ title: string, items: string[], content: Array<
 *   { kind: 'text', text: string } | { kind: 'list', heading: string | null, items: string[] }> }}
 */
export function parseMessage(subject, body = '') {
  let title = clean(subject);
  const subjectItems = [];
  const parts = title.split(/\s+-\s+/);
  if (parts.length >= 3 || /:\s+-\s+/.test(title)) {
    title = clean(parts[0]).replace(/:$/, '');
    for (const p of parts.slice(1)) if (clean(p)) subjectItems.push(clean(p));
  }

  const lines = String(body).replace(/^﻿/, '').split('\n').map((l) => l.trimEnd()).filter((l) => !TRAILER.test(l.trim()));
  const hasBullets = lines.some((l) => BULLET.test(l.trim()));

  // Messaggi senza punti elenco (commit vecchi): ogni riga diventa una voce, come prima
  // Testo a capo automatico: una riga che inizia con la minuscola continua la voce precedente,
  // una riga vuota separa due voci.
  if (!hasBullets) {
    const items = [...subjectItems];
    let afterBlank = true;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        afterBlank = true;
        continue;
      }
      if (!afterBlank && items.length && /^[a-zà-öø-ÿ(]/.test(line)) items[items.length - 1] += ' ' + clean(line);
      else items.push(clean(line));
      afterBlank = false;
    }
    return { title, items, content: items.length ? [{ kind: 'list', heading: null, items }] : [] };
  }

  // 1) Blocchi separati da righe vuote: testo oppure punti elenco
  const blocks = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      cur = null;
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      if (!cur || cur.type !== 'list') {
        cur = { type: 'list', items: [] };
        blocks.push(cur);
      }
      cur.items.push(clean(bullet[1]));
    } else if (cur && cur.type === 'list') {
      // riga che continua la voce precedente
      cur.items[cur.items.length - 1] += ' ' + clean(line);
    } else {
      if (!cur) {
        cur = { type: 'text', lines: [] };
        blocks.push(cur);
      }
      cur.lines.push(clean(line));
    }
  }

  // 2) Un testo di una sola riga seguito da punti elenco è il titolo della sezione
  const content = [];
  if (subjectItems.length) content.push({ kind: 'list', heading: null, items: subjectItems });
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.type === 'text') {
      if (next && next.type === 'list' && b.lines.length === 1) {
        content.push({ kind: 'list', heading: b.lines[0], items: next.items });
        i++;
      } else {
        content.push({ kind: 'text', text: b.lines.join(' ') });
      }
    } else {
      content.push({ kind: 'list', heading: null, items: b.items });
    }
  }

  const items = content.flatMap((c) => (c.kind === 'list' ? c.items : []));
  return { title, items, content };
}
