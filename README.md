# Seul 2027 · Viaggio di Gruppo

Portale del viaggio a Seul (2–19 marzo 2027): itinerario, alloggi a confronto con voto del gruppo, mappa, voli, preventivo, guida e partecipanti.

- **Accesso solo con Google** (Firebase Authentication). Nessun altro metodo di registrazione.
- Al primo accesso ognuno compila il **profilo viaggiatore** (nome, cognome, data di nascita, posto nel gruppo, telefono, contatto di emergenza, passaporto, K-ETA, preferenze).
- **Voti sugli alloggi** e **partecipanti** condivisi in tempo reale tramite Firestore.
- Nessun server da gestire: il sito è statico (GitHub Pages) e i dati stanno su Firebase, entrambi gratuiti.

Gli altri partecipanti vedono solo nome, posto, foto, telefono, preferenza alimentare e voto sull'alloggio. Documenti, data di nascita, contatti di emergenza e allergie restano visibili solo al titolare. Lo garantiscono le regole in [`firestore.rules`](firestore.rules).

---

## Galleria condivisa

Le foto sono salvate in Firestore (Firebase Storage richiede il piano a pagamento), quindi tutti i partecipanti vedono le stesse foto in tempo reale. Prima di caricarle il sito le ridimensiona a 1600 px (JPEG) e crea una miniatura da circa 30 KB; la foto grande si scarica solo quando la si apre. Nei documenti non sono salvati nomi o avatar, solo gli uid: i nomi si ricavano dal profilo di ciascuno.

- Se aggiorni `firestore.rules`, ripubblicalo in Firebase (Firestore → Regole → Pubblica): senza le regole nuove la galleria mostra "Operazione non consentita".
- Piano gratuito (Spark): 1 GiB di spazio, circa 300–500 KB a foto → oltre 2000 foto; 50.000 letture al giorno. Ogni apertura della galleria legge fino a 48 miniature (e i commenti), e "Mostra altre foto" ne aggiunge altre 48.

## Valigia e lista delle cose da portare

Ogni partecipante ha la sua lista, salvata nel documento `packingLists/{uid}` di Firestore: la modifica solo il titolare. Con "Condividi lista" si sceglie chi può leggerla (sola lettura, elenco `sharedWith`) e gli altri possono copiare gli oggetti utili nella propria. La lista è visibile subito anche senza rete: una copia resta nel browser e, se è più recente di quella nel cloud, viene caricata appena possibile. L'etichetta in alto indica se la lista è salvata nel cloud o solo su quel dispositivo.

- Come per la galleria, servono le regole aggiornate in `firestore.rules` (Firestore → Regole → Pubblica), altrimenti la lista resta solo sul dispositivo.
- Il promemoria `.ics` (28 febbraio) si importa in Calendario/Promemoria; "Google Keep" copia il testo negli appunti da incollare nella nota.

## Linee della metro sulla mappa

Nella scheda **Mappa** le linee metro (1–9, AREX, Gyeongui-Jungang, Suin-Bundang, Shinbundang e le altre linee dell'area di Seul, 24 in tutto) sono disegnate dal sito sopra la mappa Google, da cui sono state tolte le linee originali.

- Pannello **Metro & AREX**: mostra/nascondi ogni linea, preset "Principali / Tutte / Nessuna", ricerca stazioni, elenco ordinato delle stazioni della linea selezionata con gli interscambi.
- Sulla mappa: passa sopra una linea per il nome, cliccala per evidenziarla (le altre si attenuano e compaiono i nomi delle stazioni), clicca una stazione per le linee che la servono e i link a Naver Map e Google Maps. Il pulsante in alto a destra spegne e riaccende tutte le linee.
- Le scelte restano salvate nel browser di ognuno.

I tracciati vengono dai binari reali di [OpenStreetMap](https://www.openstreetmap.org/copyright) (dati ODbL, attribuzione obbligatoria, già presente sulla mappa) tramite il progetto `kimmdr2/metroscope`, con precisione di circa 3 metri. Sono nel file `src/data/seoulMetro.json` (circa 60 KB compressi, scaricato solo quando si apre la mappa); i nomi inglesi delle stazioni sono quelli ufficiali per le stazioni principali e la romanizzazione ufficiale coreana per le altre.
