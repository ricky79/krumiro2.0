# Timbrature

Web app installabile (PWA) per registrare le timbrature di lavoro da iPhone o Android e sapere
a che ora si può uscire. Funziona offline, non ha backend: **i dati restano sul telefono**
(localStorage del browser).

App pubblicata: **https://ricky79.github.io/krumiro2.0/**

## Installare l'app

Apri `https://ricky79.github.io/krumiro2.0/` dal telefono e segui le istruzioni per il tuo sistema.

### iPhone (Safari)

1. Apri **Safari** (deve essere Safari: le altre app non permettono di installare le PWA
   su iOS) e vai sull'indirizzo qui sopra.
2. Tocca il pulsante **Condividi** (il quadrato con la freccia verso l'alto).
3. Scorri e scegli **Aggiungi alla schermata Home**.
   Su iOS 18 e successivi verifica che **Apri come app web** sia attivo.
4. Conferma il nome "Timbrature" e tocca **Aggiungi**.
5. Apri l'app dall'icona sulla schermata Home: parte a tutto schermo, senza la barra di Safari.

### Android (Chrome)

1. Apri **Chrome** e vai su `https://ricky79.github.io/krumiro2.0/`.
2. Tocca il menu **⋮** (in alto a destra).
3. Scegli **Installa app** (su alcune versioni la voce è **Aggiungi a schermata Home**,
   poi **Installa**). Se compare in basso il banner "Installa Timbrature", puoi usare quello.
4. Conferma con **Installa**: l'icona compare nel cassetto delle app e, se vuoi,
   sulla schermata Home.
5. Apri l'app dall'icona: parte a tutto schermo, senza la barra di Chrome.

Altri browser Android: in **Samsung Internet** usa il menu **☰ → Aggiungi pagina a →
Schermata Home** (o l'icona di installazione nella barra dell'indirizzo); in **Firefox**
usa **⋮ → Installa**. Se la voce non compare, ricarica la pagina e riprova.

Dopo la prima apertura l'app funziona anche **senza connessione**. Quando viene pubblicata una
nuova versione, viene scaricata in background e applicata alla successiva apertura.

### App Android con gli avvisi

Oltre alla PWA esiste un'app Android vera (costruita con [Capacitor](https://capacitorjs.com)
dallo stesso codice) che ricorda le scadenze con **notifiche** anche ad app chiusa:
- **uscita prevista**: quando puoi andare via;
- **rientro dal pranzo**: 30 minuti dopo l'inizio della pausa (durata configurabile);
- **rientro dalla pausa sigaretta**: allo scadere della tolleranza.

Ogni avviso si attiva o disattiva in *Impostazioni → Avvisi*. Le notifiche sono programmate sul
telefono: nessun server, nessun dato fuori dal dispositivo. Nella PWA gli avvisi non esistono.

Per installarla scarica l'APK dalla pagina delle *Release* del repository, aprilo e consenti
l'installazione da questa fonte. Alla prima apertura autorizza le notifiche e, su Android 12+,
anche "Sveglie e promemoria" (altrimenti gli avvisi possono ritardare di qualche minuto).
I dati dell'app sono separati da quelli della PWA: per spostarli usa il backup JSON.
Gli aggiornamenti si installano scaricando il nuovo APK.

### Attenzione ai dati

- **iPhone**: i dati dell'app installata sono separati da quelli di Safari, quindi usa sempre
  l'icona sulla Home. Se elimini l'app dalla schermata Home, iOS cancella anche i suoi dati.
- **Android**: l'app installata condivide i dati con il sito aperto in Chrome. Se cancelli i
  dati di navigazione o i "dati del sito" di Chrome, o disinstalli l'app, perdi le timbrature.
- L'app chiede al sistema la memoria persistente (`navigator.storage.persist()`), ma
  conviene comunque fare ogni tanto un **backup**: *Impostazioni → Esporta backup completo (JSON)*
  e salvalo in File/iCloud (iPhone) o in Drive/File (Android). Per ripristinarlo: *Impostazioni → Importa CSV o backup JSON…*.

## Come si usa

- **Oggi**: il bottone grande propone l'azione più probabile
  (Entrata → Inizio pausa → Fine pausa → Uscita). Sotto trovi le azioni secondarie:
  *Pausa sigaretta*, *Esco in permesso*, *Rientro da permesso*, *Uscita anticipata*, *Entro dopo*
  (permesso a inizio giornata). In alto vedi l'**uscita prevista**, le ore coperte e il saldo.
- **Pausa sigaretta**: registra un'uscita e apre una schermata con il conto alla rovescia e una
  sigaretta che si consuma (normale o elettronica, a scelta). Negli ultimi 30 secondi lo schermo
  lampeggia di rosso; allo scadere la sigaretta finisce nel posacenere e lo sfondo resta rosso.
  Se rientri entro la tolleranza (11 min, configurabile) la pausa si cancella; altrimenti diventa
  permesso a blocchi di 30 min.
- **Permesso in uscita**: se sai già che uscirai prima, tocca *+ Permesso in uscita* e indica la
  durata: l'uscita prevista si anticipa. Quando esci usa *Uscita*: conta il permesso che manca
  davvero, a blocchi di 30 min.
- **Pausa dimenticata**: passata la fascia pranzo senza pausa registrata, in *Oggi* compare un
  riquadro che propone di aggiungerla (30 min, 12:15–12:45).
- Tocca una timbratura nella timeline per **modificarla o eliminarla**. Con
  *+ Aggiungi timbratura* puoi inserirne una a mano, per esempio se l'hai dimenticata.
- **Storico**: per ogni giorno del mese, tre voci ben separate: **Lavoro**, **Straordinario** e
  **Permesso** (un trattino significa zero). Lo straordinario e il permesso sono a blocchi da
  30 minuti: 20 minuti di extra non contano, 50 minuti valgono 30. Se mancano ore compare
  "Mancano …". In alto il riepilogo del mese somma le tre voci e mostra il saldo esatto, senza
  arrotondamenti. Con *+ Giornata dimenticata* inserisci un giorno passato.
- **Impostazioni**: ore dovute (anche diverse per giorno della settimana), fascia pranzo,
  pausa da scalare, pausa minima, orario di inizio conteggio, tolleranza e tipo della pausa sigaretta, export e import dei dati.
- **Aiuto**: risposte ai dubbi più comuni (per esempio la differenza tra *Esco in permesso*
  e *Uscita anticipata*), con ricerca. I link **?** nelle schermate aprono direttamente
  la risposta che riguarda quel punto. Gli esempi usano le tue impostazioni correnti.

## Regole di calcolo

| Regola | Default |
|---|---|
| Ore dovute | 8h lun–ven, 0 sab–dom (configurabili per giorno) |
| Ore coperte | ore lavorate + ore di permesso |
| Saldo | coperte − dovute |
| Uscita prevista (al lavoro) | adesso + (dovute − coperte); se la pausa non è ancora fatta e l'uscita cade dopo la fascia pranzo, si aggiunge la pausa da scalare |
| Timbrature prima delle 08:30 | contano come 08:30 (in tutti i calcoli) |
| Pausa più breve di 30 min | conta come 30 min (in tutti i calcoli) |
| Pausa pranzo | non conta come coperta |
| Permesso a metà giornata | conta come coperto |
| Pausa sigaretta | entro la tolleranza (11 min) viene cancellata; oltre vale permesso a blocchi di 30 min (15 min → 30 min, 42 min → 1h), le ore coperte non cambiano e non diventa mai pausa pranzo |
| Uscita anticipata | le ore mancanti diventano permesso, a blocchi di 30 min (saldo 0) |
| Permessi | ogni permesso vale un multiplo di 30 min (1h23 → 1h30); i minuti in più non contano come lavorate, il saldo non cambia |
| Permesso in uscita pianificato | anticipa l'uscita prevista; all'uscita conta il permesso che manca davvero, a blocchi di 30 min |
| Permesso che copre la fascia pranzo (12:00–14:30) senza pausa registrata | fino a 60 min diventano pausa; al rientro l'app mostra la ripartizione proposta (es. "1h pausa + 1h30 permesso"), che puoi modificare prima di confermare |

Se la sequenza degli eventi è incoerente (per esempio *Fine pausa* senza *Inizio pausa*),
l'app non va in crash: segnala la giornata come **da correggere**, spiega il problema
e calcola i totali ignorando gli eventi incoerenti.

## Export CSV

Il CSV usa `;` come separatore e la virgola per i decimali, con BOM UTF-8: si apre
direttamente con Excel in italiano. Contiene una riga per giorno (ore dovute, lavorate,
permesso, saldo in ore decimali, i permessi a inizio giornata e in uscita e l'elenco delle timbrature). Su iPhone e Android si apre il foglio
di condivisione (Mail, File, Drive, WhatsApp…); dove la condivisione non è disponibile il file
viene scaricato. Lo stesso CSV si può reimportare: le giornate presenti vengono
sovrascritte, le impostazioni restano invariate.

## Sviluppo

Richiede Node.js 22.

```bash
npm install
npm run dev        # server di sviluppo
npm test           # test Vitest del modulo di calcolo
npm run build      # typecheck + build statica in dist/
npm run preview    # anteprima della build
npm run icone      # rigenera le icone PNG (script senza dipendenze)
```

Struttura:

```
src/core/      logica pura, senza DOM: tipi, macchina a stati, calcolo, riepilogo, CSV
src/storage/   localStorage, schema versionato e migrazioni
src/ui/        viste (Oggi/giornata, Storico, Impostazioni, Aiuto), dialoghi, editor
               (i testi dell'aiuto sono in src/ui/aiutoTesti.ts)
tests/         test Vitest
```

### Deploy su GitHub Pages

Il workflow `.github/workflows/deploy.yml` esegue test e build a ogni push su `main`
e pubblica `dist/` su GitHub Pages. Va configurato una volta sola:

1. Su GitHub apri **Settings → Pages**.
2. In **Build and deployment → Source** scegli **GitHub Actions**.

Il `base` in `vite.config.ts` è `/krumiro2.0/`. Se rinomini il repository, aggiornalo.

### App Android

L'app (cartella `android/`) racchiude la build web in un contenitore Android. Il codice è lo stesso
della PWA: la parte nativa è solo `src/native/` (notifiche) e `capacitor.config.ts`.

```bash
npm run build:android   # build web per Android (base './', senza service worker) + cap sync
npm run android:apri    # come sopra e apre Android Studio
```

Serve Android Studio (JDK 21 e SDK Android). Dopo ogni modifica al codice web esegui di nuovo
`npm run build:android`. Gli avvisi si calcolano in `src/core/avvisi.ts` (funzione pura, con test);
`src/native/avvisi.ts` li programma con il plugin `@capacitor/local-notifications`.

**APK in automatico:** il workflow `.github/workflows/android.yml` costruisce l'APK a ogni push di un
tag `v*` (per esempio `git tag v1.8.0 && git push --tags`), lo allega alla release e lo salva anche
come artefatto del workflow. L'APK è firmato con la chiave di debug: va bene per l'installazione
diretta; per il Play Store serve un bundle firmato con una chiave tua. Il numero di versione viene da
`package.json`. L'`appId` (`io.github.ricky79.krumiro`) non si può più cambiare dopo la
pubblicazione. L'icona è quella predefinita di Capacitor: da sostituire con quella dell'app.

### Schema dei dati

I dati sono salvati nella chiave `timbrature` di localStorage, con un campo `version`.
Se lo schema cambia, aggiungi un passo in `MIGRAZIONI` (`src/storage/migrazioni.ts`)
e incrementa `VERSIONE_CORRENTE`. Se i dati salvati non sono leggibili, l'app ne conserva
una copia in una chiave `timbrature-corrotto-<timestamp>` e riparte da zero.
