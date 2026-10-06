# Avvisi nella PWA — design

Data: 2026-10-05 · Branch: `feature/avvisi-pwa` · Backend: `krumiro2.0_backend` (Cloudflare Worker, già in produzione)

## Obiettivo

Portare nella PWA gli stessi tre avvisi dell'app Android: **uscita prevista**, **rientro dal pranzo**,
**rientro dalla sigaretta**. Nella PWA il browser non può programmare notifiche locali: la PWA invia
l'orario di ogni avviso al backend, che allo scadere manda una notifica **web push**; il service worker
la riceve e la mostra.

Scelte concordate:

- tutti e tre gli avvisi, con gli stessi testi dell'app Android; il **backend non cambia**;
- il backend invia sempre il testo fisso "Pausa finita": la PWA salva il testo vero di ogni avviso
  nella **Cache del browser** e il service worker lo legge in base all'id; se manca usa un testo
  generico del tipo. Sul server non finisce nessun dato delle timbrature, né i testi;
- service worker scritto da noi in TypeScript (`injectManifest` di `vite-plugin-pwa`, approccio A),
  al posto di quello generato (`generateSW`): la logica è tipata e testata come il resto del progetto;
- l'app Android non cambia: continua con le notifiche locali e non usa il backend.

Fuori da questa spec: modifiche al backend, azioni sulla notifica (es. "Timbra rientro"), messaggi
d'errore a schermo quando il server non risponde, push all'app Android.

## Backend (riferimento)

- Base URL: `https://krumiro-notifiche.oliosi-riccardo.workers.dev`.
- `PUT /avvisi/{id}` con corpo `{ "contatto": subscription.toJSON(), "orario": "<ISO 8601 con fuso>" }`
  → `204`; riprogrammare lo stesso id sostituisce l'avviso. Orario tra adesso − 1 h e adesso + 24 h.
- `DELETE /avvisi/{id}` → `204`, idempotente.
- `id`: 1–64 caratteri `[A-Za-z0-9_-]`.
- CORS ammesso per `https://ricky79.github.io` e `http://localhost:5173`.
- Payload della notifica: `{ "tipo": "fine-pausa", "id", "orario": "<ISO UTC>", "titolo": "Pausa finita",
  "testo": "È ora di timbrare il rientro" }`; TTL 15 min; ritardo massimo circa un minuto (cron).
- Push service ammessi: FCM (Chrome, Edge su Android, Samsung Internet), Apple, Mozilla, Microsoft.
- Chiave pubblica VAPID (`applicationServerKey`), da `wrangler.jsonc`:
  `BDMM0_ITU0dc_OrEyil6M1IliUYEiKma7ANcCiK5CVxVIM8LxBWnycBd0NJG_PQpBTadDsQctWsx2z6dMzZb0iA`.
  Se il backend cambia la coppia di chiavi, va aggiornata qui e le iscrizioni vanno rifatte.

## Componenti

| File | Ruolo |
|---|---|
| `src/core/avvisi.ts` | `pianificaAvvisi` invariata. Vi si sposta il tipo `StatoPermessi` (oggi in `native/avvisi.ts`) con i nuovi valori `'da-installare'` e `'da-attivare'` |
| `src/core/avvisiPush.ts` *(nuovo, puro)* | id degli avvisi, confronto piano/inviati, stato dei permessi web, scelta del testo della notifica |
| `src/web/avvisi.ts` *(nuovo)* | come `src/native/avvisi.ts` ma per la PWA: `statoPermessi`, `richiediPermessi`, `sincronizzaAvvisi`, `avviaAvvisi`. Le costanti `URL_NOTIFICHE` e `CHIAVE_VAPID` stanno in `core/avvisiPush.ts`, perché servono anche al service worker |
| `src/sw.ts` *(nuovo)* | service worker: precache, fallback di navigazione, aggiornamento automatico, `push`, `pushsubscriptionchange`, `notificationclick` |
| `src/storage/store.ts` | `ricarica()` e `seguiAltreSchede()`: con più schede aperte i dati si rileggono quando un'altra scheda salva |
| `vite.config.ts` | `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, `injectManifest.globPatterns` uguale all'attuale `workbox.globPatterns`; la build Android resta con `disable: true` |
| `tsconfig.json` / `tsconfig.sw.json` *(nuovo)* | `src/sw.ts` escluso dal tsconfig principale e controllato con `lib: ["ES2022", "WebWorker"]` (incompatibile con `DOM` nello stesso progetto) |
| `package.json` | `typecheck`, `build` e `build:android` eseguono anche `tsc --noEmit -p tsconfig.sw.json`; devDependencies `workbox-core`, `workbox-precaching`, `workbox-routing` (già presenti come dipendenze indirette di `vite-plugin-pwa`, nella stessa versione) |
| `scripts/genera-icone.mjs`, `public/icons/badge-96.png` *(nuovo)* | icona monocromatica `badge` delle notifiche |
| `src/main.ts` | nella PWA, dopo `registraServiceWorker()`, chiama `avviaAvvisi()` di `web/avvisi` |
| `src/ui/impostazioni.ts` | la sezione Avvisi usa `web/avvisi` nella PWA e `native/avvisi` nell'app, con testi diversi |
| `src/ui/aiutoTesti.ts`, `README.md` | avvisi disponibili anche nella PWA, con le differenze |

## Regole pure (`src/core/avvisiPush.ts`)

### Id

- `idAvviso(dispositivo, tipo)` → `` `${dispositivo}-${tipo}` `` (es. `3f2a…-pausa`). `dispositivo` è un
  UUID (`nuovoId()`), quindi l'id rispetta il formato del backend.
- `tipoDaId(id)` → il `TipoAvviso` dopo l'ultimo `-`, oppure `null` se non è `uscita`, `pausa` o `sigaretta`.

### Confronto piano / inviati

Stato salvato (vedi *Dati*): `inviati: Partial<Record<TipoAvviso, Inviato>>` con
`Inviato = { orario: number; titolo: string; testo: string }` (orario in epoch ms).

`operazioniPush(piano, inviati, { ora, endpointCambiato })` riceve il piano con l'istante già
calcolato per ogni avviso e restituisce l'elenco delle operazioni:

- avviso nel piano, senza inviato dello stesso tipo, o con `orario`, `titolo` o `testo` diversi,
  o con `endpointCambiato` → `{ tipo: 'programma', tipoAvviso, orario, titolo, testo }`;
- inviato il cui tipo non è nel piano:
  - con `orario > ora` → `{ tipo: 'annulla', tipoAvviso }`;
  - con `orario ≤ ora` → `{ tipo: 'dimentica', tipoAvviso }`: il server l'ha già spedito (o lo spedisce
    al prossimo giro) e lo cancella da solo; niente `DELETE`, così un avviso appena scaduto ma non
    ancora inviato non viene perso se nel frattempo cambia qualcosa;
- avviso nel piano identico all'inviato → nessuna operazione.

L'istante di ogni avviso è `a.istante ?? istanteDaMinuti(a.minuti, ora)`, come in `native/avvisi.ts`.

### Stato dei permessi

`statoPermessiWeb({ iosNonInstallata, supportato, permesso, iscritto })` → `StatoPermessi`:

1. `iosNonInstallata` (iPhone/iPad aperto nel browser, non dalla Home) → `'da-installare'`;
2. `!supportato` (manca `serviceWorker`, `PushManager` o `Notification`, oppure nessun service worker
   attivo, es. `npm run dev`) → `'non-disponibili'`;
3. `permesso === 'denied'` → `'negati'`;
4. `permesso === 'granted'` → `'concessi'` se `iscritto`, altrimenti `'da-attivare'` (iscrizione
   fallita, persa o fatta con una chiave VAPID vecchia);
5. altrimenti → `'da-chiedere'`.

`stessaChiave(chiaveIscrizione, attuale)`: true se `subscription.options.applicationServerKey` coincide
con `CHIAVE_VAPID`; se il browser non la dice (`null`) la si dà per buona.

`avvisiDaRiprogrammare(voci, scope, ora)`: dalle voci della Cache (coppie indirizzo/contenuto) gli
avvisi con orario futuro e id valido, come `{ id, orario }`; serve al service worker per
`pushsubscriptionchange`.

`opzioniNotifica(notifica)`: `{ body, tag, icon, badge, renotify: true }`. Il tag è uguale ogni giorno
per lo stesso tipo: con `renotify` una notifica che ne sostituisce una ancora visibile suona comunque.

### Testo della notifica

`notificaDaPush(payload, salvato)` → `{ titolo, testo, tag }`, sempre (un push con `userVisibleOnly`
deve mostrare qualcosa):

- `payload` non è un oggetto con `id` stringa (anche `null`, se il push non era JSON) → "Krumiro" /
  "Apri l'app per i dettagli.", `tag` `krumiro`;
- `salvato` presente e `salvato.orario === payload.orario` → titolo e testo salvati;
- altrimenti, se `tipoDaId(payload.id)` è noto → testo generico del tipo:
  - `uscita`: "Puoi andare via" / "Le ore di oggi sono completate.";
  - `pausa`: "Fine pausa pranzo" / "È ora di rientrare.";
  - `sigaretta`: "Pausa sigaretta" / "Rientra prima che diventi permesso.";
- altrimenti → `payload.titolo` / `payload.testo` (con "Krumiro" come titolo se mancano);
- `tag` = `payload.id` (tranne il caso del payload non valido).

## Dati

- Chiave locale `timbrature-avvisi-push` = `{ dispositivo: string, endpoint: string | null, inviati }`.
  Stato del dispositivo, come tema e banner: fuori dai dati e dal backup. Se è illeggibile si riparte
  da `{ dispositivo: nuovoId(), endpoint: null, inviati: {} }`; gli avvisi rimasti sul server con il
  vecchio id scadono da soli entro 24 h.
- Cache `krumiro-avvisi`, una voce per avviso: URL `avvisi/<id>` risolto sullo `scope` della
  registrazione del service worker (lo stesso nella pagina e nel service worker), contenuto JSON
  `{ titolo, testo, orario }` con `orario` in ISO UTC (`toISOString()`, lo stesso formato del payload).
  `cleanupOutdatedCaches` di Workbox non la tocca.

## Flusso nella pagina (`src/web/avvisi.ts`)

### Attivazione — `richiediPermessi()`

Chiamata dal pulsante *Autorizza gli avvisi* (gesto dell'utente, richiesto da Safari):

1. `Notification.requestPermission()`; se non è `granted` → restituisce lo stato.
2. Registrazione del service worker attivo (`navigator.serviceWorker.ready` con timeout di 10 s; senza
   → `'non-disponibili'`).
3. L'iscrizione valida (vedi sotto) oppure `pushManager.subscribe({ userVisibleOnly: true,
   applicationServerKey: CHIAVE_VAPID })`. Se `subscribe` fallisce (offline, push service disattivato)
   lo stato risulta `'da-attivare'`.
4. Sincronizzazione, poi restituisce `statoPermessi()`.

**Iscrizione valida**: `getSubscription()`, ma se `stessaChiave` è falso (il backend ha cambiato la
coppia di chiavi) l'iscrizione si annulla con `unsubscribe()` e vale come assente: in Impostazioni
ricompare il pulsante. Non ci si reiscrive da soli, perché Safari può pretendere un gesto dell'utente.

### Stato — `statoPermessi()`

Raccoglie i dati per `statoPermessiWeb`: `iosNonInstallata` da `piattaforma()` e `inModalitaApp()` di
`ui/installa.ts`; `supportato` dalle API del browser e dalla registrazione del service worker: attiva,
oppure in installazione (prima apertura, anche dell'app appena aggiunta alla Home su iPhone, che ha
dati separati da Safari) e allora la si aspetta fino a 10 s; senza registrazione (es. `npm run dev`)
non si aspetta. `permesso` da `Notification.permission`; `iscritto` dall'iscrizione valida.

### Sincronizzazione — `sincronizzaAvvisi()`

Alle stesse occasioni dell'app Android (avvio, ogni modifica dello store, ritorno in primo piano) più
l'evento `online`. Una esecuzione alla volta, in coda come in `native/avvisi.ts`; un errore inatteso
non blocca la coda.

1. Se `Notification.permission !== 'granted'`, se non c'è una registrazione con worker attivo
   (`getRegistration()`, mai `ready`, che senza service worker non si risolverebbe) o se non c'è
   un'iscrizione valida → non fa nulla. All'avvio non ci si iscrive di nascosto.
2. `pianificaAvvisi(store.giornata(oggi), store.impostazioni, adesso, { ora, inizioSigaretta })`, come
   in Android.
3. `operazioniPush(...)` con `endpointCambiato = stato.endpoint !== subscription.endpoint`.
4. Per ogni operazione, in sequenza:
   - `programma` → `PUT {URL_NOTIFICHE}/avvisi/{id}` con `Content-Type: application/json` e corpo
     `{ contatto: subscription.toJSON(), orario: new Date(orario).toISOString() }`. Con `204`:
     `inviati[tipo] = { orario, titolo, testo }`, scrittura della voce nella Cache, stato salvato;
   - `annulla` → `DELETE {URL_NOTIFICHE}/avvisi/{id}`. Con `204`: rimuove `inviati[tipo]` e la voce
     della Cache, stato salvato;
   - `dimentica` → rimuove solo `inviati[tipo]`, senza chiamate. La voce della Cache resta: il push
     può essere ancora in viaggio e la cancella il service worker dopo averlo mostrato (le voci sono
     al massimo tre, una per tipo, perché la chiave è l'id).

   Ogni chiamata ha un timeout di 10 s (`AbortSignal.timeout`), così una rete bloccata non ferma la coda.
5. Se nessuna operazione `programma` è fallita (anche se non ce n'erano),
   `stato.endpoint = subscription.endpoint`.
6. Una chiamata fallita (rete, `4xx`, `5xx`) lascia quell'avviso com'era nello stato salvato: alla
   prossima occasione il confronto la ripropone. Nessun ciclo di riprova a tempo. Gli errori vanno in
   `console.warn`, senza endpoint né chiavi.

Il testo si scrive nella Cache **dopo** il `PUT` riuscito: se il `PUT` fallisce, nella Cache non resta
un testo che non corrisponde all'orario sul server (e comunque il service worker confronta l'orario).

### Più schede

Ogni scheda tiene i dati in memoria. Con `seguiAltreSchede()` (chiamata da `main.ts`) lo store ascolta
l'evento `storage`: quando un'altra scheda salva la chiave dei dati (o svuota la memoria del sito) li
rilegge e avvisa chi ascolta. Così viste e avvisi ripartono dai dati veri, e una scheda vecchia non
annulla avvisi validi né sovrascrive le timbrature dell'altra.

## Service worker (`src/sw.ts`)

```ts
self.skipWaiting();
clientsClaim();                         // come registerType 'autoUpdate' con generateSW
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
```

- **`push`**: `event.waitUntil(...)`: legge `event.data?.json()` (`null` se manca o non è JSON valido),
  cerca la voce `avvisi/<id>` nella Cache `krumiro-avvisi`, calcola `notificaDaPush`, chiama
  `registration.showNotification(titolo, opzioniNotifica(n))` e poi cancella la voce dalla Cache. Con
  `tag` una notifica dello stesso tipo sostituisce la precedente; con `renotify` suona comunque.
- **`pushsubscriptionchange`**: il browser ha rinnovato l'iscrizione (di rado, anche ad app chiusa).
  Il service worker prende la nuova iscrizione (`newSubscription`, oppure `subscribe` con la stessa
  chiave) e rifà il `PUT` degli avvisi di `avvisiDaRiprogrammare` sulle voci della Cache. Alla
  prossima apertura la pagina vede l'endpoint cambiato e riprogramma comunque tutto.
- **Badge**: `public/icons/badge-96.png`, l'orologio bianco su fondo trasparente (96×96, la misura
  consigliata da Chrome), generato da `scripts/genera-icone.mjs` con la funzione `primoPiano` già usata
  per l'icona adattiva Android, con una scala che riempie meglio il riquadro (`primoPiano(96, 1.3)`).
  Android usa solo il canale alfa e lo mostra nella barra di stato; Safari lo ignora. Entra nella
  precache da solo (`globPatterns` comprende i `.png`). Rigenerare con `npm run icone` non deve
  cambiare le altre icone (l'algoritmo è deterministico).
- **`notificationclick`**: chiude la notifica; se c'è una finestra dell'app nello `scope`, la porta in
  primo piano (`focus()`), altrimenti `clients.openWindow(registration.scope)`.

`src/pwa.ts` resta invariato: registra il service worker con `virtual:pwa-register`.

## Impostazioni → Avvisi

Nella PWA la nota e il pulsante *Autorizza gli avvisi* seguono `web/avvisi`:

| Stato | Nota | Pulsante |
|---|---|---|
| `concessi` | Notifiche autorizzate. Gli avvisi arrivano tramite internet, con fino a un minuto di ritardo. | nascosto |
| `da-chiedere` | Per ricevere gli avvisi serve il permesso di mostrare notifiche. | visibile |
| `da-attivare` | Notifiche permesse, ma gli avvisi non sono attivi su questo dispositivo: tocca «Autorizza gli avvisi» (serve internet). | visibile |
| `negati` | Notifiche bloccate: abilitale nelle impostazioni del browser per questo sito. | nascosto |
| `da-installare` | Su iPhone gli avvisi arrivano solo con l'app aggiunta alla schermata Home. + link *Come aggiungo l'app alla schermata Home?* (Aiuto "installazione") | nascosto |
| `non-disponibili` | Questo browser non supporta le notifiche push. | nascosto |

Il pulsante resta disabilitato mentre la richiesta è in corso, per evitare richieste doppie.
Nell'app Android testi e comportamento restano quelli di oggi.

## Aiuto e README

- *Come funzionano gli avvisi?*: i tre avvisi valgono per l'app Android e per la PWA. Nell'app sono
  programmati sul telefono, senza connessione e senza server. Nella PWA l'orario di ogni avviso va a un
  server che invia la notifica: servono internet, ritardo fino a un minuto, su iPhone l'app installata
  sulla Home (iOS 16.4 o successivi), sul computer il browser aperto; al server arrivano solo l'orario
  e il tipo di ogni avviso (il tipo è nell'id) e l'indirizzo per le notifiche del browser, non le
  timbrature né i testi.
- *Gli avvisi non arrivano*: punti comuni (permesso, Non disturbare/Focus), punti dell'app (allarmi
  esatti, batteria), punti della PWA (connessione al momento della timbratura, permesso del sito con
  un percorso valido anche nell'app installata, su iPhone app aperta dalla Home, sul computer browser
  aperto).
- *C'è un'app per Android con gli avvisi?*: l'app resta consigliata perché funziona senza internet.
- README: sezione sugli avvisi aggiornata ("Nella PWA gli avvisi non esistono" non vale più), struttura
  del codice (`src/web/`, `src/sw.ts`) e prova manuale.

## Test

Vitest, ambiente node come oggi.

- `tests/avvisiPush.test.ts`:
  - `idAvviso` / `tipoDaId`, compresi id non riconoscibili;
  - `operazioniPush`: avviso nuovo, cambiato (orario, testo), identico, rimosso con orario futuro
    (`annulla`) e passato (`dimentica`), endpoint cambiato (tutti `programma`), piano e inviati vuoti;
  - `statoPermessiWeb`: tutti i rami, compreso l'ordine (iPhone non installato prima di non supportato);
  - `notificaDaPush`: testo salvato con orario uguale, salvato con orario diverso, assente, id non
    riconoscibile, payload non valido.
- `tests/webAvvisi.test.ts`, sul modello di `nativeAvvisi.test.ts`, con `fetch`, `Notification`,
  `navigator.serviceWorker`, `caches`, `localStorage` e store finti:
  - `PUT` con URL, metodo, intestazione e corpo giusti per l'uscita prevista; voce nella Cache e stato
    salvato;
  - seconda sincronizzazione senza cambiamenti → nessuna chiamata;
  - fine della pausa → `DELETE` del suo avviso;
  - errore di rete → stato invariato, la sincronizzazione successiva riprova;
  - senza permesso, senza registrazione attiva o senza iscrizione → nessuna chiamata;
  - endpoint cambiato → nuovo `PUT`;
  - `richiediPermessi`: permesso negato, permesso concesso con iscrizione nuova.
- `src/sw.ts` non ha test unitari (è sottile e la logica è in `avvisiPush.ts`): lo verificano
  `npm run typecheck` e `npm run build`, che fallisce se l'iniezione del manifest non trova
  `self.__WB_MANIFEST`.
- **Prova manuale**:
  1. `npm run build && npx vite preview --port 5173` (porta ammessa dal CORS del backend), apri
     `http://localhost:5173/krumiro2.0/`, *Impostazioni → Avvisi → Autorizza gli avvisi*;
  2. durata del pranzo 1 min, timbra entrata e inizio pausa: arriva "Fine pausa pranzo" entro circa
     due minuti, con l'orologio come icona piccola nella barra di stato (Android); cliccandola si
     apre l'app;
  3. timbra il rientro prima dello scadere con una durata più lunga: nessuna notifica (`DELETE`);
  4. offline e app ancora utilizzabile (precache e fallback di navigazione funzionano come prima);
  5. dopo il deploy su GitHub Pages, la stessa prova su Android/Chrome e su iPhone con la PWA installata.
