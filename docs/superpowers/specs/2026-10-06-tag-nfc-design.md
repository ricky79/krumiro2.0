# Timbrare con un tag NFC — design

Data: 2026-10-06 · Branch: `feature/tag`

## Obiettivo

Solo nell'app Android: avvicinando il telefono a un tag NFC di Krumiro (per esempio uno attaccato
vicino ai tornelli e usato da tutti i colleghi che hanno l'app), Krumiro esegue l'azione del pulsante
principale di **Oggi**, come se l'avessi toccato. Funziona anche ad app chiusa: Android apre Krumiro e
timbra.

| Stato della giornata | Azione del tag |
|---|---|
| Non iniziata | Entrata |
| Al lavoro, pausa non ancora fatta, fascia pranzo non finita | Inizio pausa |
| Al lavoro, pausa non ancora fatta, fascia pranzo finita | chiede: *Inizio pausa* o *Uscita* |
| In pausa | Fine pausa |
| Al lavoro, pausa fatta | Uscita |
| Pausa sigaretta in corso | Rientro dalla sigaretta (stessa regola del tasto *Rientro*) |
| In permesso | Rientro da permesso |
| Chiusa | nulla |

Scelte concordate:

- il tag contiene il solo URI `krumiro://timbra` (decisione già presa nel README per la "wave 2"): un
  tag scritto e bloccato non si può più cambiare, quindi il formato è definitivo;
- il tag lo scrive e lo blocca **una volta** chi lo attacca, con un'app come NFC Tools; Krumiro lo
  legge soltanto (niente funzione per scriverlo). Aiuto e README spiegano come prepararlo;
- **niente Android Application Record**: su un telefono senza Krumiro aprirebbe il Play Store, dove
  Krumiro non c'è. Con il solo URI chi non ha l'app non vede succedere nulla;
- "simulare il tap" vuol dire lo stesso effetto del tocco: stessi messaggi e stessi dialoghi
  (es. la ripartizione pausa/permesso al rientro). Unica eccezione, il caso ambiguo della pausa a
  fascia pranzo finita, dove si chiede;
- dopo una timbratura col tag il messaggio ha per circa 5 secondi il tasto **Annulla**, che riporta la
  giornata com'era prima della lettura;
- una seconda lettura entro 60 secondi da una timbratura col tag viene ignorata;
- inizio sigaretta, uscita in permesso, uscita anticipata e le altre azioni secondarie restano manuali;
- plugin Capacitor scritto da noi dentro l'app (niente plugin di terze parti, niente dipendenze nuove).

Fuori da questa spec: PWA e iPhone, scrittura del tag dall'app, tag diversi per azioni diverse,
interruttore per disattivare la funzione, lettura a schermo bloccato (Android legge l'NFC solo a
schermo acceso e sbloccato).

## Il tag

Messaggio NDEF con un solo record URI: `krumiro://timbra`. Una ventina di byte: va bene qualunque tag
NDEF (NTAG213 o simili). Va **bloccato in sola lettura** se sta in un posto pubblico, altrimenti
chiunque abbia un'app NFC può cancellarlo o riscriverlo; il blocco è definitivo.

## Componenti

| File | Ruolo |
|---|---|
| `android/app/src/main/java/io/github/ricky79/krumiro/NfcPlugin.java` *(nuovo)* | plugin Capacitor `Nfc`: lettura del tag, stato dell'NFC, impostazioni NFC, vibrazione |
| `android/app/src/main/java/io/github/ricky79/krumiro/MainActivity.java` | registra `NfcPlugin` e non riconsegna il tag quando l'activity viene ricreata |
| `android/app/src/main/AndroidManifest.xml` | permessi, `uses-feature` e filtro `NDEF_DISCOVERED` |
| `src/core/tagNfc.ts` *(nuovo, puro)* | azione da eseguire e esito della lettura |
| `src/native/nfc.ts` *(nuovo)* | ponte tipizzato verso il plugin, solo nell'app |
| `src/ui/tagNfc.ts` *(nuovo)* | gestione della lettura: scelta, timbratura, Annulla |
| `src/ui/dialoghi.ts`, `src/style.css` | `toast` con il tasto *Annulla* |
| `src/ui/giorno.ts` | `eseguiAzione` esportata, con `annulla` opzionale per i messaggi |
| `src/ui/sigaretta.ts` | nuovo `rientroSigarettaDaTag(data, annulla)` |
| `src/main.ts` | nell'app avvia l'ascolto del tag |
| `src/ui/impostazioni.ts` | sezione *Tag NFC* (solo nell'app) |
| `src/ui/aiutoTesti.ts`, `README.md` | uso del tag e preparazione del tag |

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
      <data android:scheme="krumiro" android:host="timbra" />
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

- azione `NDEF_DISCOVERED`, `intent.getData()` con schema `krumiro` e host `timbra`, senza
  `FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY` (app riaperta dalle recenti) →
  `notifyListeners("tag", new JSObject(), true)`. Con `retainUntilConsumed` l'evento aspetta il
  listener JS, che all'avvio a freddo arriva dopo;
- qualsiasi altro intent → nulla.

**Metodi:**

- `stato()` → `{ disponibile: boolean, attivo: boolean }`: `NfcAdapter.getDefaultAdapter()` non nullo
  e `isEnabled()`.
- `apriImpostazioniNfc()` → `Settings.ACTION_NFC_SETTINGS`.
- `vibra()` → vibrazione singola di circa 150 ms (`Vibrator`, `VibrationEffect` da API 26, metodo
  deprecato sotto). Nativa e non `navigator.vibrate`, che nella WebView senza un tocco dell'utente
  viene bloccato.

## Regole pure (`src/core/tagNfc.ts`)

```ts
export type AzioneTag = Azione | 'RIENTRO_SIGARETTA' | 'PAUSA_O_USCITA';
export const PAUSA_LETTURE_MS = 60_000;

export function azioneTag(r: RisultatoGiornata, sigaretta: boolean, minuti: number, fineFasciaPranzo: number): AzioneTag | null;

export type EsitoLettura = 'timbra' | 'gia-letto' | 'finestra-aperta' | 'chiusa';
export function esitoLettura(p: {
  azione: AzioneTag | null;
  finestraAperta: boolean;
  ora: number;
  ultimaTimbratura: number | null;
}): EsitoLettura;
```

- `azioneTag`, nell'ordine:
  1. `sigaretta` (c'è `sigarettaInCorso` nella giornata) → `'RIENTRO_SIGARETTA'`;
  2. `primaria = azioniDisponibili(r.stato, r.pausaFatta).primaria`, la stessa scelta del pulsante
     principale in `giorno.ts`;
  3. `primaria === 'INIZIO_PAUSA'` e `minuti >= fineFasciaPranzo` → `'PAUSA_O_USCITA'`;
  4. altrimenti `primaria` (`null` con la giornata chiusa).
- `esitoLettura`, nell'ordine:
  1. `ultimaTimbratura !== null` e `ora - ultimaTimbratura < PAUSA_LETTURE_MS` → `gia-letto`;
  2. `finestraAperta` → `finestra-aperta`;
  3. `azione === null` → `chiusa`;
  4. altrimenti `timbra`.

  `ultimaTimbratura` è l'istante dell'ultima lettura che ha cambiato la giornata: le letture ignorate e
  quelle finite senza timbrare (scelta annullata, conferma rifiutata) non fanno partire l'attesa, e
  *Annulla* la azzera.

## Web

### `src/native/nfc.ts`

`registerPlugin<NfcPlugin>('Nfc')` con i metodi sopra. Funzioni:

- `statoNfc()` → `'attivo' | 'spento' | 'assente'` (`'assente'` anche fuori dall'app o se il plugin
  non risponde);
- `apriImpostazioniNfc()`, `vibra()`: errori ignorati, nulla fuori dall'app;
- `ascoltaTag(gestore)` → `addListener('tag', gestore)` solo se `inApp()`.

### `toast` con Annulla (`src/ui/dialoghi.ts`)

`toast(messaggio, annulla?)`: con `annulla` il messaggio ha un pulsante **Annulla** e resta circa
5 secondi invece di 2,2. Toccandolo il messaggio sparisce e si chiama `annulla`. Il toast oggi ha
`pointer-events: none`: la variante con il pulsante li riattiva, e il pulsante ha un'area di tocco di
almeno 44 px. Il toast è largo quanto il testo (`width: max-content`, al massimo lo schermo meno
32 px) e mostrato come popover nel top layer (`popover="manual"` + `showPopover()`, dove c'è):
altrimenti un messaggio mostrato con un foglio modale aperto, come "Chiudi la finestra aperta…",
resterebbe nascosto sotto il foglio.

### `eseguiAzione` (`src/ui/giorno.ts`)

Diventa `export eseguiAzione(azione, data, annulla?)`; `annulla` passa ai suoi `toast` (messaggio
finale e messaggio dell'uscita con permesso). Senza `annulla` (tocco sul pulsante) non cambia nulla.

### `rientroSigarettaDaTag(data, annulla)` (`src/ui/sigaretta.ts`)

Fa la stessa strada del tasto *Rientro*, passando `annulla` ai messaggi di `rientra`:

- schermata aperta → come il tocco su *Rientro* (`giornoCambiato()`, `termina()`, `rientra(...)`). Per
  farlo `apriSchermata` salva in una variabile del modulo il gestore del tasto e la azzera alla
  chiusura;
- schermata non aperta (es. giornata con timbrature incoerenti, dove non si ripresenta da sola) →
  `sigarettaInCorso(store.giornata(data))` e, se c'è, `rientra(data, uscita, leggiInizio(data, uscita), annulla)`.

Entro la tolleranza la pausa si annulla, oltre diventa permesso, come oggi.

### Lettura (`src/ui/tagNfc.ts`)

`avviaTagNfc(mostraOggi: () => void)`, chiamata da `main.ts` nel ramo dell'app dopo il primo
`render()` (così l'evento trattenuto all'avvio a freddo trova la vista già montata), con
`() => vai('oggi')`. A ogni evento `tag`:

1. `adesso = adessoRoma()`; giornata di oggi; `r = calcolaGiornata(...)` con i minuti attuali;
   `azione = azioneTag(r, sigarettaInCorso(giornata) !== null, adesso.minuti, store.impostazioni.pranzo.fine)`.
2. `finestraAperta` = c'è un `dialog[open]` che non è la schermata della sigaretta (`.sigaretta`).
3. Secondo `esitoLettura(...)` (con `ultimaTimbratura` tenuta in memoria nel modulo):
   - `gia-letto` → toast "Tag già letto: riavvicinalo tra un minuto";
   - `finestra-aperta` → toast "Chiudi la finestra aperta e riavvicina il tag" (non si chiude nulla al
     posto dell'utente: potrebbe perdere una modifica);
   - `chiusa` → `mostraOggi()`, toast "Giornata già chiusa";
   - `timbra` → `mostraOggi()`, fotografia della giornata e dell'inizio sigaretta salvato
     (per *Annulla*), poi:
     - `RIENTRO_SIGARETTA` → `rientroSigarettaDaTag(data, annulla)`;
     - `PAUSA_O_USCITA` → foglio "Cosa timbri?" con il testo "La fascia pranzo è finita e la pausa non
       è registrata." e i pulsanti *Inizio pausa* (primario), *Uscita*, *Annulla*; la scelta va a
       `eseguiAzione(scelta, data, annulla)`, *Annulla* o il tocco sullo sfondo non timbrano;
     - altrimenti → `eseguiAzione(azione, data, annulla)`.

     Finita l'azione, se gli eventi della giornata sono cambiati `ultimaTimbratura = Date.now()` e
     `vibra()`.

   La vibrazione conferma la timbratura: vibra solo se la giornata è cambiata davvero, quindi non con
   un foglio annullato o lasciato a metà. Il messaggio di conferma ("Entrata alle 9:02", "Rientro alle 10:47 · 30 min
   di permesso"…) è quello del tocco, con in più il tasto *Annulla*.

**Annulla:** salva di nuovo l'inizio sigaretta fotografato (se c'era una pausa sigaretta in corso),
poi rimette gli eventi della giornata com'erano, `ultimaTimbratura = null`, toast "Timbratura
annullata". L'inizio sigaretta va salvato prima degli eventi: la modifica allo store ridisegna subito
la vista, che riapre la schermata della sigaretta leggendo l'inizio salvato.

### Impostazioni → Tag NFC

Sezione nuova dopo *Avvisi*, solo con `inApp()` e solo se `statoNfc()` non è `'assente'` (la sezione
compare quando arriva la risposta):

- testo: "Avvicina il tag NFC di Krumiro (per esempio quello ai tornelli) per timbrare l'azione del
  pulsante principale, anche ad app chiusa.";
- NFC attivo → nota "NFC attivo.";
- NFC spento → nota "NFC disattivato: attivalo per usare il tag." e pulsante **Apri impostazioni
  NFC**. Lo stato si rilegge quando l'app torna in primo piano (`visibilitychange`), finché la
  sezione è nella pagina;
- link all'aiuto "Come funziona il tag NFC?" (`tag-nfc`).

## Aiuto e README

- Voce `tag-nfc` nella sezione *I bottoni*, "Timbrare con un tag NFC (app Android)": la tabella stato
  → azione in forma di elenco, la domanda *Inizio pausa* / *Uscita* a fascia pranzo finita, la
  sigaretta (stessa regola del tasto *Rientro*, con la tolleranza delle impostazioni), *Annulla* per
  5 secondi, letture ignorate per un minuto, inizio sigaretta e permessi restano manuali, schermo
  acceso e sbloccato, NFC attivo (Impostazioni → Tag NFC), solo nell'app Android.
- Voce `tag-nfc-preparare` nella stessa sezione, "Come preparo un tag NFC per Krumiro?": un tag NFC
  qualsiasi (NTAG213 va bene) e un'app per scriverlo, per esempio NFC Tools; si scrive un record
  URL/URI personalizzato con `krumiro://timbra`; se il tag va in un posto pubblico lo si blocca in sola
  lettura (in NFC Tools *Altro → Blocca il tag*), sapendo che il blocco è definitivo; il tag funziona
  per tutti quelli che hanno l'app Krumiro per Android, sugli altri telefoni non succede nulla.
- `README.md`: la sezione "Tag NFC (wave 2, non ancora implementato)" diventa la documentazione della
  funzione per gli sviluppatori (plugin, manifest, regole); nella parte per gli utenti, paragrafo
  "Timbrare con un tag NFC" con l'uso e la preparazione del tag.

## Test

**Vitest:**

- `tests/tagNfc.test.ts` (regole pure):
  - `azioneTag` per ogni stato: non iniziata → `ENTRATA`; al lavoro senza pausa prima della fine della
    fascia pranzo → `INIZIO_PAUSA`; un minuto prima della fine → `INIZIO_PAUSA`; alla fine e dopo →
    `PAUSA_O_USCITA`; in pausa → `FINE_PAUSA`; al lavoro con pausa fatta → `USCITA`; in permesso →
    `RIENTRO_PERMESSO`; sigaretta in corso → `RIENTRO_SIGARETTA` (anche dopo la fascia pranzo);
    chiusa → `null`;
  - `esitoLettura`: prima lettura → `timbra`; 59 s dopo → `gia-letto`; 60 s dopo → `timbra`;
    finestra aperta → `finestra-aperta`; azione `null` → `chiusa`; `gia-letto` ha la precedenza su
    `finestra-aperta` e `chiusa`.
- `tests/nativeNfc.test.ts` (plugin finto): `statoNfc` per attivo, spento, assente, errore del plugin e
  fuori dall'app; `ascoltaTag` registra il listener solo nell'app; `vibra` e `apriImpostazioniNfc`
  non lanciano se il plugin fallisce.
- `tests/uiTagNfc.test.ts` (store, azioni e dialoghi finti): la lettura chiama `eseguiAzione` con
  l'azione giusta e vibra; una seconda lettura entro un minuto mostra "Tag già letto" e non timbra;
  una lettura finita senza cambiare la giornata non fa partire l'attesa; *Annulla* rimette gli
  eventi, risalva l'inizio sigaretta prima di modificare la giornata e permette subito una nuova
  lettura; `PAUSA_O_USCITA` apre il foglio e la scelta *Uscita* timbra `USCITA`; finestra aperta e
  giornata chiusa mostrano i loro messaggi senza vibrare.
- `tests/aiuto.test.ts`: le voci `tag-nfc` e `tag-nfc-preparare` esistono e citano `krumiro://timbra`,
  *Annulla* e il blocco del tag.

**Verifiche automatiche:** `npm run typecheck`, `npm test`, `npm run build:android`, poi
`gradlew assembleDebug` in `android/` per controllare che il Java compili.

**Prova manuale sul telefono** (da fare a mano, NFC non emulabile):

1. Con NFC Tools scrivi `krumiro://timbra` su un tag (senza bloccarlo, per le prove).
2. App chiusa (tolta dalle recenti), giornata non iniziata: avvicina il tag → Krumiro si apre su Oggi,
   vibra, "Entrata alle …" con *Annulla*.
3. Tocca *Annulla* → l'entrata sparisce; riavvicina subito il tag → timbra di nuovo.
4. App in background, prima della fine della fascia pranzo: avvicina il tag dopo un minuto → torna in
   primo piano e timbra *Inizio pausa*.
5. App aperta su Storico: avvicina il tag dopo un minuto → passa su Oggi, *Fine pausa*.
6. Riavvicina subito il tag → "Tag già letto…", nessuna timbratura, nessuna vibrazione.
7. Avvia a mano una pausa sigaretta, avvicina il tag → la schermata si chiude con il rientro; *Annulla*
   → la schermata della sigaretta ricompare con il conto alla rovescia giusto.
8. Esci in permesso, avvicina il tag → rientro da permesso (con la ripartizione se a ridosso del pranzo).
9. Giornata senza pausa dopo la fine della fascia pranzo: avvicina il tag → foglio *Inizio pausa* /
   *Uscita*; scegli *Uscita*.
10. Apri l'editor di una timbratura e avvicina il tag → "Chiudi la finestra aperta…".
11. A giornata chiusa, tag dopo un minuto → "Giornata già chiusa".
12. Riapri Krumiro dalle app recenti → nessuna timbratura in più.
13. Avvicina una carta contactless o un tag con un altro contenuto → Krumiro non si apre.
14. NFC spento → la sezione Impostazioni → Tag NFC lo dice; *Apri impostazioni NFC* porta alle
    impostazioni di sistema; riattivato l'NFC e tornati nell'app la nota diventa "NFC attivo.".
15. Verifica che i nomi delle voci di NFC Tools citati nell'Aiuto corrispondano a quelli dell'app.
