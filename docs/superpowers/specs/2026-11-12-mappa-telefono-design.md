# Mappa del telefono: usabile al posto di Naver/Kakao

Data: 12 novembre 2026. Stato: approvata in chat, da realizzare.

## Scopo

Sul telefono la mappa dell'app deve coprire quasi tutto quello che il gruppo fa ogni giorno a Seul: trovare un posto, capire quanto dista, andarci a piedi o in metro, vedere chi è vicino. Per quello che non si può fare gratis (bus, taxi, orari in tempo reale, locali non in OpenStreetMap) si apre Naver o Kakao con un tocco, già sul punto giusto. Palette, token e componenti sono quelli esistenti (`--ms-*`, `#0a1119`, `#52d9e6`, Outfit, Plus Jakarta Sans). Desktop invariato.

## Strada scelta

Leaflet resta, con la metro, il router e lo sfondo offline già fatti. Il "guscio" del telefono (ricerca, scheda del posto, navigazione a piedi, vicino a me) diventa componenti e servizi separati in `src/map/`; `InteractiveMap.tsx` tiene solo mappa e stato.

## Struttura sul telefono

- In alto: una sola barra di ricerca, sempre visibile. Al tocco si apre il pannello dei risultati a tutto schermo sotto la barra.
- In basso: il foglio a tre altezze già esistente, con schede **Vicino a me**, **Tappe**, **Metro**.
- Pulsanti flottanti a destra: livelli, la mia posizione, percorso.

## Ricerca unica (`src/map/searchIndex.ts`, `MapSearch.tsx`)

Un indice in memoria di: tappe dell'itinerario, luoghi salvati dal gruppo, stazioni della metro (nome coreano, inglese, traslitterato). Ricerca offline mentre scrivi, senza accenti e maiuscole, anche per quartiere e categoria. Risultati in ordine: corrispondenza sul nome, poi distanza da dove sei. Poi "Cerca su OpenStreetMap" (rete, un tocco, con l'avviso di precisione già esistente), e in fondo sempre "Cerca su Naver" e "Cerca su Kakao" con il testo scritto. Ricerche recenti (ultime 8, localStorage) a campo vuoto.

## Scheda del posto (foglio)

Stessa scheda per tappe, luoghi salvati, stazioni, risultati OpenStreetMap e punti toccati a lungo sulla mappa. Mostra nome, categoria, quartiere, **distanza e minuti a piedi** da dove sei (se il GPS è attivo). Azioni: **Vai a piedi**, **Metro**, Salva tra i luoghi (se non lo è già), Naver, Kakao, Google Maps.

## Percorso a piedi e modalità Vai (`src/map/walkRoute.ts`, `WalkPanel.tsx`)

- Con rete: tracciato su strada da OSRM (profilo a piedi), distanza, minuti, svolte in italiano con il nome della via.
- Senza rete o errore: linea diretta, stima a 4,5 km/h, con la scritta "stima, senza rete".
- Modalità Vai: la mappa segue la posizione, il pallino ha il cono della direzione dalla bussola, in alto distanza residua, minuti, ora di arrivo e prossima svolta; a 25 m "sei arrivato". Nord in alto. Schermo acceso (Wake Lock) finché si naviga.
- Dal percorso metro: i tratti a piedi iniziale e finale restano stimati come oggi; il bottone "Vai a piedi fino alla stazione" apre la navigazione.

## Metro: uscite e treni

- Uscite numerate da OpenStreetMap (`scripts/metro-exits.mjs` → `src/data/seoulMetroExits.json`, offline). Sulla mappa da zoom 16 in su; nella scheda della stazione l'elenco; nel percorso a piedi verso una stazione, l'uscita più vicina alla meta.
- Treni: primo e ultimo treno, ultima metro, come oggi. Il prossimo treno in tempo reale non si fa: servono una chiave coreana e un server (Blaze). Nella scheda resta lo spazio.

## Vicino a me

Scheda del foglio con tappe e luoghi salvati in ordine di distanza con minuti a piedi, amici con posizione condivisa, ritrovo e punto fisso. Senza GPS: invito ad attivarlo.

## Fuori portata

Bus, taxi, tempo reale, locali non in OpenStreetMap: link a Naver/Kakao. Nessun dato inventato, nessuna rotazione della mappa.

## Verifica

Typecheck; anteprima a 375×812 con il GPS simulato (preset di Seul); percorsi OSRM reali; bussola e Wake Lock solo su telefono vero.
