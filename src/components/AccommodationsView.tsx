import React, { useEffect, useMemo, useState } from 'react';
import { ACCOMMODATIONS, priceAccommodation } from '../data/tripData';
import { accommodationPriceService, type PriceOverrides } from '../services/accommodationPriceService';
import { useAuth } from '../auth/AuthContext';
import type { AccommodationId } from '../shared/travelerProfile';
import { 
  Home, MapPin, Banknote, Sparkles, CheckCircle2, 
  XCircle, Train, Bus, ShieldCheck, ArrowRight, HelpCircle, 
  Calculator, User, Users, Info, Heart, Award
} from 'lucide-react';
import { FoldText } from './mobile/FoldText';
import { useMediaQuery } from '../pwa';

interface AccommodationsViewProps {
  onViewOnMap: (locationId: string) => void;
}

const PriceEditor: React.FC<{ accId: string; current: number; canEdit: boolean }> = ({ accId, current, canEdit }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  if (!canEdit) return null;
  if (!editing) {
    return (
      <button type="button" onClick={() => { setValue(String(current)); setEditing(true); }} className="text-xs text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline">
        Modifica prezzo
      </button>
    );
  }
  const save = async () => {
    const n = Number(value.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0 || n > 20000) { setError('Inserisci un totale in euro tra 1 e 20000.'); return; }
    setSaving(true);
    setError(null);
    try {
      await accommodationPriceService.set(accId, Math.round(n));
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
      <input
        type="number"
        inputMode="decimal"
        min={1}
        max={20000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Totale 17 notti in euro"
        className="w-24 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-white tabular-nums"
      />
      <span className="text-slate-400">€ totali (17 notti)</span>
      <button type="button" onClick={save} disabled={saving} className="px-2.5 py-1 rounded-md bg-cyan-500 text-slate-950 font-semibold disabled:opacity-50">Salva</button>
      <button type="button" onClick={() => setEditing(false)} className="text-slate-400 hover:text-white">Annulla</button>
      {error && <span className="text-rose-400 w-full">{error}</span>}
    </div>
  );
};

export const AccommodationsView: React.FC<AccommodationsViewProps> = ({ onViewOnMap }) => {
  const [selectedAccId, setSelectedAccId] = useState<string>('acc_a');
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // Voti del gruppo: salvati su Firestore nel profilo di ciascuno, visibili a tutti in tempo reale
  const { user, group, travelers, voteAccommodation } = useAuth();
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const myVote = user?.accommodationPreference ?? null;

  // Prezzi modificabili solo dal Partecipante 1 (le regole Firestore lo impongono lato server)
  const [priceOverrides, setPriceOverrides] = useState<PriceOverrides>({});
  const canEditPrice = user?.travelerId === 't1';
  useEffect(
    () => accommodationPriceService.watch(setPriceOverrides, (err) => console.warn('Prezzi alloggi non leggibili:', err)),
    []
  );
  const accs = useMemo(
    () => ACCOMMODATIONS.map((a) => (priceOverrides[a.id] != null ? priceAccommodation(a, priceOverrides[a.id]) : a)),
    [priceOverrides]
  );


  const votersByAcc = useMemo(() => {
    const map: Record<string, { name: string; color: string }[]> = {};
    group.forEach((m) => {
      if (!m.accommodationPreference) return;
      const slot = travelers.find((t) => t.id === m.travelerId);
      (map[m.accommodationPreference] ??= []).push({ name: m.displayName, color: slot?.color ?? '#38bdf8' });
    });
    return map;
  }, [group, travelers]);

  const leading = [...accs].sort(
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

  if (isDesktop) {
    const sel = accs.find((a) => a.id === selectedAccId) || accs[0];
    const rule = 'border-t border-slate-800/80';
    const h2 = 'text-xl font-semibold text-white';

    const VoteLink: React.FC<{ accId: string; label?: boolean }> = ({ accId, label }) => {
      const n = votersByAcc[accId]?.length ?? 0;
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
          className={`text-sm whitespace-nowrap disabled:opacity-60 transition-colors ${
            mine ? 'text-cyan-300 font-semibold' : 'text-slate-400 hover:text-white'
          }`}
        >
          {mine ? 'Il tuo voto' : 'Vota'}
          {label ? '' : n > 0 ? ` · ${n}` : ''}
        </button>
      );
    };

    return (
      <div className="space-y-12 animate-in fade-in duration-200">
        <section className="max-w-3xl space-y-3">
          <p className="text-sm text-slate-400">
            Enko Stay · 2-19 marzo 2027 · 17 notti · 4 persone all'inizio, Pietro riparte il 10 marzo
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            Gli annunci mostrano un prezzo mensile, non il totale del soggiorno. I totali in euro sono quelli mostrati dal sito per le date scelte, commissione Enko inclusa. Nessun annuncio indica indirizzo preciso, numero di letti o metratura: le distanze a piedi sono quelle dichiarate dagli host, il resto va verificato su Naver Map.
          </p>
          <p className="text-sm text-slate-400">
            {leadingVotes > 0 ? (
              <>
                In testa: <span className="text-white font-semibold">{leading.name}</span> con {leadingVotes} {leadingVotes === 1 ? 'voto' : 'voti'} ({totalVotes}/4 hanno votato).
              </>
            ) : (
              <>Nessun voto ancora espresso.</>
            )}{' '}
            {myVote ? (
              <>Hai votato l'alloggio {accs.find((a) => a.id === myVote)?.code}.</>
            ) : (
              <>Vota dalla tabella: il voto è visibile a tutto il gruppo.</>
            )}
          </p>
          {voteError && <p role="alert" className="text-sm text-red-400">{voteError}</p>}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className={h2}>Quanto costa a testa</h2>
            <p className="text-sm text-slate-400 mt-1">
              Ogni notte costa il totale diviso 17 e la pagano i presenti. Pietro paga 8 notti (2-9 marzo), gli altri tre tutte le 17.
            </p>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-y border-slate-800/80 text-slate-400">
                <th className="py-3 pr-4 font-medium">Alloggio</th>
                <th className="py-3 px-4 font-medium text-right">Totale 17 notti</th>
                <th className="py-3 px-4 font-medium text-right">Pietro, 8 notti</th>
                <th className="py-3 px-4 font-medium text-right">Ognuno dei 3</th>
                <th className="py-3 px-4 font-medium text-right">Voti</th>
                <th className="py-3 pl-4 font-medium text-right"><span className="sr-only">Mappa</span></th>
              </tr>
            </thead>
            <tbody>
              {accs.map((acc) => {
                const on = selectedAccId === acc.id;
                const voters = votersByAcc[acc.id] ?? [];
                return (
                  <tr
                    key={acc.id}
                    onClick={() => setSelectedAccId(acc.id)}
                    aria-selected={on}
                    className={`cursor-pointer border-b border-slate-800/80 transition-colors ${
                      on ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className={`py-4 pr-4 border-l-2 pl-4 ${on ? 'border-cyan-400' : 'border-transparent'}`}>
                      <div className="font-semibold text-white">{acc.code} · {acc.name.replace(/^Alloggio [A-D]:\s*/, '')}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{acc.highlightBadge}</div>
                    </td>
                    <td className="py-4 px-4 text-right tabular-nums text-slate-300">{acc.totalEur17Nights} €</td>
                    <td className="py-4 px-4 text-right tabular-nums text-slate-300">{acc.pietroCost8Nights} €</td>
                    <td className="py-4 px-4 text-right tabular-nums text-xl font-semibold text-white">{acc.other3Cost17Nights} €</td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {voters.length > 0 && (
                          <span className="flex items-center -space-x-1">
                            {voters.map((v) => (
                              <span
                                key={v.name}
                                title={v.name}
                                className="w-2.5 h-2.5 rounded-full ring-2 ring-[#080D18]"
                                style={{ backgroundColor: v.color }}
                              />
                            ))}
                          </span>
                        )}
                        <VoteLink accId={acc.id} />
                      </div>
                    </td>
                    <td className="py-4 pl-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewOnMap(acc.id);
                        }}
                        className="text-sm text-cyan-300 hover:text-cyan-200 transition-colors"
                      >
                        Mappa
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-sm text-slate-400 max-w-3xl">
            Esempio per l'alloggio C (748 €, 44 € a notte): Pietro paga 8 × 44 / 4 = <span className="text-white font-semibold">88 €</span>. Ognuno dei tre paga 88 € per le notti in comune (2-9 marzo) più 9 × 44 / 3 = 132 € per le notti dal 10 al 18, cioè <span className="text-white font-semibold">220 €</span>. Importi arrotondati all'euro.
          </p>
        </section>

        <section className={`${rule} pt-10 space-y-8`}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold text-white">{sel.code} · {sel.name.replace(/^Alloggio [A-D]:\s*/, '')}</h2>
              <p className="text-sm text-slate-400 mt-1">
                Annuncio Enko: {sel.adTitle} · Quartiere: {sel.district}
              </p>
              <p className="text-sm text-slate-300 leading-relaxed mt-3 max-w-2xl">{sel.typeDescription}</p>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <VoteLink accId={sel.id} label />
              <button
                onClick={() => onViewOnMap(sel.id)}
                className="px-4 py-2 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-colors"
              >
                Vedi sulla mappa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-800/80 border-y border-slate-800/80">
            <div className="py-5 pr-6 space-y-1.5">
              <p className="text-xs text-slate-400">Costo</p>
              <p className="text-2xl font-semibold text-white tabular-nums">{sel.totalEur17Nights} € totali</p>
              <PriceEditor key={sel.id} accId={sel.id} current={sel.totalEur17Nights} canEdit={canEditPrice} />
              <p className="text-sm text-slate-300">Pietro, 8 notti: <span className="text-white font-semibold">{sel.pietroCost8Nights} €</span></p>
              <p className="text-sm text-slate-300">Ognuno dei 3, 17 notti: <span className="text-white font-semibold">{sel.other3Cost17Nights} €</span></p>
              <p className="text-xs text-slate-400">Canone mensile indicato: {sel.monthlyKrw.toLocaleString('it-IT')} ₩</p>
            </div>
            <div className="py-5 px-6 space-y-1.5">
              <p className="text-xs text-slate-400">Metro e stazioni a piedi</p>
              <p className="text-sm text-white leading-relaxed">{sel.metroWalk}</p>
              <p className="text-xs text-slate-400">Verso Hongdae: {sel.hongdaeTransit}</p>
            </div>
            <div className="py-5 pl-6 space-y-1.5">
              <p className="text-xs text-slate-400">Dall'aeroporto</p>
              <p className="text-sm text-white leading-relaxed">{sel.airportTransit}</p>
              <p className="text-xs text-slate-400">Vicino: {sel.nearbyAttractions}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-white">Punti di forza</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {sel.pro.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-cyan-300 shrink-0 w-3 text-center" aria-hidden="true">+</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-white">Criticità</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                {sel.contro.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-rose-300 shrink-0 w-3 text-center" aria-hidden="true">−</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-sm text-slate-400 max-w-3xl">
            <span className="text-white font-semibold">In sintesi.</span> {sel.importantNotes}
          </p>
        </section>

        <section className={`${rule} pt-10 space-y-6`}>
          <h2 className={h2}>Quale scegliere</h2>
          <div className="grid grid-cols-3 divide-x divide-slate-800/80">
            <div className="pr-8 space-y-2">
              <h3 className="text-base font-semibold text-white">Per la movida: C, Mapo</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                A pari merito comodità e posizione. Per i tre che restano costa circa <strong className="text-white">26-31 € a testa in più</strong> rispetto a B e D, ma risparmi tempo e taxi la notte. Hongdae a 1 sola fermata di AREX.
              </p>
            </div>
            <div className="px-8 space-y-2">
              <h3 className="text-base font-semibold text-white">Per spendere meno: A, Myeongdong</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Se i letti bastano per quattro e non temete le scale del 4° piano. Per i tre che restano sono <strong className="text-white">125 € a testa (Pietro 50 €)</strong>, circa 95 € in meno di Mapo.
              </p>
            </div>
            <div className="pl-8 space-y-2">
              <h3 className="text-base font-semibold text-white">Per dormire meglio: D, Sinseol-dong</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                3 letti queen size veri e 2 camere separate. Contro: con la serata fuori diventa più scomoda per il rientro notturno dopo l'1:00.
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-slate-400 max-w-3xl">
            <p><strong className="text-slate-200">B, Seoul Station</strong> ha senso solo se conta molto la stazione: in genere A o C battono B.</p>
            <p>
              <strong className="text-slate-200">Prima di prenotare</strong> controlla che le date siano 2-19 marzo (17 notti) e chiedi all'host: letti e biancheria, check-in anticipato il 2 marzo (atterraggio alle 11:40), deposito bagagli il 19 se serve.
            </p>
          </div>
        </section>

        <section className={`${rule} pt-10 space-y-6`}>
          <h2 className={h2}>Cancellazione e pagamento</h2>
          <p className="text-sm text-slate-400 -mt-3">Valgono per tutti e quattro gli alloggi.</p>
          <div className="grid grid-cols-2 divide-x divide-slate-800/80 text-sm text-slate-300">
            <div className="pr-10 space-y-2.5">
              <h3 className="text-base font-semibold text-white">Rimborsi Enko</h3>
              <p><strong className="text-white">Prima dell'approvazione:</strong> rimborso totale se l'host non conferma entro 24 ore.</p>
              <p><strong className="text-white">Dopo l'approvazione:</strong> rimborso totale entro 24 ore dal pagamento, poi parziale in base alla data di ingresso.</p>
              <p><strong className="text-white">Commissione Enko:</strong> non è rimborsabile dopo le 24 ore.</p>
              <p><strong className="text-white">Annuncio Mapo:</strong> rimborso quasi totale fino al 17 gennaio, 10% di penale fino al 31 gennaio, 50% fino al 16 febbraio, 70% fino al 23 febbraio, 100% fino al 2 marzo.</p>
            </div>
            <div className="pl-10 space-y-2.5">
              <h3 className="text-base font-semibold text-white">Consigli e costi extra</h3>
              <p><strong className="text-white">Consigliato:</strong> chiedere la prenotazione, pagare entro le 24 ore e solo dopo comprare il volo, così si cancella gratis se qualcosa non torna.</p>
              <p><strong className="text-white">Luce e utenze:</strong> la luce si paga a parte a fine soggiorno (annuncio A); le utenze hanno una quota fissa con extra oltre il limite.</p>
              <p><strong className="text-white">Annuncio C, Mapo:</strong> monolocale con divano letto per 4 persone (spazio stretto), biancheria non fornita (da chiedere all'host), niente prodotti da bagno, check-in dalle 16:00 e check-out alle 11:00.</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header Banner */}
      <div
        className={
          isDesktop
            ? 'pb-6 border-b border-white/[0.06] space-y-4'
            : 'bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 rounded-2xl p-6 shadow-xl space-y-4'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold font-display text-white lg:hidden">
                Dove Dormire: 4 Alloggi a Confronto
              </h2>
              <p className="text-xs text-slate-400">
                Enko Stay · 2-19 marzo 2027 (17 notti) · 4 persone all'inizio (Pietro riparte il 10 marzo, gli altri 3 fino al 19)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-full bg-blue-950/60 text-blue-300 border border-blue-500/40 font-mono flex items-center gap-1.5">
              <span>Base ipotizzata: Mapo / Hongdae</span>
            </span>
          </div>
        </div>

        <FoldText className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Gli annunci mostrano un prezzo mensile (non il totale del soggiorno). I totali in euro qui sotto sono quelli mostrati dal sito per le date scelte (commissione Enko inclusa), per le 17 notti (2-19 marzo). Nessun annuncio indica indirizzo preciso, numero di letti o metratura: le distanze a piedi sono quelle dichiarate dagli host, il resto sono stime da verificare su Naver Map.
        </FoldText>

        {/* Votazione del gruppo */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
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
                    Hai votato l'alloggio <strong className="text-slate-200">{accs.find((a) => a.id === myVote)?.code}</strong>. Clicca di nuovo sul cuore per ritirare il voto.
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
      <div
        className={
          isDesktop
            ? 'pt-6 space-y-4'
            : 'bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4'
        }
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm sm:text-base">
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
              {accs.map((acc) => (
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
            Esempio di calcolo per C (748 €, 44 € a notte):
          </strong>
          <p>
            Pietro paga 8 × 44 / 4 = <strong className="text-amber-300">88 €</strong>. Ognuno dei tre paga 88 € per le notti in comune (2-9 marzo) più 9 × 44 / 3 = 132 € per le notti dal 10 al 18, cioè <strong className="text-emerald-400">220 €</strong>. Importi arrotondati all'euro.
          </p>
        </div>
      </div>

      {/* 4 Cards Grid Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {accs.map((acc) => {
          const isSelected = selectedAccId === acc.id;

          return (
            <div
              key={acc.id}
              onClick={() => setSelectedAccId(acc.id)}
              className={`p-5 rounded-2xl transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                isDesktop
                  ? isSelected
                    ? 'bg-white/[0.06] border-l-2 border-cyan-400'
                    : 'bg-white/[0.02] border-l-2 border-transparent hover:bg-white/[0.04]'
                  : `border ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-500/70 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                        : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                    }`
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
                  <PriceEditor key={acc.id} accId={acc.id} current={acc.totalEur17Nights} canEdit={canEditPrice} />

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
        const acc = accs.find((a) => a.id === selectedAccId) || accs[0];

        return (
          <div
            className={
              isDesktop
                ? 'pt-8 border-t border-white/[0.06] space-y-6'
                : 'bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6'
            }
          >
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
                  <span>Vedi sulla Mappa & Dintorni</span>
                </button>
              </div>
            </div>

            {/* Spec grid con quote ripartite */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
                <span className="font-bold text-cyan-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                  Divisione Spesa Fissata
                </span>
                <div className="text-lg font-bold font-mono text-white">
                  {acc.totalEur17Nights} € totali
                </div>
                <PriceEditor key={acc.id} accId={acc.id} current={acc.totalEur17Nights} canEdit={canEditPrice} />
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
              <strong className="text-cyan-300 block">Nota di sintesi dal documento:</strong>
              <p>{acc.importantNotes}</p>
            </div>
          </div>
        );
      })()}

      {/* Guide: "Quale Scegliere" (from Page 3 of PDF) */}
      <div
        className={
          isDesktop
            ? 'pt-6 border-t border-white/[0.06] space-y-4'
            : 'bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4'
        }
      >
        <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
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
      <div
        className={
          isDesktop
            ? 'pt-6 border-t border-white/[0.06] space-y-4 text-xs'
            : 'bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs'
        }
      >
        <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
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
