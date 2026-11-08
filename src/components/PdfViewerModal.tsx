import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Download, Maximize2, X, BookOpen, Upload, ChevronDown } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { itineraryPdfService, type OverrideReport } from '../services/itineraryPdfService';
import { useItineraryPdf } from './useItineraryPdf';
import { PdfPageViewer } from './PdfPageViewer';
import { PdfPushSetup } from './PdfPushSetup';
import { pdfPushTrigger } from '../services/pdfPushTrigger';
import { derivePageTopics, type PageTopic } from '../utils/pdfPageTopics';
import { extractPdfPagesFromDoc } from '../utils/pdfTextExtract';
import { useMediaQuery } from '../pwa';

export const PdfViewerModal: React.FC = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [selectedPageTopic, setSelectedPageTopic] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);
  // Pagina in vista nel visualizzatore (segue lo scorrimento) e contatore per tornare alla stessa pagina scelta
  const [activePage, setActivePage] = useState(1);
  const [jump, setJump] = useState(0);
  const listRef = useRef<HTMLOListElement>(null);
  // Parti ricavate dal PDF caricato (il PDF originale ha le sue descrizioni scritte a mano)
  const [derived, setDerived] = useState<{ url: string; topics: PageTopic[] } | null>(null);
  const { user } = useAuth();
  const { url: pdfUrl, custom, meta } = useItineraryPdf();
  const canUpload = user?.travelerId === 't1';
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [lastRead, setLastRead] = useState<OverrideReport | null>(null);
  useEffect(() => {
    try {
      return itineraryPdfService.watchReport(setLastRead);
    } catch {
      return undefined;
    }
  }, []);
  const changedDays = lastRead?.report.filter((r) => r.status !== 'invariato' && r.status !== 'non trovato') ?? [];

  const onReset = async () => {
    setUploading(true);
    setUploadMsg(null);
    try {
      await itineraryPdfService.resetItinerary();
      setUploadMsg({ ok: true, text: 'Programma ripristinato a quello originale del sito.' });
    } catch {
      setUploadMsg({ ok: false, text: 'Ripristino non riuscito: riprova.' });
    } finally {
      setUploading(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await itineraryPdfService.upload(file);
      const changed = res.report.filter((r) => r.status !== 'invariato' && r.status !== 'non trovato').length;
      // Fa partire subito il controllo che avvisa i telefoni (se l'avviso immediato è attivo su questo dispositivo)
      const push = await pdfPushTrigger.fire();
      setUploadMsg({
        ok: true,
        text: `${res.analysed
          ? `PDF aggiornato e programma riletto: ${changed === 0 ? 'nessun giorno è cambiato' : `${changed} giorni cambiati`}. Lo vede subito tutto il gruppo.`
          : `PDF aggiornato, ma il programma non è stato cambiato: ${res.warnings[0] ?? 'struttura non riconosciuta'}. Resta quello di prima.`} ${push.message}`
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      setUploadMsg({
        ok: false,
        text: code === 'permission-denied'
          ? 'Operazione non consentita: servono le regole Firestore aggiornate (appFiles) e il Posto 1.'
          : err instanceof Error ? err.message : 'Caricamento non riuscito.'
      });
    } finally {
      setUploading(false);
    }
  };

  // Cosa racconta ciascuna pagina del PDF incluso nel sito (13 pagine). Con un PDF caricato dal Posto 1 l'indice non si mostra.
  const pageTopics = [
    { page: 1, title: 'Pag. 1: Calendario, voli e ritrovo a Malpensa', summary: 'Il riquadro Valorant Masters (torneo dal 20 febbraio al 3 marzo, finale e sede ancora da annunciare), il calendario dei giorni e i voli Air China: andata il 1 marzo alle 12:30, ritorno il 19 marzo da Incheon alle 13:10, chi riparte prima il 10 marzo alle 11:10. Il ritrovo del 1 marzo al T1 di Malpensa entro le 10:00, con orari dei treni, check-in e regole d\'oro.' },
    { page: 2, title: 'Pag. 2: 2 marzo, scalo a Pechino e arrivo a Seul', summary: 'Atterraggio a Pechino alle 05:35 e coincidenza per Incheon alle 08:40 (3 ore e 5 minuti di scalo, solo "International Transfer"). Tabella ora per ora fino all\'arrivo a Seul alle 11:40, AREX in città, check-in alle 16:00 o deposito bagagli e il margine se il primo volo ritarda.' },
    { page: 3, title: 'Pag. 3: Dove dormire, 4 alloggi a confronto', summary: 'Enko Stay, 2-19 marzo: Myeongdong, Seoul Station, Mapo e Sinseol-dong a confronto per prezzo, tipo di casa, metro, bus e distanza da Hongdae. Il riquadro "Come dividere l\'affitto": chi parte il 10 paga 8 notti, gli altri tre 17 notti, con l\'esempio su Mapo.' },
    { page: 4, title: 'Pag. 4: Cancellazione, note e quale scegliere', summary: 'Regole di rimborso e pagamento Enko, pro e contro di A, B, C e D e la guida "Quale scegliere": C per movida, A per spendere meno, D per dormire meglio, B solo se conta la stazione.' },
    { page: 5, title: 'Pag. 5: Come sono organizzate le serate', summary: 'Otto tipi di serata (strade di Hongdae, noraebang, sale giochi, pocha, live house, language exchange, serate di ballo, club) con ambiente, costo ed età. Il limite dei 19 anni, il passaporto sempre con sé e come gestire il gruppo quando una parte entra in un club.' },
    { page: 6, title: 'Pag. 6: Budget serate e prima settimana (2 - 6 marzo)', summary: 'Budget delle serate per tutto il soggiorno (equilibrato 220-300 €, consigliato) e i primi giorni in quattro: arrivo, Valorant Masters il 3, palazzi e Gangnam, Seongsu e Hongdae del venerdì, mercati e serata leggera.' },
    { page: 7, title: 'Pag. 7: Tour DMZ, saluti e partenza di una persona (7 - 10 marzo)', summary: 'Il tour DMZ del 7 con Itaewon la sera e la tabella oraria (sveglia alle 5:15, ritrovo alle 6:45 a Myeongdong). L\'8 Namsan e language exchange, il 9 museo e ultima serata in quattro, il 10 una persona riparte e gli altri vanno a Incheon.' },
    { page: 8, title: 'Pag. 8: 11 - 15 marzo', summary: 'COEX e Sinchon, la gita a Suwon, il sabato grande a Hongdae, il White Day sul fiume Han e la giornata libera con language exchange.' },
    { page: 9, title: 'Pag. 9: Ultima parte (16 - 19 marzo)', summary: 'Bukhansan e pocha a Yeonnam, souvenir e ultima serata grande, ultimo giorno pieno (valigie da 23 kg, modulo d\'ingresso per la Cina, prenotazione di Tiananmen) e la partenza del 19.' },
    { page: 10, title: 'Pag. 10: 19 marzo, mattina a Seul e Pechino', summary: 'Tabella ora per ora della mattina a Seul, dalla sveglia alle 6:30 al decollo delle 13:10. Poi l\'idea della serata a Pechino con il transito 240h e il riquadro "Prima di partire": passaporto, Arrival Card, internet bloccato, pagamenti, power bank 3C e freddo.' },
    { page: 11, title: 'Pag. 11: Bagagli, Arrival Card e arrivo a Pechino', summary: 'Come gestire le valigie, la guida all\'Arrival Card cinese (quando compilarla, dati richiesti, piano B) e i passaggi all\'arrivo a PEK: banco transito 240h, controllo passaporti, dogana e uscita.' },
    { page: 12, title: 'Pag. 12: Serata a Pechino, costi e rischi', summary: 'Tabella oraria di Pechino fino alla partenza tassativa alle 21:15, costi dello scalo (190-310 CNY, 25-40 € a persona) e rischi: code, transito non concesso, Tiananmen su prenotazione.' },
    { page: 13, title: 'Pag. 13: 20 marzo, da Malpensa a Milano Centrale e costi', summary: 'Il rientro: atterraggio alle 06:30, passaporti, bagagli, Malpensa Express verso le 9:00-9:30 e treni di casa non prima delle 11:30, con margini in caso di ritardo. In chiusura "Costi e cose da verificare".' }
  ];

  // Parti da mostrare: quelle scritte a mano per il PDF originale, oppure quelle lette dal PDF caricato
  const topics: PageTopic[] = custom
    ? (derived?.url === pdfUrl ? derived.topics.map((t) => ({ ...t, title: `Pag. ${t.page}: ${t.title}` })) : [])
    : pageTopics;

  const onDocument = useCallback(
    (doc: Parameters<typeof extractPdfPagesFromDoc>[0]) => {
      if (!custom) return;
      extractPdfPagesFromDoc(doc)
        .then((pages) => setDerived({ url: pdfUrl, topics: derivePageTopics(pages) }))
        .catch(() => setDerived({ url: pdfUrl, topics: [] }));
    },
    [custom, pdfUrl]
  );

  // L'indice a sinistra segue la pagina in vista (a mano, così la pagina intera non salta)
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!list || !row) return;
    const top = row.offsetTop - list.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top - 8;
    else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + row.offsetHeight - list.clientHeight + 8;
  }, [activePage]);

  // Chiudi il pannello a schermo intero con Esc
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // Indice delle pagine su telefono: lista compatta sotto il visualizzatore
  const topicsBlock = topics.length > 0 ? (
      <ul className="rounded-2xl bg-[#0a1119] border-t border-[rgba(234,240,246,.11)] divide-y divide-[rgba(234,240,246,.11)]" data-testid="pdf-topics">
        {topics.map((pt) => {
          const open = selectedPageTopic === pt.page;
          return (
            <li key={pt.page} className="py-1">
              <button
                type="button"
                onClick={() => setSelectedPageTopic(pt.page)}
                aria-expanded={open}
                className={`w-full min-h-[48px] flex items-center justify-between gap-3 text-left text-[15px] font-medium ${open ? 'text-[#52d9e6]' : 'text-[#eaf0f6]'}`}
              >
                <span>{pt.title}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 text-[#97a5b9] transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && pt.summary && <p className="pb-3 text-[14px] leading-relaxed text-[#97a5b9]">{pt.summary}</p>}
            </li>
          );
        })}
      </ul>
  ) : null;

  // Riepilogo per il telefono: le cose che servono subito, senza scorrere
  const quickFacts = !custom ? (
    <section className="border-t border-[rgba(234,240,246,.11)] pt-4" data-testid="pdf-facts">
      <h3 className="font-[Outfit] text-[19px] font-medium text-[#eaf0f6] mb-2">Da sapere subito</h3>
      <dl className="divide-y divide-[rgba(234,240,246,.11)]">
        {[
          ['Ritrovo', '1 marzo, Malpensa T1 entro le 10:00'],
          ['Andata', '1 marzo alle 12:30, Malpensa → Pechino'],
          ['Scalo', 'Pechino, 3 h 05 senza uscire (arrivo alle 05:35 del 2 marzo)'],
          ['Seul', 'Arrivo a Incheon alle 11:40 del 2 marzo'],
          ['Rientro', '19 marzo alle 13:10 da Incheon'],
          ['Milano', 'Atterraggio il 20 marzo alle 06:30']
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[84px_1fr] gap-3 py-2.5">
            <dt className="text-[13px] text-[#97a5b9]">{k}</dt>
            <dd className="text-[15px] text-[#eaf0f6] leading-snug">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  ) : null;

  const fullscreenLayer = fullscreen && createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Itinerario Seul 2027 a schermo intero"
      className="fixed inset-0 z-[200] bg-slate-950 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <span className="text-sm font-bold text-white font-display truncate">Itinerario Seul 2027</span>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={pdfUrl}
            download="Itinerario_Seul_2027_Aggiornato.pdf"
            aria-label="Scarica PDF"
            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label="Chiudi"
            className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      <PdfPageViewer url={pdfUrl} targetPage={selectedPageTopic} className="flex-1 min-h-0" />
    </div>
    ,
    document.body
  );

  const topicTitle = (t: string) => t.replace(/^Pag\. \d+:\s*/, '');

  // Desktop: schermo diviso a metà, a sinistra le parti del PDF, a destra la pagina scelta
  if (isDesktop) {
    return (
      <div className="pdf-split" data-testid="pdf-split">
        <section className="pdf-index" aria-label="Parti del PDF">
          <header className="pdf-head">
            <h2>Itinerario Seul 2027</h2>
            <p>
              {custom
                ? `PDF caricato dal Posto 1 il ${new Date(meta!.updatedAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}: ${meta!.name}.`
                : '13 pagine: voli e ritrovo, alloggi, serate, programma giorno per giorno, scalo a Pechino e rientro.'}
            </p>
            <div className="pdf-acts">
              {canUpload && (
                <>
                  <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickFile} />
                  <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="pdf-btn">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Caricamento…' : 'Aggiorna PDF'}
                  </button>
                </>
              )}
              <a href={pdfUrl} download="Itinerario_Seul_2027_Aggiornato.pdf" className="pdf-btn">
                <Download className="w-4 h-4" />
                Scarica PDF
              </a>
            </div>
            {canUpload && (
              <div className="mt-3">
                <PdfPushSetup />
              </div>
            )}
            {uploadMsg && (
              <p role="status" className={`pdf-note ${uploadMsg.ok ? '' : 'bad'}`}>
                {uploadMsg.text}
              </p>
            )}
            {lastRead && (changedDays.length > 0 || lastRead.warnings.length > 0) && (
              <div className="pdf-note">
                {changedDays.length > 0 && (
                  <p>Programma letto dal PDF. Giorni cambiati: {changedDays.map((r) => `${r.n} marzo`).join(', ')}.</p>
                )}
                {lastRead.warnings.map((w, i) => (
                  <p key={`${i}-${w}`}>{w}</p>
                ))}
                {canUpload && changedDays.length > 0 && (
                  <button type="button" disabled={uploading} onClick={onReset} className="pdf-link">
                    Ripristina il programma originale
                  </button>
                )}
              </div>
            )}
          </header>

          {custom && topics.length === 0 && <p className="pdf-note">Leggo le parti del PDF…</p>}
          {topics.length > 0 && (
            <ol className="pdf-list" ref={listRef} data-testid="pdf-topics">
              {topics.map((pt) => {
                const on = activePage === pt.page;
                return (
                  <li key={pt.page}>
                    <button
                      type="button"
                      className="pdf-row"
                      aria-current={on ? 'page' : undefined}
                      onClick={() => {
                        setSelectedPageTopic(pt.page);
                        setActivePage(pt.page);
                        setJump((j) => j + 1);
                      }}
                    >
                      <span className="pdf-num">{pt.page}</span>
                      <span className="pdf-txt">
                        <span className="pdf-ttl">{topicTitle(pt.title)}</span>
                        {on && pt.summary && <span className="pdf-sum">{pt.summary}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="pdf-viewer" aria-label="Visualizzatore PDF">
          <PdfPageViewer
            variant="desk"
            url={pdfUrl}
            targetPage={selectedPageTopic}
            targetKey={jump}
            onPageChange={setActivePage}
            onDocument={onDocument}
            className="flex-1 min-h-0"
            actions={
              <button type="button" onClick={() => setFullscreen(true)} aria-label="Schermo intero" title="Schermo intero" className="pdfv-btn">
                <Maximize2 className="w-5 h-5" />
              </button>
            }
          />
        </section>
        {fullscreenLayer}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display">
              Documento Ufficiale Aggiornato: Itinerario Seul 2027
            </h3>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canUpload && (
            <>
              <input ref={fileInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onPickFile} />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
                className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[var(--ms-fill)] hover:bg-[var(--ms-fill)] border-0 text-[#52d9e6] text-[14px] font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? 'Caricamento…' : 'Aggiorna PDF'}</span>
              </button>
            </>
          )}
          <a
            href={pdfUrl}
            download="Itinerario_Seul_2027_Aggiornato.pdf"
            className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[var(--ms-fill)] hover:bg-[var(--ms-fill)] text-[#eaf0f6] text-[14px] font-semibold flex items-center gap-2 transition-colors border-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Scarica PDF</span>
          </a>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="px-3.5 py-2 min-h-[44px] rounded-xl bg-[#52d9e6] hover:bg-[#7fe4ee] text-[#04242a] text-[14px] font-semibold flex items-center gap-2 transition-all"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Schermo intero</span>
          </button>
        </div>
      </div>

      {canUpload && <PdfPushSetup />}

      {uploadMsg && (
        <p role="status" className={`text-xs ${uploadMsg.ok ? 'text-emerald-300' : 'text-rose-300'}`}>
          {uploadMsg.text}
        </p>
      )}

      {lastRead && (changedDays.length > 0 || lastRead.warnings.length > 0) && (
        <div className="text-xs text-slate-400 space-y-1 border-l border-white/10 pl-3">
          {changedDays.length > 0 && (
            <p>
              <span className="text-slate-200">Programma letto dal PDF.</span> Giorni cambiati:{' '}
              {changedDays.map((r) => `${r.n} marzo`).join(', ')}.
            </p>
          )}
          {lastRead.warnings.map((w, i) => (
            <p key={`${i}-${w}`}>{w}</p>
          ))}
          {canUpload && changedDays.length > 0 && (
            <button type="button" disabled={uploading} onClick={onReset} className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2 disabled:opacity-50">
              Ripristina il programma originale
            </button>
          )}
        </div>
      )}

      {quickFacts}

      {/* Visualizzatore incorporato: le pagine sono disegnate nel sito, senza download */}
      <div className="overflow-hidden h-[70svh] md:h-[780px] flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 font-mono gap-2 bg-slate-950 border-b border-slate-800">
          <span>Visualizzatore PDF Ufficiale Aggiornato</span>
          <span className="truncate">{custom ? meta!.name : 'Itinerario_Seul_2027_aggiornato.pdf'}</span>
        </div>
        <PdfPageViewer url={pdfUrl} targetPage={selectedPageTopic} onDocument={onDocument} className="flex-1 min-h-0" />
      </div>

      {topicsBlock}

      {fullscreenLayer}
    </div>
  );
};
