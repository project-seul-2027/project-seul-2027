import React, { useEffect, useState } from 'react';
import { TRIP_META } from '../data/tripData';
import { FileText, Download, Maximize2, X, BookOpen } from 'lucide-react';
import { PdfPageViewer } from './PdfPageViewer';

export const PdfViewerModal: React.FC = () => {
  const [selectedPageTopic, setSelectedPageTopic] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);

  // Cosa racconta ciascuna pagina del PDF aggiornato (10 pagine)
  const pageTopics = [
    { page: 1, title: 'Pag. 1: Calendario, voli e ritrovo a Malpensa', summary: 'Date, voli Air China di andata e ritorno, ritrovo al T1 alle 10:00 del 1 marzo, regole d\'oro e Valorant Masters (sede da annunciare).' },
    { page: 2, title: 'Pag. 2: Dove dormire, 4 alloggi a confronto', summary: 'Enko Stay: prezzi mensili, totali per 17 notti, metro e bus, e come dividere l\'affitto (chi parte l\'8 paga 6 notti).' },
    { page: 3, title: 'Pag. 3: Cancellazioni e note per alloggio', summary: 'Regole di rimborso Enko, pro e contro di A, B, C, D e la guida "Quale scegliere" per movida, risparmio o letti.' },
    { page: 4, title: 'Pag. 4: Come sono organizzate le serate', summary: 'Strade, noraebang, sale giochi, pocha, live house e club, con costi e limiti di età (19 anni), più come gestire il gruppo che si divide.' },
    { page: 5, title: 'Pag. 5: Budget serate e prima settimana (2 - 7 marzo)', summary: 'Budget serate (stretto, equilibrato, largo) e il programma giorno per giorno: arrivo, Valorant, Palazzi e Gangnam, Seongsu, Itaewon, mercati.' },
    { page: 6, title: 'Pag. 6: Rientro (8 marzo) e seconda settimana (9 - 15 marzo)', summary: 'Rientro di chi parte l\'8, poi museo, Incheon, COEX e Sinchon, Suwon, Hongdae del sabato, White Day sul fiume Han e DMZ.' },
    { page: 7, title: 'Pag. 7: Ultima parte (16 - 19 marzo)', summary: 'Bukhansan e Yeonnam, souvenir e ultima serata grande, ultimo giorno pieno e partenza del 19 marzo.' },
    { page: 8, title: 'Pag. 8: 19 marzo, mattina a Seul e Pechino', summary: 'Prerequisiti per il transito 240h (passaporto, Arrival Card, internet, pagamenti) e la tabella della mattina a Seul fino al volo delle 13:10.' },
    { page: 9, title: 'Pag. 9: Arrivo a Pechino passo per passo', summary: 'Bagagli, carta d\'arrivo, banco del transito 240h, controllo passaporti, uscita e la tabella delle prime ore a PEK.' },
    { page: 10, title: 'Pag. 10: Serata a Pechino, costi e rischi', summary: 'Qianmen e anatra laccata, rientro al T3 entro le 21:15, volo delle 02:15, budget dello scalo (190-310 CNY) e cose da verificare.' }
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
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-500/10 text-red-400 shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white font-display">
              Documento Ufficiale Aggiornato: Itinerario Seul 2027
            </h3>
            <p className="text-xs text-slate-400">
              PDF aggiornato di 10 pagine: alloggi a confronto, serate, programma giorno per giorno e lo scalo di 240 ore a Pechino. Scegli una pagina qui sotto per vedere cosa contiene.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href={TRIP_META.pdfPath}
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

      {/* Page index pills */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pageTopics.map((pt) => (
          <div
            key={pt.page}
            onClick={() => setSelectedPageTopic(pt.page)}
            className={`p-3 rounded-xl border transition-all cursor-pointer ${
              selectedPageTopic === pt.page
                ? 'bg-slate-800 border-cyan-500/50 shadow-md text-white ring-1 ring-cyan-500/20'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="font-bold text-xs text-cyan-300 mb-1 flex items-center justify-between">
              <span>{pt.title}</span>
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <p className="text-[11px] text-slate-400 line-clamp-2">
              {pt.summary}
            </p>
          </div>
        ))}
      </div>

      {/* Visualizzatore incorporato: le pagine sono disegnate nel sito, senza download */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[70svh] md:h-[780px] flex flex-col">
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono gap-2">
          <span>Visualizzatore PDF Ufficiale Aggiornato</span>
          <span className="truncate">{TRIP_META.pdfPath.split('/').pop()}</span>
        </div>
        <PdfPageViewer url={TRIP_META.pdfPath} targetPage={selectedPageTopic} className="flex-1 min-h-0" />
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
                href={TRIP_META.pdfPath}
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
          <PdfPageViewer url={TRIP_META.pdfPath} targetPage={selectedPageTopic} className="flex-1 min-h-0" />
        </div>
      )}
    </div>
  );
};
