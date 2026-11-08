/**
 * Prova dell'API AeroDataBox (storico di un volo su un intervallo di date).
 * Serve solo a vedere che dati arrivano davvero prima di scrivere le statistiche: non salva nulla.
 *
 * Uso (PowerShell):
 *   $env:RAPIDAPI_KEY = "la-tua-chiave"
 *   node scripts/flight-probe.mjs CA950            # ultimi 7 giorni
 *   node scripts/flight-probe.mjs CA950 14         # ultimi 14 giorni
 *
 * La chiave si legge solo dalla variabile d'ambiente e non viene mai stampata.
 */
const key = process.env.RAPIDAPI_KEY;
if (!key) {
  console.error('RAPIDAPI_KEY non impostata.');
  process.exit(1);
}
// Modo "delays": statistiche già aggregate dall'API (node scripts/flight-probe.mjs delays CA950)
if (process.argv[2] === 'delays') {
  const f = (process.argv[3] || 'CA950').replace(/\s+/g, '').toUpperCase();
  const r = await fetch(`https://aerodatabox.p.rapidapi.com/flights/${f}/delays`, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'aerodatabox.p.rapidapi.com' },
  });
  console.log(`GET /flights/${f}/delays  Stato:`, r.status);
  for (const h of ['x-ratelimit-requests-remaining', 'x-ratelimit-requests-limit']) {
    const v = r.headers.get(h);
    if (v) console.log(`${h}: ${v}`);
  }
  console.log((await r.text()).slice(0, 4000));
  setTimeout(() => process.exit(0), 50); await new Promise(() => {});
}
const flight = (process.argv[2] || 'CA950').replace(/\s+/g, '').toUpperCase();
const days = Math.max(1, Number(process.argv[3]) || 7);

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const end = new Date();
end.setHours(0, 0, 0, 0);
const start = new Date(end.getTime() - days * 86400000);

const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flight}/${fmt(start)}/${fmt(end)}?dateLocalRole=Both&withAircraftImage=false&withLocation=false`;
console.log(`GET /flights/number/${flight}/${fmt(start)}/${fmt(end)}`);

const res = await fetch(url, {
  headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'aerodatabox.p.rapidapi.com' },
});
console.log('Stato:', res.status);
for (const h of ['x-ratelimit-requests-remaining', 'x-ratelimit-requests-limit', 'x-ratelimit-requests-reset']) {
  const v = res.headers.get(h);
  if (v) console.log(`${h}: ${v}`);
}
const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  console.log('Risposta non JSON:', text.slice(0, 500));
  setTimeout(() => process.exit(0), 50); await new Promise(() => {});
}
if (!Array.isArray(body)) {
  console.log('Risposta:', JSON.stringify(body).slice(0, 800));
  setTimeout(() => process.exit(0), 50); await new Promise(() => {});
}
console.log('Voli restituiti:', body.length);
const shape = (f) => ({
  number: f.number,
  status: f.status,
  dep: f.departure && {
    airport: f.departure.airport?.iata,
    scheduledTime: f.departure.scheduledTime,
    revisedTime: f.departure.revisedTime,
    runwayTime: f.departure.runwayTime,
  },
  arr: f.arrival && {
    airport: f.arrival.airport?.iata,
    scheduledTime: f.arrival.scheduledTime,
    revisedTime: f.arrival.revisedTime,
    runwayTime: f.arrival.runwayTime,
  },
});
console.log('Primi 2 voli (campi orari):');
console.log(JSON.stringify(body.slice(0, 2).map(shape), null, 2));
console.log('Chiavi di un volo:', body[0] ? Object.keys(body[0]).join(', ') : '-');
