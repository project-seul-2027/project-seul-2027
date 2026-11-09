import React, { useState } from 'react';
import { formatAccommodationEur, type AccommodationOption } from '../../data/tripData';
import './mobile.css';

const TONE: Record<string, string> = { A: '', B: 'ms-vi', C: 'ms-pk', D: 'ms-am' };
const eur = formatAccommodationEur;

interface Props {
  accs: AccommodationOption[];
  myVote: string | null;
  votes: Record<string, number>;
  leadingId: string | null;
  totalVotes: number;
  voteError: string | null;
  busy: boolean;
  onVote: (id: string) => void;
  onOpen: (id: string) => void;
}

/** Alloggi del telefono, come nel mockup: lettera grande, nome, prezzo a testa a destra e voto come link. */
export const MobileAlloggi: React.FC<Props> = ({ accs, myVote, votes, leadingId, totalVotes, voteError, busy, onVote, onOpen }) => {
  const [showPietroShare, setShowPietroShare] = useState(false);
  return (
  <div data-testid="mobile-alloggi">
    <p className="ms-mute" style={{ paddingBottom: 14 }}>
      17 notti con Enko Stay, dal 2 al 19 marzo. Prezzo individuale in base al periodo di permanenza.
      {totalVotes > 0 && ' Hanno votato ' + totalVotes + ' su 4.'} Tocca un alloggio per i dettagli.
    </p>
    {accs.map((a) => {
      const mine = myVote === a.id;
      const n = votes[a.id] ?? 0;
      return (
        <div className={`ms-acc${a.id === leadingId ? ' pick' : ''}`} key={a.id} onClick={() => onOpen(a.id)} style={{ cursor: 'pointer' }}>
          <span className={`c ${TONE[a.code]}`}>{a.code}</span>
          <div>
            <h3><button type="button" onClick={() => onOpen(a.id)} data-testid={`open-${a.id}`} style={{ all: 'inherit', cursor: 'pointer', textAlign: 'left', padding: 0 }}>{a.district}</button></h3>
            <p>{a.highlightBadge.replace(/\s*\(.*\)$/, '')}.</p>
            <button type="button" className="ms-vote" aria-pressed={mine} disabled={busy} onClick={(e) => { e.stopPropagation(); onVote(a.id); }}>
              {mine ? `✓ Votato ${a.code}, ritira` : `Vota ${a.code}`}{n > 0 && !mine ? ` (${n})` : ''}
            </button>
          </div>
          <div className="pp">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowPietroShare((value) => !value); }}
              aria-label={`Mostra quota ${showPietroShare ? 'degli altri tre' : 'di Pietro'} per l'alloggio ${a.code}`}
              className="alloggio-price-toggle block text-right rounded-lg focus-visible:outline-2 focus-visible:outline-[#52d9e6]"
              data-testid={`alloggio-price-toggle-${a.code}`}
            >
              <span className="ms-key key block">{eur(showPietroShare ? a.pietroCost8Nights : a.other3Cost17Nights)}</span>
              <span className="block mt-1 text-[12px] text-[#52d9e6]">{showPietroShare ? 'Pietro · 8 notti' : 'Ognuno dei 3 · 17 notti'} ↻</span>
            </button>
            <span>{eur(a.totalEur17Nights)} in tutto</span>
          </div>
        </div>
      );
    })}
    {voteError && <p role="alert" style={{ color: '#f87171', fontSize: 14 }}>{voteError}</p>}
    <p className="ms-h2" style={{ margin: '22px 0 4px' }}>Dettagli e divisione</p>
  </div>
  );
};
