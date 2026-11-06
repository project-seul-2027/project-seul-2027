# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Gruppo di amici italiani in viaggio a Seul nel 2027 (voli Milano–Pechino–Seul, scalo di 240 h a Pechino). Usano l'app dal telefono (PWA), spesso in giro, con poca rete e a volte offline. Il programma è modificabile dal "Posto 1" (organizzatore). Accesso con Google.

## Product Purpose
Un solo posto per tutto il viaggio del gruppo: itinerario di 20 giorni, voli e scalo, alloggi con voto, spese, galleria condivisa, valigia, guida pratica, mappa e metro, frasi in coreano. Successo: durante il viaggio ognuno sa subito cosa viene dopo e dove andare, senza cercare tra chat, PDF e mappe.

## Positioning
Tutto il viaggio del gruppo in un'unica app, sincronizzata tra i telefoni, utilizzabile offline e in italiano, al posto di Google Maps + chat di gruppo + PDF.

## Operating Context
Telefono in mano, in strada, in metro o in aeroporto; ore e fusi diversi (Italia, Pechino, Corea). L'itinerario può essere caricato da un PDF (Firestore, `appFiles/itineraryPdf`) e ogni dispositivo ne tiene una copia offline.

## Capabilities and Constraints
- Stack esistente: React 19, Vite, Tailwind 4, Firebase; mappa con Leaflet, dati metro di Seul.
- Redesign in corso solo per telefono (viewport < 1024 px); il desktop resta invariato e i token globali `app-*` non si cambiano.
- Lingua dell'interfaccia: italiano.
- Nessun conto alla rovescia in giorni prima della partenza (richiesta esplicita).
- Dettagli ancora da verificare con fonti ufficiali: le cinque righe "In breve" della Guida (prese, mance, T-money, emergenze).

## Brand Commitments
Vincoli visivi già espressi dall'utente e vincolanti: sentence case, un solo blu di fondo `#0a1119`, niente gradienti, niente cornici colorate, giallo usato poco, stile "pulito, elegante, non vibe-coded". Il mockup mobile approvato è la guida visiva. Questi vincoli sono registrati, non ampliati qui.

## Evidence on Hand
Mockup mobile approvato (artifact Design) e `HANDOFF-seul-2027.md`; dati reali in `src/data/tripData.ts` (voli, alloggi, itinerario, checklist, luoghi). Non ci sono testimonianze, metriche d'uso o altre prove: non inventarne.

## Product Principles
- Prima ciò che serve adesso: la prossima tappa, l'orario, il luogo.
- Meno testo: riassunti brevi, dettagli su richiesta.
- Coerenza prima della novità: stessi pulsanti, allineamenti e altezze in tutta l'app.
- Funziona con poca rete: i dati essenziali restano disponibili offline.
- I colori hanno un significato fisso e non sono decorazione.

## Accessibility & Inclusion
Nessun requisito specifico dichiarato; si assume come base il contrasto leggibile all'aperto e aree di tocco di almeno 44 px (già in uso nell'app).
