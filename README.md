# Seul 2027 · Viaggio di Gruppo

Portale del viaggio a Seul (2–19 marzo 2027): itinerario, alloggi a confronto con voto del gruppo, mappa, voli, preventivo, guida e partecipanti.

- **Accesso solo con Google** (Firebase Authentication). Nessun altro metodo di registrazione.
- Al primo accesso ognuno compila il **profilo viaggiatore** (nome, cognome, data di nascita, posto nel gruppo, telefono, contatto di emergenza, passaporto, K-ETA, preferenze).
- **Voti sugli alloggi** e **partecipanti** condivisi in tempo reale tramite Firestore.
- Nessun server da gestire: il sito è statico (GitHub Pages) e i dati stanno su Firebase, entrambi gratuiti.

Gli altri partecipanti vedono solo nome, posto, foto, telefono, preferenza alimentare e voto sull'alloggio. Documenti, data di nascita, contatti di emergenza e allergie restano visibili solo al titolare. Lo garantiscono le regole in [`firestore.rules`](firestore.rules).

---

## Configurazione (una volta sola, circa 15 minuti)

### 1. Crea il progetto Firebase

1. Vai su <https://console.firebase.google.com> e accedi con il tuo account Google.
2. **Crea un progetto** → nome per esempio `seul-2027`. Google Analytics non serve: puoi disattivarlo.
3. Il piano gratuito (**Spark**) basta: non serve inserire una carta.

### 2. Attiva l'accesso con Google

1. Menu a sinistra **Build → Authentication** → **Inizia**.
2. Scheda **Metodo di accesso** → **Google** → **Abilita**, scegli la tua email come "email di supporto" → **Salva**.

### 3. Crea il database Firestore

1. **Build → Firestore Database** → **Crea database**.
2. Se te lo chiede, scegli l'edizione **Standard**.
3. Località: una europea (per esempio `eur3 (Europe)`). Non si potrà cambiare dopo.
4. Modalità: **produzione**.

### 4. Pubblica le regole di sicurezza

1. In Firestore apri la scheda **Regole**.
2. Cancella tutto, incolla il contenuto del file [`firestore.rules`](firestore.rules) di questo progetto → **Pubblica**.

### 5. Inserisci le email dei 4 partecipanti

Solo questi account potranno entrare.

1. In Firestore, scheda **Dati** → **+ Avvia raccolta**.
2. ID raccolta: `config` → **Avanti**.
3. ID documento: `access`.
4. Campo: nome `emails`, tipo **array**. Aggiungi 4 valori di tipo **string**, uno per email, **tutte in minuscolo** (per esempio `mario.rossi@gmail.com`).
5. **Salva**.

Per aggiungere o togliere qualcuno in futuro, modifica questo array.

### 6. Collega il sito a Firebase

1. Icona ⚙️ in alto a sinistra → **Impostazioni progetto** → scheda **Generali**.
2. In fondo, "Le tue app" → icona **Web `</>`** → nickname `sito` → **Registra app** (non spuntare Firebase Hosting).
3. Copia i valori di `firebaseConfig` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId) nel file [`src/firebase/config.ts`](src/firebase/config.ts), al posto dei testi `INCOLLA_QUI…`.

Questi valori non sono segreti: possono stare tranquillamente nel repository.

### 7. Prova in locale

```bash
npm install
npm run dev
```

Apri <http://localhost:3000> e accedi con Google. `localhost` è già autorizzato da Firebase.

---

## Pubblicazione su GitHub Pages (gratis)

1. Crea un repository su GitHub. Per GitHub Pages gratuito il repository deve essere **pubblico**. Il codice e l'itinerario saranno visibili, ma i dati personali restano protetti su Firebase e le email dei partecipanti non sono nel codice.
2. Carica il progetto:
   ```bash
   git init
   git add .
   git commit -m "Seul 2027"
   git branch -M main
   git remote add origin https://github.com/TUO-UTENTE/NOME-REPO.git
   git push -u origin main
   ```
3. Su GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Nella scheda **Actions** parte "Pubblica su GitHub Pages". Dopo circa 1 minuto il sito è online su `https://TUO-UTENTE.github.io/NOME-REPO/`.
5. In Firebase: **Authentication → Impostazioni → Domini autorizzati → Aggiungi dominio** → `TUO-UTENTE.github.io`.
6. Manda il link ai tuoi amici.

Ogni `git push` sul ramo `main` ripubblica il sito automaticamente.

---

## Problemi comuni

| Messaggio | Soluzione |
| --- | --- |
| "Firebase non è ancora configurato" | Compila `src/firebase/config.ts` (passo 6). |
| "Questo indirizzo non è autorizzato in Firebase" | Aggiungi il dominio in Authentication → Impostazioni → Domini autorizzati (passo 5 della pubblicazione). |
| "L'account … non è nella lista dei partecipanti" | Aggiungi l'email, in minuscolo, all'array `emails` del documento `config/access` (passo 5). |
| "L'accesso con Google non è attivo" | Abilita Google in Authentication → Metodo di accesso (passo 2). |
| "Il browser ha bloccato la finestra di Google" | Consenti i popup per il sito. |

## Struttura dei dati (Firestore)

| Percorso | Contenuto | Chi lo legge |
| --- | --- | --- |
| `config/access` | `emails`: partecipanti ammessi | nessuno dall'app (solo console) |
| `users/{uid}` | profilo completo | solo il titolare |
| `members/{uid}` | nome, posto, foto, telefono, dieta, voto alloggio | tutti i partecipanti |
| `slots/t1…t4` | `{ uid }` di chi occupa il posto | tutti i partecipanti |

## Linee della metro sulla mappa

Nella scheda **Mappa** le linee metro (1–9, AREX, Gyeongui-Jungang, Suin-Bundang, Shinbundang e le altre linee dell'area di Seul, 24 in tutto) sono disegnate dal sito sopra la mappa Google, da cui sono state tolte le linee originali.

- Pannello **Metro & AREX**: mostra/nascondi ogni linea, preset "Principali / Tutte / Nessuna", ricerca stazioni, elenco ordinato delle stazioni della linea selezionata con gli interscambi.
- Sulla mappa: passa sopra una linea per il nome, cliccala per evidenziarla (le altre si attenuano e compaiono i nomi delle stazioni), clicca una stazione per le linee che la servono e i link a Naver Map e Google Maps. Il pulsante in alto a destra spegne e riaccende tutte le linee.
- Le scelte restano salvate nel browser di ognuno.

I tracciati vengono dai binari reali di [OpenStreetMap](https://www.openstreetmap.org/copyright) (dati ODbL, attribuzione obbligatoria, già presente sulla mappa) tramite il progetto `kimmdr2/metroscope`, con precisione di circa 3 metri. Sono nel file `src/data/seoulMetro.json` (circa 60 KB compressi, scaricato solo quando si apre la mappa); i nomi inglesi delle stazioni sono quelli ufficiali per le stazioni principali e la romanizzazione ufficiale coreana per le altre.
