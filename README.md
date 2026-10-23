# Seul 2027 · Viaggio di Gruppo

Portale del viaggio a Seul (2–19 marzo 2027): itinerario, alloggi a confronto con voto del gruppo, mappa, voli, preventivo, guida e partecipanti.

- **Accesso solo con Google** (Firebase Authentication). Nessun altro metodo di registrazione.
- Al primo accesso ognuno compila il **profilo viaggiatore** (nome, cognome, data di nascita, posto nel gruppo, telefono, contatto di emergenza, passaporto, K-ETA, preferenze).
- **Voti sugli alloggi** e **partecipanti** condivisi in tempo reale tramite Firestore.
- Nessun server da gestire: il sito è statico (GitHub Pages) e i dati stanno su Firebase, entrambi gratuiti.

Gli altri partecipanti vedono solo nome, posto, foto, telefono, preferenza alimentare e voto sull'alloggio. Documenti, data di nascita, contatti di emergenza e allergie restano visibili solo al titolare. Lo garantiscono le regole in [`firestore.rules`](firestore.rules).

---

## Linee della metro sulla mappa

Nella scheda **Mappa** le linee metro (1–9, AREX, Gyeongui-Jungang, Suin-Bundang, Shinbundang e le altre linee dell'area di Seul, 24 in tutto) sono disegnate dal sito sopra la mappa Google, da cui sono state tolte le linee originali.

- Pannello **Metro & AREX**: mostra/nascondi ogni linea, preset "Principali / Tutte / Nessuna", ricerca stazioni, elenco ordinato delle stazioni della linea selezionata con gli interscambi.
- Sulla mappa: passa sopra una linea per il nome, cliccala per evidenziarla (le altre si attenuano e compaiono i nomi delle stazioni), clicca una stazione per le linee che la servono e i link a Naver Map e Google Maps. Il pulsante in alto a destra spegne e riaccende tutte le linee.
- Le scelte restano salvate nel browser di ognuno.

I tracciati vengono dai binari reali di [OpenStreetMap](https://www.openstreetmap.org/copyright) (dati ODbL, attribuzione obbligatoria, già presente sulla mappa) tramite il progetto `kimmdr2/metroscope`, con precisione di circa 3 metri. Sono nel file `src/data/seoulMetro.json` (circa 60 KB compressi, scaricato solo quando si apre la mappa); i nomi inglesi delle stazioni sono quelli ufficiali per le stazioni principali e la romanizzazione ufficiale coreana per le altre.
