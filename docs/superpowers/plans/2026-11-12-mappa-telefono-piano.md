# Piano: mappa del telefono

Ogni tappa si può provare da sola nell'anteprima a 375×812.

1. Servizi base: `src/map/geo.ts` (distanza, minuti a piedi, formato), `src/map/searchIndex.ts` (indice e ricerca offline, recenti), `src/map/walkRoute.ts` (OSRM + ripiego).
2. Ricerca unica sul telefono: `src/map/MapSearch.tsx` al posto del campo attuale; risultati locali, OpenStreetMap, Naver/Kakao.
3. Scheda del posto: distanza, Vai a piedi, Metro, Salva, link esterni; punto toccato a lungo sulla mappa; stazioni come posti.
4. Vicino a me: nuova scheda del foglio.
5. Percorso a piedi e Vai: modalità `walk` in `InteractiveMap`, tracciato, pannello, cono della bussola, Wake Lock.
6. Uscite metro: script Overpass, dati, livello sulla mappa, scheda stazione.
7. Verifica finale: typecheck, 375×812 e 1280×800 (desktop invariato).
