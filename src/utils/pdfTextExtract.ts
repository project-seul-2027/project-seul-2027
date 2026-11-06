import type { PdfPage } from './itineraryPdfParser';

/** Minimo che serve di pdfjs: funziona sia con la build del browser sia con quella per node. */
interface PdfjsLike {
  getDocument(src: { data: Uint8Array }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<any> }> };
}

/** Testo del PDF con posizione, dimensione e grassetto di ogni frammento (una lista per pagina). */
export async function extractPdfPages(pdfjs: PdfjsLike, data: Uint8Array): Promise<PdfPage[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PdfPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // Serve per leggere il nome vero dei caratteri (Helvetica-Bold = grassetto)
    try {
      await page.getOperatorList();
    } catch {
      /* senza, il grassetto si ricava dallo stile */
    }
    const boldCache = new Map<string, boolean>();
    const isBold = (fontName: string): boolean => {
      let v = boldCache.get(fontName);
      if (v === undefined) {
        let name = '';
        try {
          name = String(page.commonObjs.get(fontName)?.name ?? '');
        } catch {
          name = String(content.styles?.[fontName]?.fontFamily ?? '');
        }
        v = /bold|black|heavy|semibold/i.test(name);
        boldCache.set(fontName, v);
      }
      return v;
    };
    pages.push(
      content.items
        .filter((i: any) => typeof i.str === 'string' && i.str.trim() !== '')
        .map((i: any) => ({ x: i.transform[4], y: i.transform[5], w: i.width, h: i.height, bold: isBold(i.fontName), str: i.str }))
    );
  }
  return pages;
}
