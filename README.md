# Seul 2027 · Viaggio di gruppo

Portale del viaggio a Seul e Pechino (1–20 marzo 2027, quattro amici): copertina, **Oggi** con il conto alla rovescia, itinerario riassunto giorno per giorno, alloggi a confronto con voto del gruppo, mappa, voli e scalo, meteo, spese, galleria, valigia, wallet, guida e SOS.

**Versione 3.0.0.** Questa versione rifà l'interfaccia desktop e introduce gli indirizzi diretti delle pagine. Il telefono mantiene il layout di prima.

---

## Cosa c'è

- **Copertina desktop** con video di sfondo e accesso alle sezioni.
- **Oggi**: conto alla rovescia verso il ritrovo a Malpensa, programma del giorno con riassunti brevi (il dettaglio si apre con "Dettagli"), meteo, promemoria, stato del gruppo.
- **Itinerario**: tutti i giorni, con le tappe e i loro riassunti. Ogni tappa ha un testo completo e uno breve.
- **Alloggi**: quattro proposte a confronto, voto del gruppo e totali calcolati per chi resta 17 notti e per chi riparte il 10 marzo. Il Posto 1 può aggiornare il prezzo totale di un alloggio, e il nuovo prezzo vale per tutti.
- **Mappa**: alloggi, tappe, Metro e AREX, percorsi, con le icone per categoria. Su desktop il pannello è a sinistra, la mappa occupa il resto.
- **Voli e scalo**: Milano–Seul con Air China e scalo a Pechino (permesso di transito di 240 ore), con le schede dei tratti.
- **Meteo**: condizioni attuali, previsioni, clima di marzo e orario.
- **Spese**: chi ha pagato e come si divide, saldi, riepilogo per persona. Aggiunge spese chiunque nel gruppo; modifica ed elimina solo chi l'ha creata o chi l'ha pagata.
- **Galleria condivisa**: foto e video del gruppo, tag dei partecipanti, mi piace e commenti in tempo reale.
- **Valigia e Preventivo**: liste personali (condivisibili in sola lettura) e stima dei costi.
- **Wallet**: biglietti, voucher e prenotazioni, anche senza rete.
- **SOS**: numeri di emergenza, posizione, frasi in coreano, mostra al tassista.
- **Guida e PDF**: consigli pratici e l'itinerario scaricabile.
- **Partecipanti e "Il gruppo adesso"**: chi è a casa, chi condivide la posizione, ritrovi e punti fissi, avviso "ho perso il gruppo".
- **Novità**: changelog generato dai commit.

## Accesso

- Accesso **solo con Google** (Firebase Authentication).
- Al primo accesso ognuno compila il proprio profilo viaggiatore e sceglie il posto nel gruppo.
- I campi del profilo sono privati per default. Ogni campo ha l'interruttore "Visibile al gruppo". Lo garantiscono le regole in [`firestore.rules`](firestore.rules).

## Indirizzi diretti

Su desktop nel browser la scheda aperta si riflette nell'indirizzo, così una pagina si può condividere:

```
https://…/?p=map          apre la Mappa
https://…/?p=accommodations
```

Pagine disponibili: `today`, `itinerary`, `accommodations`, `map`, `weather`, `gallery`, `packing`, `expenses`, `flights`, `budget`, `guide`, `pdf`, `group`, `changelog`, `wallet`, `show`, `places`, `sos`. Il vecchio `?tab=` continua a funzionare. Un indirizzo con una pagina sconosciuta apre la copertina.

Il login non fa perdere la pagina richiesta: se l'accesso riporta alla home, la pagina viene riaperta. Sul telefono e nell'app installata l'indirizzo non cambia.

## Regole Firestore (da pubblicare)

Le funzioni di questa versione richiedono le regole in `firestore.rules`. Senza di esse galleria, valigia, spese e prezzi degli alloggi mostrano "Operazione non consentita".

1. Apri Firebase Console → Firestore Database → Regole.
2. Incolla il contenuto di `firestore.rules`.
3. Clicca **Pubblica**.

Le regole nuove aggiungono la raccolta `accommodationPrices`, in cui solo il titolare del Posto 1 può scrivere.

## Sviluppo

Requisiti: Node.js recente.

```bash
npm install
npm run dev      # sviluppo su http://localhost:3000
npm run build    # build di produzione in dist/
```

Lo stack è React 19, Vite, Tailwind CSS 4, lucide-react e Firebase (Auth, Firestore). Le icone della mappa sono in `src/components/map/categoryIcons.ts`.

Il file `src/firebase/config.ts` contiene la configurazione pubblica del progetto Firebase; non ci sono chiavi segrete nel repository. Le notifiche push leggono la chiave VAPID da `src/firebase/push.config.ts`.

## Pubblicazione

Il sito è statico e viene pubblicato su **GitHub Pages** dal ramo `main`. Non servono server: i dati stanno su Firebase, con il piano gratuito.

Piano gratuito (Spark): la galleria tiene circa 2000 foto e ogni apertura legge fino a 48 miniature.

## Struttura

```
src/
  App.tsx                 navigazione tra le pagine e indirizzi (?p=)
  pageAddress.ts          lettura e scrittura dell'indirizzo della pagina
  components/             una vista per pagina
  components/desktop/     copertina, intestazioni e barra laterale desktop
  components/group/       "Il gruppo adesso"
  components/map/         mappa, pannelli e icone per categoria
  data/tripData.ts        itinerario (con i riassunti), alloggi, luoghi
  services/               accesso ai dati condivisi (Firestore)
  firebase/               configurazione Firebase
firestore.rules           regole di accesso ai dati condivisi
```

## Note

- Il telefono ha un layout dedicato. Le modifiche di questa versione per i grandi schermi valgono solo da 1024 px in su.
- I dati dell'itinerario, degli alloggi e dei numeri di emergenza vanno verificati prima della partenza.
