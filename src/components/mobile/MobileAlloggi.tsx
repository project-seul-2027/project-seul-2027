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
  voteError: string | null;
  busy: boolean;
  onVote: (id: string) => void;
  onOpen: (id: string) => void;
}

/** Alloggi del telefono, come nel mockup: lettera grande, nome, prezzo a testa a destra e voto come link. */
export const MobileAlloggi: React.FC<Props> = ({ accs, myVote, votes, leadingId, voteError, busy, onVote, onOpen }) => {
  const [priceModes, setPriceModes] = useState<Record<string, boolean>>({});
  return (
  <div data-testid="mobile-alloggi">
    <p className="ms-mute" style={{ paddingBottom: 14 }}>17 notti · quota a persona</p>
    {accs.map((a) => {
      const mine = myVote === a.id;
      const n = votes[a.id] ?? 0;
      const showPietroShare = priceModes[a.id] === true;
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
              onClick={(e) => {
                e.stopPropagation();
                setPriceModes((current) => ({ ...current, [a.id]: !current[a.id] }));
              }}
              aria-label={`Mostra quota ${showPietroShare ? 'degli altri tre' : 'di Pietro'} per l'alloggio ${a.code}`}
              className="alloggio-price-toggle block w-full min-w-0 text-right rounded-lg focus-visible:outline-2 focus-visible:outline-[#52d9e6]"
              data-testid={`alloggio-price-toggle-${a.code}`}
            >
              <span key={`${a.id}-${showPietroShare ? 'pietro' : 'gruppo'}`} className="ms-key key price-flash block whitespace-nowrap">{eur(showPietroShare ? a.pietroCost8Nights : a.other3Cost17Nights)}</span>
              <span className="mt-1 block whitespace-nowrap text-[clamp(10px,3vw,12px)] text-[#52d9e6]">{showPietroShare ? 'Pietro · 8 notti' : '3 persone · 17 notti'} ↻</span>
            </button>
            <span className="whitespace-nowrap">{eur(a.totalEur17Nights)} in tutto</span>
          </div>
        </div>
      );
    })}
    {voteError && <p role="alert" style={{ color: '#f87171', fontSize: 14 }}>{voteError}</p>}
    <p className="ms-h2" style={{ margin: '22px 0 4px' }}>Dettagli e divisione</p>
  </div>
  );
};
