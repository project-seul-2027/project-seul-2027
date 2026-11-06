import React from 'react';
import { FLIGHTS_SCHEDULE, FLIGHTS_BOOKING_URL } from '../../data/tripData';
import './mobile.css';

/** Voli del telefono, come nel mockup: codici aeroporto grandi, linea colorata (ciano andata, ambra ritorno), scalo con filetto ambra. */
const day = (d: string) => d.replace(/ 2027$/, '').replace('marzo', 'mar');

const Leg: React.FC<{ id: string; color: string; showDate?: boolean; meta: string; arrNote?: string }> = ({ id, color, showDate = true, meta, arrNote }) => {
  const l = FLIGHTS_SCHEDULE.find((f) => f.id === id);
  if (!l) return null;
  return (
    <div className="ms-leg" style={showDate ? undefined : { borderTop: 0, paddingTop: 4 }}>
      <div className="ms-route">
        <div>
          <p className="code">{l.departureAirportCode}</p>
          <p className="tm">{l.departureTime}{showDate && <> <span>{day(l.departureDate)}</span></>}</p>
        </div>
        <div className="ln" style={{ background: color }} />
        <div className="r">
          <p className="code">{l.arrivalAirportCode}</p>
          <p className="tm">{l.arrivalTime}{showDate ? <> <span>{day(l.arrivalDate)}</span></> : arrNote ? <> <span>{arrNote}</span></> : null}</p>
        </div>
      </div>
      <p className="ms-meta">{meta}</p>
    </div>
  );
};

export const MobileVoli: React.FC = () => (
  <div data-testid="mobile-voli">
    <h2 className="ms-dir ms-cy">Andata, 1 e 2 marzo</h2>
    <div style={{ marginTop: 10 }}>
      <Leg id="fl_outbound_1" color="var(--ms-accent)" meta="Air China · 10 h · T1, ritrovo entro le 10:00" />
    </div>
    <div className="ms-stop"><strong>Scalo di 3 h 05 a Pechino.</strong> International Transfer, senza uscire.</div>
    <Leg id="fl_outbound_2" color="var(--ms-accent)" showDate={false} arrNote="ora di Seul" meta="Air China · 2 h 10 · bagaglio 23 kg in stiva e 8 kg a mano" />

    <h2 className="ms-dir ms-am" style={{ marginTop: 18 }}>Ritorno, 19 e 20 marzo</h2>
    <div style={{ marginTop: 10 }}>
      <Leg id="fl_inbound_1" color="var(--ms-amber)" meta="Scalo lungo con uscita in città: circa 11 h 55" />
    </div>
    <div className="ms-stop"><strong>Rientro a Pechino entro le 22:45.</strong> Partenza dal centro alle 21:15, check-in al T3.</div>
    <Leg id="fl_inbound_2" color="var(--ms-amber)" meta="Air China · 11 h 35 · bagagli ritirati a Malpensa" />

    <div style={{ paddingTop: 10 }}>
      <a className="ms-link" href={FLIGHTS_BOOKING_URL} target="_blank" rel="noopener noreferrer">Apri i voli su GoToGate</a>
    </div>
  </div>
);
