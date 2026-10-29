import React, { useEffect, useState } from 'react';
import { TRIP_META } from '../data/tripData';
import { FileText, Download, Maximize2, X, BookOpen } from 'lucide-react';
import { PdfPageViewer } from './PdfPageViewer';

export const PdfViewerModal: React.FC = () => {
  const [selectedPageTopic, setSelectedPageTopic] = useState<number>(1);
  const [fullscreen, setFullscreen] = useState(false);

  // Cosa racconta ciascuna pagina del PDF aggiornato (12 pagine)
  const pageTopics = [
    { page: 1, title: 'Pag. 1: Calendario, voli e ritrovo a Malpensa', summary: 'Il riquadro Valorant Masters (torneo dal 20 febbraio al 3 marzo, finale e sede ancora da annunciare) e il calendario dei giorni. I voli Air China: andata il 1 marzo alle 12:30, ritorno il 19 marzo da Incheon alle 13:10; chi riparte prima lascia Seul il 10 marzo alle 11:10. Poi il ritrovo del 1 marzo al T1 di Malpensa entro le 10:00, con orari dei treni, check-in e regole d\'oro.' },
    { page: 2, title: 'Pag. 2: 2 marzo, scalo a Pechino e arrivo a Seul', summary: 'Atterraggio a Pechino alle 05:35 e coincidenza per Incheon alle 08:40 (3 ore e 5 minuti di scalo, solo "International Transfer"). Tabella ora per ora fino all\'arrivo a Seul alle 11:40, AREX in città, check-in alle 16:00 o deposito bagagli. In fondo il margine di sicurezza se il primo volo ritarda.' },
    { page: 3, title: 'Pag. 3: Dove dormire, 4 alloggi a confronto', summary: 'Enko Stay, 2-19 marzo: Myeongdong, Seoul Station, Mapo e Sinseol-dong a confronto per annuncio, prezzo mensile, totale per 17 notti, tipo di casa, metro, bus, distanza da Hongdae e cosa vedere vicino. Il riquadro "Come dividere l\'affitto": chi parte il 10 paga 8 notti (50-88 €), gli altri tre 17 notti (125-220 €), con l\'esempio di calcolo su Mapo.' },
    { page: 4, title: 'Pag. 4: Cancellazione, note e quale scegliere', summary: 'Regole di rimborso e pagamento Enko (uguali per tutti e quattro, commissione non rimborsabile, calendario fino al 2 marzo). Pro e contro di A, B, C e D e la guida "Quale scegliere": C per movida, A per spendere meno, D per dormire meglio, B solo se conta la stazione.' },
    { page: 5, title: 'Pag. 5: Come sono organizzate le serate', summary: 'Tabella di otto tipi di serata (strade di Hongdae, noraebang, sale giochi, pocha, live house, language exchange, serate di ballo, club) con ambiente, costo a testa ed età. Il limite dei 19 anni per alcol e club, il passaporto sempre con sé e come gestire il gruppo quando una parte entra in un club.' },
    { page: 6, title: 'Pag. 6: Budget serate e prima settimana (2 - 7 marzo)', summary: 'Budget delle serate per tutto il soggiorno: stretto 150-200 €, equilibrato 220-300 € (consigliato), largo 350-450 €, con i trucchi per restare nella fascia giusta. Poi la prima settimana in quattro: arrivo, Valorant Masters il 3, palazzi e Gangnam, Seongsu e Hongdae del venerdì, Itaewon, mercati e noraebang.' },
    { page: 7, title: 'Pag. 7: 8 - 15 marzo, saluti e seconda settimana', summary: 'L\'8 Namsan e language exchange, il 9 museo e ultima serata in quattro a Kondae. Il 10 una persona riparte (uscita alle 5:45-6:00 per il volo delle 11:10) e gli altri vanno a Incheon. Poi COEX e Sinchon, Suwon, il sabato grande a Hongdae, il White Day sul fiume Han e il tour DMZ.' },
    { page: 8, title: 'Pag. 8: Ultima parte (16 - 19 marzo)', summary: 'Bukhansan e pocha a Yeonnam, souvenir e ultima serata grande a Hongdae, ultimo giorno pieno (valigie da 23 kg, modulo d\'ingresso per la Cina, prenotazione di Tiananmen) e la giornata di partenza del 19: check-out, volo CA124, serata a Pechino e volo CA949 delle 02:15.' },
    { page: 9, title: 'Pag. 9: 19 marzo, la mattina a Seul e la sera a Pechino', summary: 'Tabella ora per ora della mattina a Seul, dalla sveglia alle 6:30 al decollo delle 13:10 (check-out, colazione, AREX, tax refund, check-in Air China). Poi l\'idea della serata a Pechino con il permesso di transito 240h e il riquadro "Prima di partire": passaporto, Arrival Card, internet bloccato, pagamenti con Alipay o WeChat Pay, power bank 3C e freddo.' },
    { page: 10, title: 'Pag. 10: Bagagli, Arrival Card e arrivo a Pechino passo per passo', summary: 'Come gestire le valigie (etichettate fino a Milano oppure deposito al T3), la guida all\'Arrival Card cinese (sito ufficiale, quando compilarla, dati richiesti, piano B) e i sei passaggi all\'arrivo a PEK: banco transito 240h, controllo passaporti, dogana, uscita. Inizia la tabella oraria di Pechino.' },
    { page: 11, title: 'Pag. 11: Serata a Pechino, costi e rischi', summary: 'Seconda parte della tabella di Pechino: Airport Express, metro fino a Qianmen, cena con anatra laccata e partenza tassativa alle 21:15 per il volo delle 02:15. Costi dello scalo (190-310 CNY, 25-40 € a persona) e i rischi: code, transito non concesso, Tiananmen su prenotazione.' },
    { page: 12, title: 'Pag. 12: 20 marzo, da Malpensa a Milano Centrale e costi', summary: 'Il rientro: atterraggio alle 06:30, passaporti, bagagli, Malpensa Express verso le 9:00-9:30 e treni di casa non prima delle 11:30, con margini in caso di ritardo. In chiusura "Costi e cose da verificare": serate, Valorant, tragitti su Naver Map, tariffe, tour DMZ e regole del transito.' }
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
              PDF aggiornato di 12 pagine: voli e ritrovo, alloggi a confronto, serate, programma giorno per giorno, lo scalo di 240 ore a Pechino e il rientro a Milano. Scegli una pagina qui sotto per leggere cosa contiene e aprirla nel visualizzatore.
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
            <p className="text-[11px] text-slate-400 leading-relaxed">
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
