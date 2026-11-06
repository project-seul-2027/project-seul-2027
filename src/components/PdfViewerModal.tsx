import React, { useEffect, useRef, useState } from 'react';
import { FileText, Download, Maximize2, X, BookOpen, Upload } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { itineraryPdfService, type OverrideReport } from '../services/itineraryPdfService';
import { useItineraryPdf } from './useItineraryPdf';
import { PdfPageViewer } from './PdfPageViewer';
import { FoldText } from './mobile/FoldText';
import { useMediaQuery } from '../pwa';

export const PdfViewerModal: React.FC = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [selectedPageTopic, setSelectedPageTopic] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);
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
      setUploadMsg({
        ok: true,
        text: res.analysed
          ? `PDF aggiornato e programma riletto: ${changed === 0 ? 'nessun giorno è cambiato' : `${changed} giorni cambiati`}. Lo vede subito tutto il gruppo; la notifica ai telefoni arriva entro pochi minuti.`
          : `PDF aggiornato, ma il programma non è stato cambiato: ${res.warnings[0] ?? 'struttura non riconosciuta'}. Resta quello di prima.`
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

  // Chiudi il pannello a schermo intero con Esc
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div
        className={
          isDesktop
            ? 'pb-5 border-b border-white/[0.06] flex flex-row items-center justify-between gap-6'
            : 'bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4'
        }
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display">
              Documento Ufficiale Aggiornato: Itinerario Seul 2027
            </h3>
            <FoldText className="text-xs text-slate-400">
              {custom
                ? `PDF caricato dal Posto 1 il ${new Date(meta!.updatedAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}: ${meta!.name}.`
                : 'PDF di 13 pagine: voli e ritrovo, alloggi a confronto, serate, programma giorno per giorno, lo scalo di 240 ore a Pechino e il rientro a Milano. Scegli una pagina qui sotto per leggere cosa contiene e aprirla nel visualizzatore.'}
            </FoldText>
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
                className="px-3.5 py-2 rounded-xl border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? 'Caricamento…' : 'Aggiorna PDF'}</span>
              </button>
            </>
          )}
          <a
            href={pdfUrl}
            download="Itinerario_Seul_2027_Aggiornato.pdf"
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Scarica PDF</span>
          </a>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Schermo intero</span>
          </button>
        </div>
      </div>

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
          {lastRead.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {canUpload && changedDays.length > 0 && (
            <button type="button" disabled={uploading} onClick={onReset} className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2 disabled:opacity-50">
              Ripristina il programma originale
            </button>
          )}
        </div>
      )}

      {/* Page index pills: solo per il PDF incluso nel sito */}
      {!custom && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pageTopics.map((pt) => (
          <div
            key={pt.page}
            onClick={() => setSelectedPageTopic(pt.page)}
            className={`p-3 transition-all cursor-pointer ${
              isDesktop
                ? selectedPageTopic === pt.page
                  ? 'border-l-2 border-cyan-400 pl-4 text-white'
                  : 'border-l-2 border-transparent pl-4 text-slate-300 hover:text-white'
                : `rounded-xl border ${
                    selectedPageTopic === pt.page
                      ? 'bg-slate-800 border-cyan-500/50 shadow-md text-white ring-1 ring-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`
            }`}
          >
            <div className="font-bold text-xs text-cyan-300 mb-1 flex items-center justify-between">
              <span>{pt.title}</span>
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {pt.summary}
            </p>
          </div>
        ))}
      </div>
      )}

      {/* Visualizzatore incorporato: le pagine sono disegnate nel sito, senza download */}
      <div
        className={`overflow-hidden h-[70svh] md:h-[780px] flex flex-col ${
          isDesktop ? 'border border-slate-800/80 rounded-2xl' : 'bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl'
        }`}
      >
        <div
          className={`px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 font-mono gap-2 ${
            isDesktop ? 'border-b border-white/[0.06]' : 'bg-slate-950 border-b border-slate-800'
          }`}
        >
          <span>Visualizzatore PDF Ufficiale Aggiornato</span>
          <span className="truncate">{custom ? meta!.name : 'Itinerario_Seul_2027_aggiornato.pdf'}</span>
        </div>
        <PdfPageViewer url={pdfUrl} targetPage={selectedPageTopic} className="flex-1 min-h-0" />
      </div>

      {/* Pannello a schermo intero dentro l'app */}
      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Itinerario Seul 2027 a schermo intero"
          className="fixed inset-0 z-[70] bg-slate-950 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
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
      )}
    </div>
  );
};
