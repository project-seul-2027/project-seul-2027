import React, { useEffect, useMemo, useState } from 'react';
import { ACCOMMODATIONS, formatAccommodationEur, priceAccommodation } from '../data/tripData';
import { accommodationPriceService, type PriceOverrides } from '../services/accommodationPriceService';
import { useAuth } from '../auth/AuthContext';
import type { AccommodationId } from '../shared/travelerProfile';
import { useMediaQuery } from '../pwa';
import { MobileAlloggi } from './mobile/MobileAlloggi';
import { MobileAlloggioDetail } from './mobile/MobileAlloggioDetail';
import { SeoulHomeCard } from './SeoulHomeCard';
import './mobile/mobile.css';

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
      <button type="button" onClick={() => { setValue(String(current)); setEditing(true); }} className="min-h-11 text-xs font-semibold text-[#52d9e6] hover:underline underline-offset-2">
        Modifica prezzo totale
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
    <div className="flex flex-wrap items-center gap-2 text-xs py-1" onClick={(e) => e.stopPropagation()}>
      <input
        type="number"
        inputMode="decimal"
        min={1}
        max={20000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Totale 17 notti in euro"
        style={{ borderRadius: 10, background: 'var(--ms-fill, rgba(96,150,214,0.13))' }}
        className="w-28 min-h-11 px-3 text-sm text-[#eaf0f6] tabular-nums outline-none"
      />
      <span className="text-slate-400">€ (17n)</span>
      <button type="button" onClick={save} disabled={saving} style={{ borderRadius: 10, background: '#52d9e6' }} className="min-h-11 px-3.5 text-[#04242a] font-semibold disabled:opacity-50">Salva</button>
      <button type="button" onClick={() => setEditing(false)} className="min-h-11 px-2 text-slate-400 hover:text-white">Annulla</button>
      {error && <span className="text-rose-400 w-full">{error}</span>}
    </div>
  );
};

export const AccommodationsView: React.FC<AccommodationsViewProps> = ({ onViewOnMap }) => {
  const [selectedAccId, setSelectedAccId] = useState<string>('acc_a');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [returnedFromDetail, setReturnedFromDetail] = useState(false);
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
        <SeoulHomeCard variant="full" />
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
                    <td className="py-4 px-4 text-right tabular-nums text-slate-300">{formatAccommodationEur(acc.totalEur17Nights)}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-slate-300">{formatAccommodationEur(acc.pietroCost8Nights)}</td>
                    <td className="py-4 px-4 text-right tabular-nums text-xl font-semibold text-white">{formatAccommodationEur(acc.other3Cost17Nights)}</td>
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
              <a
                href={sel.enkoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-cyan-400 hover:text-cyan-300 underline-offset-2 hover:underline"
              >
                Apri su Enko Stay
              </a>
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
              <p className="text-2xl font-semibold text-white tabular-nums">{formatAccommodationEur(sel.totalEur17Nights)} totali</p>
              <PriceEditor key={sel.id} accId={sel.id} current={sel.totalEur17Nights} canEdit={canEditPrice} />
              <p className="text-sm text-slate-300">Pietro, 8 notti: <span className="text-white font-semibold">{formatAccommodationEur(sel.pietroCost8Nights)}</span></p>
              <p className="text-sm text-slate-300">Ognuno dei 3, 17 notti: <span className="text-white font-semibold">{formatAccommodationEur(sel.other3Cost17Nights)}</span></p>
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

  const detailAcc = detailId ? accs.find((a) => a.id === detailId) : null;
  if (detailAcc) {
    return (
      <MobileAlloggioDetail
        acc={detailAcc}
        mine={myVote === detailAcc.id}
        voters={votersByAcc[detailAcc.id] ?? []}
        busy={isVoting}
        priceEditor={<PriceEditor key={detailAcc.id} accId={detailAcc.id} current={detailAcc.totalEur17Nights} canEdit={canEditPrice} />}
        onBack={() => {
          setReturnedFromDetail(true);
          setDetailId(null);
        }}
        onVote={() => handleVote(detailAcc.id)}
        onMap={() => onViewOnMap(detailAcc.id)}
      />
    );
  }

  return (
    <MobileAlloggi
      accs={accs}
      myVote={myVote}
      votersByAcc={votersByAcc}
      leadingId={leadingVotes > 0 ? leading.id : null}
      voteError={voteError}
      busy={isVoting}
      returnedFromDetail={returnedFromDetail}
      onVote={handleVote}
      onOpen={(id) => {
        setReturnedFromDetail(false);
        setDetailId(id);
      }}
    />
  );
};
