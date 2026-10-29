import React, { useMemo, useState } from 'react';
import { ACCOMMODATIONS } from '../data/tripData';
import { useAuth } from '../auth/AuthContext';
import type { AccommodationId } from '../shared/travelerProfile';
import { 
  Home, MapPin, Banknote, Sparkles, CheckCircle2, 
  XCircle, Train, Bus, ShieldCheck, ArrowRight, HelpCircle, 
  Calculator, User, Users, Info, Heart, Award
} from 'lucide-react';

interface AccommodationsViewProps {
  onViewOnMap: (locationId: string) => void;
}

export const AccommodationsView: React.FC<AccommodationsViewProps> = ({ onViewOnMap }) => {
  const [selectedAccId, setSelectedAccId] = useState<string>('acc_a');

  // Voti del gruppo: salvati su Firestore nel profilo di ciascuno, visibili a tutti in tempo reale
  const { user, group, travelers, voteAccommodation } = useAuth();
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const myVote = user?.accommodationPreference ?? null;

  const votersByAcc = useMemo(() => {
    const map: Record<string, { name: string; color: string }[]> = {};
    group.forEach((m) => {
      if (!m.accommodationPreference) return;
      const slot = travelers.find((t) => t.id === m.travelerId);
      (map[m.accommodationPreference] ??= []).push({ name: m.displayName, color: slot?.color ?? '#38bdf8' });
    });
    return map;
  }, [group, travelers]);

  const leading = [...ACCOMMODATIONS].sort(
    (a, b) => (votersByAcc[b.id]?.length ?? 0) - (votersByAcc[a.id]?.length ?? 0)
  )[0];
  const leadingVotes = votersByAcc[leading.id]?.length ?? 0;
  const totalVotes = Object.values(votersByAcc).reduce((n, v) => n + v.length, 0);

  // Clic sul proprio voto = ritiro
  const handleVote = async (accId: string) => {
    setVoteError(null);
    setIsVoting(true);
    try {
      await voteAccommodation(myVote === accId ? null : (accId as AccommodationId));
    } catch (err) {
      setVoteError((err as Error).message);
    } finally {
      setIsVoting(false);
    }
  };

  const VoteButton: React.FC<{ accId: string; large?: boolean }> = ({ accId, large }) => {
    const voters = votersByAcc[accId] ?? [];
    const mine = myVote === accId;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleVote(accId);
        }}
        disabled={isVoting}
        aria-pressed={mine}
        title={mine ? 'Il tuo voto: clicca per ritirarlo' : 'Vota questo alloggio'}
        className={`rounded-lg font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-60 ${
          large ? 'px-4 py-2 text-xs rounded-xl' : 'px-2 py-1 text-[11px]'
        } ${
          mine
            ? 'bg-red-500/20 text-red-300 border border-red-500/50'
            : 'bg-slate-950 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-500/30'
        }`}
      >
        <Heart className={`${large ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${mine ? 'fill-red-400 text-red-400' : ''}`} />
        <span className="font-mono">
          {large ? (mine ? 'Il tuo voto è qui' : 'Vota questo alloggio') : `${voters.length} ${voters.length === 1 ? 'voto' : 'voti'}`}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
              <Home className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                Dove Dormire: 4 Alloggi a Confronto
              </h2>
              <p className="text-xs text-slate-400">
                Enko Stay · 2-19 marzo 2027 (17 notti) · 4 persone all'inizio (Pietro riparte il 10 marzo, gli altri 3 fino al 19)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-500/40 font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Base ipotizzata: Mapo / Hongdae</span>
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Gli annunci mostrano un prezzo mensile (non il totale del soggiorno). I totali in euro qui sotto sono quelli mostrati dal sito per le date scelte (commissione Enko inclusa), per le 17 notti (2-19 marzo). Nessun annuncio indica indirizzo preciso, numero di letti o metratura: le distanze a piedi sono quelle dichiarate dagli host, il resto sono stime da verificare su Naver Map.
        </p>

        {/* Votazione del gruppo */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
              <Award className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-white">
                {leadingVotes > 0 ? (
                  <>
                    In testa: <span className="text-cyan-400">{leading.name}</span>{' '}
                    <span className="text-slate-400 font-normal">({leadingVotes} {leadingVotes === 1 ? 'voto' : 'voti'} · {totalVotes}/4 hanno votato)</span>
                  </>
                ) : (
                  <>Votazione aperta: nessun voto ancora espresso</>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                {myVote ? (
                  <>
                    Hai votato l'alloggio <strong className="text-slate-200">{ACCOMMODATIONS.find((a) => a.id === myVote)?.code}</strong>. Clicca di nuovo sul cuore per ritirare il voto.
                  </>
                ) : (
                  <>Clicca sul cuore di un alloggio per votarlo: il voto è visibile a tutto il gruppo.</>
                )}
              </div>
              {voteError && <div role="alert" className="text-[11px] text-red-400">{voteError}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Come dividere l'affitto (Fissato dal PDF) */}
      <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm sm:text-base">
            <Calculator className="w-4 h-4" />
            <h3>Come Dividere l'Affitto (Formula Ufficiale del Gruppo)</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            Regola: ogni notte costa totale / 17 e la pagano i presenti
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Siete in <strong>4 dall'inizio</strong>. <strong>Pietro riparte il 10 marzo</strong> e paga <strong>8 notti</strong> (2-9 marzo). Gli altri tre amici restano fino al 19 marzo e pagano tutte le 17 notti. Il prezzo di ogni alloggio è fisso.
        </p>

        {/* Tabella riassuntiva quote */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Alloggio</th>
                <th className="py-2.5 px-3 text-right">Totale 17 notti</th>
                <th className="py-2.5 px-3 text-right text-amber-300">Pietro (2-9 mar · 8 notti)</th>
                <th className="py-2.5 px-3 text-right text-emerald-400">Ognuno dei 3 (fino al 19 mar)</th>
                <th className="py-2.5 px-3 text-center">Scheda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {ACCOMMODATIONS.map((acc) => (
                <tr 
                  key={acc.id} 
                  onClick={() => setSelectedAccId(acc.id)}
                  className={`cursor-pointer transition-colors ${
                    selectedAccId === acc.id ? 'bg-cyan-950/20 font-bold' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-3 px-3 font-sans text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-slate-800 text-cyan-300 font-bold text-[10px] flex items-center justify-center font-mono">
                      {acc.code}
                    </span>
                    <span>{acc.name}</span>
                  </td>
                  <td className="py-3 px-3 text-right text-slate-200">
                    {acc.totalEur17Nights} €
                  </td>
                  <td className="py-3 px-3 text-right text-amber-300 font-bold">
                    {acc.pietroCost8Nights} €
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                    {acc.other3Cost17Nights} €
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedAccId(acc.id); }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-sans font-medium underline"
                    >
                      Dettagli
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Esempio matematico */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
          <strong className="text-white block flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            Esempio di calcolo per C (748 €, 44 € a notte):
          </strong>
          <p>
            Pietro paga 8 × 44 / 4 = <strong className="text-amber-300">88 €</strong>. Ognuno dei tre paga 88 € per le notti in comune (2-9 marzo) più 9 × 44 / 3 = 132 € per le notti dal 10 al 18, cioè <strong className="text-emerald-400">220 €</strong>. Importi arrotondati all'euro.
          </p>
        </div>
      </div>

      {/* 4 Cards Grid Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {ACCOMMODATIONS.map((acc) => {
          const isSelected = selectedAccId === acc.id;

          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccId(acc.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500/70 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                  : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    acc.code === 'A'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : acc.code === 'C'
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                      : acc.code === 'D'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  }`}>
                    {acc.highlightBadge}
                  </span>

                  <VoteButton accId={acc.id} />
                </div>

                {(votersByAcc[acc.id]?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {votersByAcc[acc.id].map((v) => (
                      <span
                        key={v.name}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color }} />
                        {v.name}
                      </span>
                    ))}
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-sm text-white">
                    {acc.name}
                  </h3>
                  <div className="text-xs text-slate-400 font-mono italic">
                    {acc.adTitle}
                  </div>
                </div>

                {/* Price block con suddivisione Pietro vs Altri */}
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] text-slate-400">Totale 17 notti:</span>
                    <span className="text-base font-bold font-mono text-cyan-400">
                      {acc.totalEur17Nights} €
                    </span>
                  </div>

                  <div className="pt-1.5 border-t border-slate-800/60 space-y-1 font-mono text-xs">
                    <div className="flex items-center justify-between text-amber-300">
                      <span className="text-[11px] font-sans flex items-center gap-1">
                        <User className="w-3 h-3" /> Pietro (8 notti):
                      </span>
                      <span className="font-bold">{acc.pietroCost8Nights} €</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-400">
                      <span className="text-[11px] font-sans flex items-center gap-1">
                        <Users className="w-3 h-3" /> Ognuno dei 3 (17 notti):
                      </span>
                      <span className="font-bold">{acc.other3Cost17Nights} €</span>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                    <span>Mensile Enko: {acc.monthlyKrw.toLocaleString('it-IT')} ₩</span>
                    <span>~{acc.nightlyRateEur} € / notte</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-3">
                  {acc.typeDescription}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  Hongdae: {acc.hongdaeTransit}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewOnMap(acc.id);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
                >
                  <span>Mappa</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detailed View of Selected Accommodation */}
      {(() => {
        const acc = ACCOMMODATIONS.find((a) => a.id === selectedAccId) || ACCOMMODATIONS[0];

        return (
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold font-mono text-base flex items-center justify-center border border-cyan-500/40">
                    {acc.code}
                  </span>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-white font-display">
                      {acc.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Titolo annuncio Enko: <strong>{acc.adTitle}</strong> · Quartiere: {acc.district}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <VoteButton accId={acc.id} large />
                <button
                  onClick={() => onViewOnMap(acc.id)}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition-all"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Vedi sulla Mappa & Dintorni</span>
                </button>
              </div>
            </div>

            {/* Spec grid con quote ripartite */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <span className="font-bold text-cyan-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5" />
                  Divisione Spesa Fissata
                </span>
                <div className="text-lg font-bold font-mono text-white">
                  {acc.totalEur17Nights} € totali
                </div>
                <div className="text-amber-300 font-bold text-xs font-mono">
                  Pietro (8 notti): {acc.pietroCost8Nights} €
                </div>
                <div className="text-emerald-400 font-bold text-xs font-mono">
                  Ognuno dei 3 (17 notti): {acc.other3Cost17Nights} €
                </div>
                <div className="text-slate-400 text-[11px] pt-1">
                  Canone mensile indicato: {acc.monthlyKrw.toLocaleString('it-IT')} ₩
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <span className="font-bold text-cyan-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Train className="w-3.5 h-3.5" />
                  Metro & Stazioni a Piedi
                </span>
                <p className="text-slate-200 leading-relaxed font-medium">
                  {acc.metroWalk}
                </p>
                <div className="text-slate-400 text-[11px] pt-1">
                  Verso Hongdae: {acc.hongdaeTransit}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <span className="font-bold text-cyan-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Bus className="w-3.5 h-3.5" />
                  Trasferimento Aeroporto & Dintorni
                </span>
                <p className="text-slate-200 leading-relaxed font-medium">
                  {acc.airportTransit}
                </p>
                <div className="text-slate-400 text-[11px] pt-1">
                  Attrazioni vicine: {acc.nearbyAttractions}
                </div>
              </div>
            </div>

            {/* Pro & Contro Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2.5">
                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Vantaggi e Punti di Forza
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-200">
                  {acc.pro.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 space-y-2.5">
                <h4 className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-400" />
                  Svantaggi e Aspetti Critici
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-200">
                  {acc.contro.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-400 font-bold shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Host notes */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1">
              <strong className="text-cyan-300 block">💡 Nota di sintesi dal documento:</strong>
              <p>{acc.importantNotes}</p>
            </div>
          </div>
        );
      })()}

      {/* Guide: "Quale Scegliere" (from Page 3 of PDF) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
          <HelpCircle className="w-5 h-5" />
          <h3>Quale Scegliere (Analisi Strategica del Documento)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-pink-400 text-sm">
              • Per movida e nightlife: C (Mapo)
            </h4>
            <p className="text-slate-300 leading-relaxed">
              A pari merito comodità e posizione. Per i tre che restano costa circa <strong>26-31 € a testa in più</strong> rispetto a B e D, ma risparmi tempo e taxi la notte. Hongdae a 1 sola fermata di AREX.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-emerald-400 text-sm">
              • Per spendere meno: A (Myeongdong)
            </h4>
            <p className="text-slate-300 leading-relaxed">
              Se i letti bastano per quattro e non temete le scale del 4° piano. Per i tre che restano sono <strong>125 € a testa (Pietro 50 €)</strong>, circa 95 € in meno di Mapo.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <h4 className="font-bold text-purple-400 text-sm">
              • Per dormire meglio e stare in tanti: D (Sinseol-dong)
            </h4>
            <p className="text-slate-300 leading-relaxed">
              3 letti queen size veri e 2 camere separate. Contro: con la serata fuori diventa più scomoda per il rientro notturno dopo l'1:00.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs text-slate-400 space-y-1.5">
          <p>
            • <strong>B (Seoul Station)</strong> ha senso solo se conta molto la stazione; in genere A o C battono B.
          </p>
          <p>
            • <strong>Regola di prenotazione:</strong> se il piano resta 2-19 marzo (17 notti), controllare che le date siano 2-19 marzo (17 notti) al momento della prenotazione. Prima di prenotare chiedere all'host: <em>letti e biancheria, check-in anticipato il 2 marzo (atterraggio alle 11:40), deposito bagagli il 19 se serve</em>.
          </p>
        </div>
      </div>

      {/* Enko Stay Cancellation & Payment Policy (Page 3 of PDF) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
          <ShieldCheck className="w-5 h-5" />
          <h3>Cancellazione e Pagamento (Uguale per Tutti e Quattro)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-slate-300">
            <strong className="text-white block text-xs">Regole Ufficiali di Rimborso Enko:</strong>
            <p>• <strong>Prima dell'approvazione host:</strong> rimborso totale se la prenotazione non viene confermata entro 24 ore.</p>
            <p>• <strong>Dopo l'approvazione:</strong> rimborso totale entro 24 ore dal pagamento. Poi il rimborso è parziale e dipende dalla data di ingresso.</p>
            <p>• <strong>Commissione del servizio Enko:</strong> non è rimborsabile dopo le 24 ore.</p>
            <p>• <strong>Calendario rimborsi (da annuncio Mapo):</strong> rimborso quasi totale fino al 17 gennaio, 10% di penale fino al 31 gennaio, 50% fino al 16 febbraio, 70% fino al 23 febbraio, 100% fino al 2 marzo.</p>
          </div>

          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2 text-slate-300">
            <strong className="text-amber-300 block text-xs">Consigli Strategici & Costi Extra:</strong>
            <p>• <strong>Consigliato:</strong> chiedere la prenotazione, pagare entro le 24 ore e solo dopo comprare il volo (cancellando tutto gratis se qualcosa non torna).</p>
            <p>• <strong>Extra luce e utenze:</strong> la luce si paga a parte a fine soggiorno (annuncio A); le utenze hanno una quota fissa con extra oltre il limite.</p>
            <p>• <strong>Note annuncio C (Mapo):</strong> monolocale con divano letto per 4 persone (spazio stretto), biancheria non fornita (da chiedere all'host), niente prodotti da bagno, check-in dalle 16:00 e check-out alle 11:00.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
