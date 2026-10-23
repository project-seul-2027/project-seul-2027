import React, { useState } from 'react';
import { TRIP_META } from '../data/tripData';
import { FileText, Download, ExternalLink, BookOpen, Home } from 'lucide-react';

export const PdfViewerModal: React.FC = () => {
  const [selectedPageTopic, setSelectedPageTopic] = useState<number>(2); // Default to accommodations page 2

  const pageTopics = [
    { page: 1, title: 'Pag. 1: Calendario, Voli & Ritrovo Malpensa', summary: 'Ritrovo T1 Air China ore 10:00, orari e date generali, Valorant Masters.' },
    { page: 2, title: 'Pag. 2: 4 Alloggi Enko & Divisione Affitto', summary: 'Formula fissata: Pietro 6 notti (37-66 €) vs Ognuno dei 3 per 17 notti (129-227 €).' },
    { page: 3, title: 'Pag. 3: Note Alloggi & Guida "Quale Scegliere"', summary: 'Pro e contro di A, B, C, D; consigli per movida (C) vs risparmio (A) vs letti (D).' },
    { page: 4, title: 'Pag. 4: Settimana 1 (2 - 7 Marzo)', summary: 'Arrivo, Valorant Masters (3 mar), Palazzi + Gangnam di giovedì, Saluto Pietro (7 mar).' },
    { page: 5, title: 'Pag. 5: Settimana 2 (8 - 14 Marzo)', summary: 'Rientro di Pietro a Milano (8 mar), Namsan a piedi, COEX, Gita Suwon, White Day sul fiume Han.' },
    { page: 6, title: 'Pag. 6: Settimana 3 (15 - 18 Marzo)', summary: 'Bukhansan, DMZ, shopping skincare, preparazione valigie 23kg, Tiananmen online e China card.' },
    { page: 7, title: 'Pag. 7: 19 Marzo Partenza Seul & Scalo Pechino', summary: 'Partenza Seul, arrivo Pechino T3, permesso transito 240h, Qianmen e cena anatra laccata.' },
    { page: 8, title: 'Pag. 8: Rientro T3 Pechino Tassativo (21:15)', summary: 'Regole orari rientro, checklist sicurezza, volo notturno 02:15 per Milano.' },
    { page: 9, title: 'Pag. 9: Preventivo Completo & Consigli Risparmio', summary: 'Riepilogo costi (Pietro e i 3 amici), budget scalo Pechino 190-310 CNY, consigli low-cost.' }
  ];

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
              PDF aggiornato di 9 pagine con ripartizione affitti per Pietro (6 notti) e i 3 amici (17 notti), Valorant, White Day e guida Pechino.
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
          <a
            href={TRIP_META.pdfPath}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Apri a Schermo Intero</span>
          </a>
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

      {/* Embedded Iframe */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[780px] flex flex-col">
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span>Visualizzatore PDF Ufficiale Aggiornato</span>
          <span>{TRIP_META.pdfPath.split('/').pop()}</span>
        </div>
        <div className="flex-1 w-full bg-slate-950 relative">
          <iframe
            src={`${TRIP_META.pdfPath}#page=${selectedPageTopic}&zoom=100`}
            title="Itinerario Seul 2027 PDF Aggiornato"
            className="w-full h-full border-none"
          />
        </div>
      </div>
    </div>
  );
};
