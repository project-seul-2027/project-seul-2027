# Ricerca precisa sulla mappa

La ricerca locale resta offline. Quella online chiama il Worker solo quando l’utente la invia; il client manda il token Firebase ID, non le chiavi provider. Il Worker verifica firma e claim del token, provider Google, email verificata e allowlist dei partecipanti. OpenStreetMap continua a essere interrogato dal client come ripiego; Kakao è opzionale.

Per indirizzi romanizzati come `26-8 Sungindong-gil`, il client normalizza Unicode/trattini e prova anche `Sungin-dong-gil`, con contesto Seoul se assente. I risultati indicano provider e precisione; il civico è preciso solo se coincide con il dato restituito. Il pin geocodificato non garantisce la posizione dell’ingresso.

## Cloudflare Workers Builds

Nel progetto Workers & Pages collegato al repository:

- Root directory: `/workers/map-search`
- Build command: vuoto
- Deploy command: `npx wrangler deploy`

Il file `wrangler.toml` definisce nome, progetto Firebase e origini consentite. Dopo il primo deploy, l’endpoint sarà `https://seul-map-search.<account>.workers.dev`.

## Secret del Worker

Nel dashboard Cloudflare apri **Workers & Pages → seul-map-search → Settings → Variables and Secrets** e aggiungi come **Secret**:

- `ALLOWED_EMAILS`: email dei partecipanti ammesse, separate da virgola.
- `KAKAO_REST_API_KEY`: opzionale, REST API key Kakao.

Non inserire questi valori in `wrangler.toml` o nel repository. Se la chiave Kakao manca, l’app continua con il ripiego OpenStreetMap.

## Client PWA

Nella configurazione di build della PWA aggiungi `VITE_MAP_SEARCH_URL` con l’URL `workers.dev` del Worker. La PWA deve essere ricompilata e pubblicata dopo aver impostato la variabile. Se l’app usa un dominio diverso dai due Firebase URL già ammessi in `APP_ORIGINS`, aggiungilo anche in `workers/map-search/wrangler.toml` e ridistribuisci il Worker.
