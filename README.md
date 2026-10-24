# Seul 2027 · Viaggio di Gruppo

Portale del viaggio a Seul (2–19 marzo 2027): itinerario, alloggi a confronto con voto del gruppo, mappa, voli, preventivo, guida e partecipanti.

- **Accesso solo con Google** (Firebase Authentication). Nessun altro metodo di registrazione.
- Al primo accesso ognuno compila il **profilo viaggiatore** (nome, cognome, data di nascita, posto nel gruppo, telefono, contatto di emergenza, passaporto, K-ETA, preferenze).
- **Voti sugli alloggi** e **partecipanti** condivisi in tempo reale tramite Firestore.
- Nessun server da gestire: il sito è statico (GitHub Pages) e i dati stanno su Firebase, entrambi gratuiti.

Gli altri partecipanti vedono sempre nome, posto, foto, telefono, preferenza alimentare e voto sull'alloggio. Gli altri dati del profilo (data di nascita, passaporto, KETA, assicurazione, contatto di emergenza, allergie, budget, note) sono privati per default: ogni campo ha un interruttore "Visibile al gruppo" nel profilo, e solo i campi attivati compaiono nel dettaglio del partecipante (tocca la sua card in "Partecipanti"). I campi non condivisi non vengono salvati nel database condiviso. La foto è quella di Google, ma puoi caricarne una dal telefono (e tornare a quella di Google). Lo garantiscono le regole in [`firestore.rules`](firestore.rules).

---

## Galleria condivisa

Le foto sono salvate in Firestore (Firebase Storage richiede il piano a pagamento), quindi tutti i partecipanti vedono le stesse foto in tempo reale. Prima di caricarle il sito le ridimensiona a 1600 px (JPEG) e crea una miniatura da circa 30 KB; la foto grande si scarica solo quando la si apre. Nei documenti non sono salvati nomi o avatar, solo gli uid: i nomi si ricavano dal profilo di ciascuno.

- Se aggiorni `firestore.rules`, ripubblicalo in Firebase (Firestore → Regole → Pubblica): senza le regole nuove la galleria mostra "Operazione non consentita".
- Piano gratuito (Spark): 1 GiB di spazio, circa 300–500 KB a foto → oltre 2000 foto; 50.000 letture al giorno. Ogni apertura della galleria legge fino a 48 miniature (e i commenti), e "Mostra altre foto" ne aggiunge altre 48.

## Valigia e lista delle cose da portare

Ogni partecipante ha la sua lista, salvata nel documento `packingLists/{uid}` di Firestore: la modifica solo il titolare. Con "Condividi lista" si sceglie chi può leggerla (sola lettura, elenco `sharedWith`) e gli altri possono copiare gli oggetti utili nella propria. La lista è visibile subito anche senza rete: una copia resta nel browser e, se è più recente di quella nel cloud, viene caricata appena possibile. L'etichetta in alto indica se la lista è salvata nel cloud o solo su quel dispositivo.

- Come per la galleria, servono le regole aggiornate in `firestore.rules` (Firestore → Regole → Pubblica), altrimenti la lista resta solo sul dispositivo.
- Il promemoria `.ics` (28 febbraio) si importa in Calendario/Promemoria; "Google Keep" copia il testo negli appunti da incollare nella nota.

## Spese di gruppo

La sezione **Spese** tiene traccia di chi anticipa per gli altri. Ogni spesa è un documento `expenses/{id}` di Firestore, letto da tutti i partecipanti in tempo reale:

- importo in €, ₩ o ¥, convertito in euro con il cambio del momento (salvato nella spesa); i calcoli sono in centesimi, senza errori di arrotondamento;
- chi ha pagato e come si divide: parti uguali tra le persone scelte oppure importi esatti;
- per ogni quota, se è già stata restituita: la segna chi la doveva o chi ha pagato;
- **Saldi**: quanto deve ciascuno a ciascuno, al netto per coppia; "Salda" chiude in un colpo tutte le quote aperte tra due persone;
- **Riepilogo**: per persona quanto ha pagato, la sua quota, quanto deve ancora, quanto ha restituito, quanto deve ricevere e quanto ha ricevuto.

Aggiunge spese chiunque nel gruppo; modifica ed elimina solo chi l'ha creata o chi l'ha pagata. Senza rete le spese restano visibili e le modifiche partono al ritorno della connessione.

- Servono le regole aggiornate in `firestore.rules` (Firestore → Regole → Pubblica), altrimenti compare "Operazione non consentita".

## Changelog e numeri di versione

La scheda **Changelog** (in "Altro" sul telefono, "Novità"/"Changelog" nel menu su computer, oppure toccando il numero di versione nel piè di pagina) elenca gli aggiornamenti pubblicati su GitHub. **Ogni commit è una versione**, e il numero finale sale di 1 a ogni commit, senza limite: 1.0.0, 1.0.1, … 1.0.9, poi dal commit `3a0f64a` (1.1.0) si prosegue con 1.1.1, 1.1.2, … 1.1.10, 1.1.20 e così via.

- L'elenco si crea da solo dalla cronologia git: `scripts/generate-changelog.mjs` gira a ogni `npm run dev` e `npm run build` e scrive `src/data/changelog.generated.json` (ignorato da git, non va modificato). Se il clone è parziale (come quello di GitHub Actions) lo script scarica da solo il resto della cronologia, quindi a ogni push il Changelog si aggiorna e il numero di versione compare nel piè di pagina e nell'avviso "Nuova versione disponibile".
- **Titolo e punti elenco** vengono dal messaggio del commit: la prima riga è il titolo, le righe che iniziano con `- ` diventano voci. Conviene scrivere messaggi chiari, perché sono quello che si legge nella pagina.
- **Per iniziare la serie successiva** (per esempio 1.2.0) aggiungi una riga all'elenco `RELEASES` in `scripts/generate-changelog.mjs` con l'hash del commit che deve diventare 1.2.0: da lì si riparte da 1.2.0, 1.2.1, …
- Senza cronologia git (copia scaricata come zip) il sito funziona lo stesso e la scheda mostra un avviso.
- Se la storia viene riscritta (rebase con force push) i numeri si ricalcolano: lo stesso commit può cambiare numero.

## App per Android e iPhone

Il sito è anche un'app installabile (PWA): si apre a schermo intero dall'icona sulla home, ha una barra di navigazione in basso e funziona anche senza rete con i dati già visti (itinerario, valigia, galleria). Gli aggiornamenti arrivano da soli a ogni push, senza passare dagli store.

- **Android (Chrome):** apri il sito → menu ⋮ → **Installa app**, oppure il pulsante "Installa" che compare nel sito.
- **iPhone/iPad (Safari):** apri il sito → **Condividi** → **Aggiungi alla schermata Home**. Da Chrome su iPhone non si può installare.
- Al primo avvio dell'app installata bisogna accedere di nuovo con Google.

File coinvolti: `public/manifest.webmanifest` (nome, colori, icone), `public/icons/` (icone), `public/sw.js` (service worker per l'uso offline), `src/pwa.ts` (registrazione e pulsante "Installa").

## Linee della metro sulla mappa

Nella scheda **Mappa** le linee metro (1–9, AREX, Gyeongui-Jungang, Suin-Bundang, Shinbundang e le altre linee dell'area di Seul, 24 in tutto) sono disegnate dal sito sopra la mappa Google, da cui sono state tolte le linee originali.

- Pannello **Metro & AREX**: mostra/nascondi ogni linea, preset "Principali / Tutte / Nessuna", ricerca stazioni, elenco ordinato delle stazioni della linea selezionata con gli interscambi.
- Sulla mappa: passa sopra una linea per il nome, cliccala per evidenziarla (le altre si attenuano e compaiono i nomi delle stazioni), clicca una stazione per le linee che la servono e i link a Naver Map e Google Maps. Il pulsante in alto a destra spegne e riaccende tutte le linee.
- Le scelte restano salvate nel browser di ognuno.

I tracciati vengono dai binari reali di [OpenStreetMap](https://www.openstreetmap.org/copyright) (dati ODbL, attribuzione obbligatoria, già presente sulla mappa) tramite il progetto `kimmdr2/metroscope`, con precisione di circa 3 metri. Sono nel file `src/data/seoulMetro.json` (circa 60 KB compressi, scaricato solo quando si apre la mappa); i nomi inglesi delle stazioni sono quelli ufficiali per le stazioni principali e la romanizzazione ufficiale coreana per le altre.
