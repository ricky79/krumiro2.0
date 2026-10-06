# Timbrare con un tag NFC — design

Data: 2026-10-06 · Branch: `feature/tag`

## Obiettivo

Solo nell'app Android: avvicinando al telefono un tag NFC preparato da Krumiro, l'app esegue l'azione
del pulsante principale di **Oggi**, come se l'avessi toccato. Funziona anche ad app chiusa: Android
apre Krumiro e timbra.

| Stato della giornata | Azione del tag |
|---|---|
| Non iniziata | Entrata |
| Al lavoro, pausa non ancora fatta | Inizio pausa |
| In pausa | Fine pausa |
| Al lavoro, pausa fatta | Uscita |
| Pausa sigaretta in corso | Rientro dalla sigaretta (stessa regola del tasto *Rientro*) |
| In permesso | Rientro da permesso |
| Chiusa | nulla |

Scelte concordate:

- il tag è un adesivo o portachiavi NFC (NTAG213 o più grande) che Krumiro scrive una volta sola da
  *Impostazioni → Tag NFC*; vale qualunque tag preparato da Krumiro, senza associarne uno in particolare;
- tag non preparati, carte contactless e badge non aprono Krumiro;
- "simulare il tap" vuol dire lo stesso effetto del tocco: stessi messaggi e stessi dialoghi
  (es. la ripartizione pausa/permesso al rientro);
- inizio sigaretta, uscita in permesso, uscita anticipata e le altre azioni secondarie restano manuali;
- plugin Capacitor scritto da noi dentro l'app (niente plugin di terze parti, niente dipendenze nuove).

Fuori da questa spec: PWA e iPhone (Web NFC esiste solo su Chrome per Android e non apre l'app da
chiusa), tag diversi per azioni diverse, associazione a un tag specifico, interruttore per
disattivare la funzione (basta non usare il tag), lettura a schermo bloccato (Android legge l'NFC solo
a schermo acceso e sbloccato).

## Il tag

Messaggio NDEF con due record, in quest'ordine (Android sceglie l'intent dal primo record):

1. record MIME `application/vnd.io.github.ricky79.krumiro` con payload `timbra` (UTF-8);
2. Android Application Record `io.github.ricky79.krumiro`.

Circa 95 byte: entra in un NTAG213 (137 byte utili). Il tipo MIME è tutto minuscolo, come richiede il
filtro degli intent di Android.

## Componenti

| File | Ruolo |
|---|---|
| `android/app/src/main/java/io/github/ricky79/krumiro/NfcPlugin.java` *(nuovo)* | plugin Capacitor `Nfc`: lettura del tag, preparazione, stato dell'NFC, vibrazione |
| `android/app/src/main/java/io/github/ricky79/krumiro/MainActivity.java` | registra `NfcPlugin` e non riconsegna l'intent di avvio quando l'activity viene ricreata |
| `android/app/src/main/AndroidManifest.xml` | permessi, `uses-feature` e filtro `NDEF_DISCOVERED` |
| `src/core/tagNfc.ts` *(nuovo, puro)* | azione da eseguire e esito della lettura |
| `src/native/nfc.ts` *(nuovo)* | ponte tipizzato verso il plugin, solo nell'app |
| `src/ui/tagNfc.ts` *(nuovo)* | gestione della lettura e sezione *Tag NFC* delle Impostazioni |
| `src/ui/giorno.ts` | `eseguiAzione` diventa esportata |
| `src/ui/sigaretta.ts` | nuovo `rientroSigarettaDaTag(data)` |
| `src/main.ts` | nell'app avvia l'ascolto del tag |
| `src/ui/impostazioni.ts` | aggiunge la sezione *Tag NFC* (solo nell'app) |
| `src/ui/aiutoTesti.ts`, `README.md` | voce "Timbrare con un tag NFC" |

## Android

### Manifest

- `<uses-permission android:name="android.permission.NFC" />`
- `<uses-permission android:name="android.permission.VIBRATE" />`
- `<uses-feature android:name="android.hardware.nfc" android:required="false" />`: l'app resta
  installabile sui telefoni senza NFC.
- Su `MainActivity` (già `singleTask`):

  ```xml
  <intent-filter>
      <action android:name="android.nfc.action.NDEF_DISCOVERED" />
      <category android:name="android.intent.category.DEFAULT" />
      <data android:mimeType="application/vnd.io.github.ricky79.krumiro" />
  </intent-filter>
  ```

### `MainActivity`

- `registerPlugin(NfcPlugin.class)` prima di `super.onCreate`.
- Se `savedInstanceState != null` (activity ricreata dal sistema, es. cambio della dimensione dei
  caratteri o processo ripristinato) e l'intent è `NDEF_DISCOVERED`, prima di `super.onCreate` lo
  sostituisce con un `ACTION_MAIN`: `BridgeActivity.load()` chiama `onNewIntent(getIntent())` e
  altrimenti riconsegnerebbe il tag già letto. Gli altri intent restano com'erano.

### `NfcPlugin` (`@CapacitorPlugin(name = "Nfc")`)

**Lettura.** Capacitor passa ai plugin l'intent sia all'avvio a freddo (`BridgeActivity.load()` →
`onNewIntent(getIntent())`) sia con l'app già aperta (`singleTask` → `onNewIntent`), quindi basta
`handleOnNewIntent(intent)`:

- azione `NDEF_DISCOVERED`, tipo MIME uguale al nostro, senza `FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`
  (app riaperta dalle recenti) → `notifyListeners("tag", new JSObject(), true)`. Con
  `retainUntilConsumed` l'evento aspetta il listener JS, che all'avvio a freddo arriva dopo;
- qualsiasi altro intent → nulla.

**Metodi:**

- `stato()` → `{ disponibile: boolean, attivo: boolean }`: `NfcAdapter.getDefaultAdapter()` non nullo
  e `isEnabled()`.
- `preparaTag()` → si risolve quando un tag è stato scritto. Accende il reader mode
  (`enableReaderMode`, flag NFC A/B/F/V) solo per la preparazione: con il reader mode attivo Android
  non smista i tag, quindi un tag di Krumiro avvicinato in quel momento non timbra. A ogni tag scoperto
  (thread del lettore):
  - `Ndef` presente → `connect`; non scrivibile → errore `sola-lettura`; `getMaxSize()` minore del
    messaggio → `troppo-piccolo`; altrimenti `writeNdefMessage`;
  - altrimenti `NdefFormatable` presente → `format(messaggio)`;
  - altrimenti → `non-supportato`;
  - `IOException` (anche `TagLostException`) → `connessione`; `FormatException` → `non-supportato`.

  Scrittura riuscita → spegne il reader mode e risolve. Errore → `notifyListeners("erroreScrittura",
  { codice })` (non trattenuto) e il reader mode **resta acceso**: si riprova allontanando e
  riavvicinando il tag, o con un altro. Spegnerlo e riaccenderlo farebbe rileggere subito un tag
  rimasto appoggiato, in un ciclo di errori; restando acceso, Android segnala un tag una volta sola
  finché resta nel campo. Una seconda `preparaTag()` mentre la prima è in corso rifiuta la prima con
  `annullato`. NFC assente o spento → rifiuta subito con `non-disponibile`.
- `annullaPreparazione()` → spegne il reader mode e rifiuta la chiamata in corso con `annullato`.
- `handleOnPause()` → come `annullaPreparazione()`: il reader mode vale solo con l'activity in primo
  piano.
- `apriImpostazioniNfc()` → `Settings.ACTION_NFC_SETTINGS`.
- `vibra()` → vibrazione singola di circa 150 ms (`Vibrator`, `VibrationEffect` da API 26, metodo
  deprecato sotto). Nativa e non `navigator.vibrate`, che nella WebView senza un tocco dell'utente
  viene bloccato.

## Regole pure (`src/core/tagNfc.ts`)

```ts
export type AzioneTag = Azione | 'RIENTRO_SIGARETTA';
export const PAUSA_LETTURE_MS = 60_000;

export function azioneTag(r: RisultatoGiornata, sigaretta: boolean): AzioneTag | null;

export type EsitoLettura = 'timbra' | 'gia-letto' | 'finestra-aperta' | 'chiusa';
export function esitoLettura(p: {
  azione: AzioneTag | null;
  finestraAperta: boolean;
  ora: number;
  ultimaTimbratura: number | null;
}): EsitoLettura;
```

- `azioneTag`: con `sigaretta` (c'è `sigarettaInCorso` nella giornata) → `'RIENTRO_SIGARETTA'`;
  altrimenti `azioniDisponibili(r.stato, r.pausaFatta).primaria` (`null` con la giornata chiusa). È la
  stessa scelta del pulsante principale in `giorno.ts`.
- `esitoLettura`, nell'ordine:
  1. `ultimaTimbratura !== null` e `ora - ultimaTimbratura < PAUSA_LETTURE_MS` → `gia-letto`;
  2. `finestraAperta` → `finestra-aperta`;
  3. `azione === null` → `chiusa`;
  4. altrimenti `timbra`.

  `ultimaTimbratura` è l'istante dell'ultima lettura con esito `timbra`: le letture ignorate non
  allungano l'attesa.

## Web

### `src/native/nfc.ts`

`registerPlugin<NfcPlugin>('Nfc')` con l'interfaccia dei metodi sopra. Funzioni:

- `statoNfc()` → `'attivo' | 'spento' | 'assente'` (`'assente'` anche fuori dall'app o se il plugin
  non risponde);
- `preparaTag(suErrore: (codice: ErroreScrittura) => void)` → `Promise<'ok' | 'non-disponibile' |
  'annullato'>`, con `ErroreScrittura = 'sola-lettura' | 'troppo-piccolo' | 'connessione' |
  'non-supportato'`. Ascolta `erroreScrittura` solo per la durata della chiamata e passa ogni codice a
  `suErrore` (un codice sconosciuto vale `connessione`); un rifiuto con codice sconosciuto vale
  `annullato`;
- `annullaPreparazione()`, `apriImpostazioniNfc()`, `vibra()`: errori ignorati;
- `ascoltaTag(gestore)` → `addListener('tag', gestore)` solo se `inApp()`.

### Lettura (`src/ui/tagNfc.ts`)

`avviaTagNfc(mostraOggi: () => void)`, chiamata da `main.ts` nel ramo dell'app dopo il primo
`render()` (così l'evento trattenuto all'avvio a freddo trova la vista già montata), con
`() => vai('oggi')`. A ogni evento `tag`:

1. `adesso = adessoRoma()`; giornata di oggi; `r = calcolaGiornata(...)` con i minuti attuali;
   `azione = azioneTag(r, sigarettaInCorso(giornata) !== null)`.
2. `finestraAperta` = c'è un `dialog[open]` che non è la schermata della sigaretta (`.sigaretta`).
3. Secondo `esitoLettura(...)` (con `ultimaTimbratura` tenuta in memoria nel modulo):
   - `timbra` → `ultimaTimbratura = Date.now()`, `mostraOggi()`, `vibra()`, poi
     `rientroSigarettaDaTag(data)` oppure `eseguiAzione(azione, data)`. Il messaggio di conferma
     ("Entrata alle 9:02", "Rientro alle 10:47 · 30 min di permesso"…) è quello del tocco;
   - `gia-letto` → toast "Tag già letto: riavvicinalo tra un minuto";
   - `finestra-aperta` → toast "Chiudi la finestra aperta e riavvicina il tag" (non si chiude nulla al
     posto dell'utente: potrebbe perdere una modifica);
   - `chiusa` → `mostraOggi()`, toast "Giornata già chiusa".

   Solo `timbra` vibra.

### `eseguiAzione` (`src/ui/giorno.ts`)

Diventa `export`, senza altre modifiche: legge già l'orario al momento della chiamata
(`leggiAdesso()`).

### `rientroSigarettaDaTag(data)` (`src/ui/sigaretta.ts`)

Fa la stessa strada del tasto *Rientro*:

- schermata aperta → come il tocco su *Rientro* (`giornoCambiato()`, `termina()`, `rientra(...)`). Per
  farlo `apriSchermata` salva in una variabile del modulo il gestore del tasto e la azzera alla
  chiusura;
- schermata non aperta (es. giornata con timbrature incoerenti, dove non si ripresenta da sola) →
  `sigarettaInCorso(store.giornata(data))` e, se c'è, `rientra(data, uscita, leggiInizio(data, uscita))`.

Entro la tolleranza la pausa si annulla, oltre diventa permesso, come oggi.

### Impostazioni → Tag NFC

Sezione nuova dopo *Avvisi*, solo con `inApp()` e solo se `statoNfc()` non è `'assente'` (la sezione
compare quando la risposta arriva):

- testo: "Avvicina un tag preparato da Krumiro per timbrare l'azione del pulsante principale, anche ad
  app chiusa.";
- NFC spento → nota "NFC disattivato: attivalo per usare il tag." e pulsante **Apri impostazioni
  NFC**; lo stato si rilegge al ritorno in primo piano (`visibilitychange`);
- pulsante **Prepara un tag NFC** (disabilitato con l'NFC spento) → foglio (`apriFoglio`) "Prepara un
  tag NFC" con "Avvicina il tag al retro del telefono e tienilo fermo." e il tasto *Annulla*
  (`annullaPreparazione()`); la chiamata a `preparaTag()` parte all'apertura e dura finché il foglio è
  aperto. Gli errori sui singoli tag lasciano il foglio aperto e mostrano un messaggio sotto il testo:
  - `sola-lettura` → "Il tag è protetto da scrittura: usane un altro.";
  - `troppo-piccolo` → "Il tag è troppo piccolo: serve almeno un NTAG213.";
  - `non-supportato` → "Questo tag non si può usare con Krumiro.";
  - `connessione` → "Tag allontanato troppo presto: allontanalo, riavvicinalo e tienilo fermo.".

  Esito della chiamata:
  - `ok` → chiude il foglio, toast "Tag pronto: avvicinalo per timbrare";
  - `non-disponibile` → chiude il foglio, toast "NFC disattivato";
  - `annullato` → chiude il foglio, senza messaggi.

  Chiudere il foglio (sfondo o *Annulla*) chiama `annullaPreparazione()`.
- link all'aiuto "Come funziona il tag NFC?" (`tag-nfc`).

## Aiuto e README

- Nuova voce `tag-nfc` nella sezione *I bottoni*: "Timbrare con un tag NFC (app Android)". Contenuti:
  la tabella stato → azione in forma di elenco, la preparazione da Impostazioni (NTAG213 o più grande,
  la scrittura si può ripetere), funziona ad app chiusa ma a schermo sbloccato, cosa succede con la
  sigaretta (stessa regola del tasto *Rientro*), letture ignorate per un minuto, inizio sigaretta e
  permessi restano manuali, disponibile solo nell'app Android.
- `README.md`: paragrafo "Timbrare con un tag NFC" nella parte dell'app Android.

## Test

**Vitest** (`tests/tagNfc.test.ts`):

- `azioneTag` per ogni stato: non iniziata → `ENTRATA`; al lavoro senza pausa → `INIZIO_PAUSA`; in pausa
  → `FINE_PAUSA`; al lavoro con pausa fatta → `USCITA`; in permesso → `RIENTRO_PERMESSO`; sigaretta in
  corso → `RIENTRO_SIGARETTA`; chiusa → `null`. Con giornate costruite e passate da `calcolaGiornata`,
  come gli altri test;
- `esitoLettura`: prima lettura → `timbra`; 59 s dopo → `gia-letto`; 61 s dopo → `timbra`; finestra
  aperta → `finestra-aperta`; azione `null` → `chiusa`; `gia-letto` ha la precedenza su
  `finestra-aperta` e `chiusa`.

**Verifiche automatiche:** `npm run typecheck`, `npm test`, `npm run build:android`, poi
`gradlew assembleDebug` in `android/` per controllare che il Java compili.

**Prova manuale sul telefono** (da fare a mano, NFC non emulabile):

1. Impostazioni → Tag NFC → *Prepara un tag NFC* con un NTAG vuoto → "Tag pronto". Se hai un tag
   protetto da scrittura, tenendolo appoggiato il messaggio compare una volta sola (nessun ciclo).
2. App chiusa (tolta dalle recenti), giornata non iniziata: avvicina il tag → Krumiro si apre su Oggi,
   vibra, "Entrata alle …".
3. App in background: avvicina il tag → torna in primo piano e timbra *Inizio pausa*.
4. App aperta su Storico: avvicina il tag dopo un minuto → passa su Oggi, *Fine pausa*.
5. Riavvicina subito il tag → "Tag già letto…", nessuna timbratura, nessuna vibrazione.
6. Avvia a mano una pausa sigaretta, avvicina il tag → la schermata si chiude con il rientro.
7. Esci in permesso, avvicina il tag → rientro da permesso (con la ripartizione se a ridosso del pranzo).
8. Apri l'editor di una timbratura e avvicina il tag → "Chiudi la finestra aperta…".
9. Uscita con il tag, poi tag dopo un minuto → "Giornata già chiusa".
10. Riapri Krumiro dalle app recenti → nessuna timbratura in più.
11. Avvicina una carta contactless o un tag non preparato → Krumiro non si apre.
12. NFC spento → la sezione lo dice; *Apri impostazioni NFC* porta alle impostazioni di sistema.
