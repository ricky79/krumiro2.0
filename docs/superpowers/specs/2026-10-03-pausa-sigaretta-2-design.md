# Pausa sigaretta 2 — design

Data: 2026-10-03 · Branch: `feature/9-pausa-sigaretta` · Issue: #9

## Obiettivo

Arricchire la schermata della pausa sigaretta (vedi `2026-10-02-pausa-sigaretta-design.md`):

1. allo scadere della tolleranza la sigaretta si spegne nel posacenere;
2. nelle impostazioni si sceglie tra sigaretta **normale** ed **elettronica**: l'elettronica non si
   accorcia, cala il liquido nel serbatoio e la brace è un LED rosso;
3. negli ultimi 30 secondi lo schermo lampeggia di rosso;
4. il fuori orario è più evidente: sfondo rosso scuro fisso.

Scelte concordate: animazione del posacenere **allo scadere** (non al tocco di Rientro);
elettronica allo scadere con **serbatoio vuoto e LED che lampeggia**; per il fuori orario
**solo lo sfondo rosso scuro** (niente scritte o riquadri in più); disegni SVG statici con
animazioni CSS legate a classi di fase (approccio A).

Le regole non cambiano: tolleranza, blocchi da 30 min, esito del rientro, annullamento,
ripristino della schermata e calcolo restano come sono.

## Dati

- `Impostazioni.tipoSigaretta: 'normale' | 'elettronica'`, predefinito `'normale'`
  (`TipoSigaretta` esportato da `src/core/tipi.ts`).
- Nessun cambio di `VERSIONE_CORRENTE`: `normalizzaImpostazioni` accetta solo i due valori,
  altrimenti `'normale'`.
- Entra nel backup JSON con le altre impostazioni; il CSV (solo timbrature) non cambia.
- Nessun dato sulle timbrature: il tipo serve solo al disegno della schermata.

## Regole (logica pura, `src/core/sigaretta.ts`)

- `SECONDI_AVVISO = 30` (costante).
- `Countdown` riceve `fase: FaseSigaretta`, con `FaseSigaretta = 'accesa' | 'ultimi' | 'scaduta'`:
  - `'scaduta'` se `scaduta` è true (confine invariato: oltre la tolleranza, al secondo), e sempre
    con tolleranza 0 (la sigaretta parte già consumata, come `consumata = 1`);
  - `'ultimi'` se non scaduta e `residuoMs ≤ SECONDI_AVVISO × 1000` (il timer mostra `00:30`
    quando comincia il lampeggio; alla tolleranza esatta è ancora `'ultimi'`);
  - `'accesa'` altrimenti.
- `scaduta: boolean` resta per i chiamanti esistenti.
- `spegnimentoDaAnimare(precedente: FaseSigaretta | null, attuale: FaseSigaretta)` → true solo
  se `attuale` è `'scaduta'` e `precedente` è `'accesa'` o `'ultimi'` (vedi *Transizione allo
  scadere*).

## Interfaccia

### Impostazioni (`src/ui/impostazioni.ts`)

- Scheda **Pausa sigaretta**: prima della tolleranza, riga *Tipo* con due pulsanti
  **Normale** / **Elettronica** (gruppo `chip` come il selettore del tema, `aria-pressed`,
  `role="group"`). La scelta si salva subito con il messaggio "Salvato".
- *Ripristina valori predefiniti* riporta a Normale; il testo della conferma cita
  "sigaretta normale".

### Fasi della schermata (`src/ui/sigaretta.ts`)

- Il tipo si legge all'apertura della schermata (con la schermata aperta le impostazioni non
  sono raggiungibili). Sul dialog: classe `elettronica` se il tipo è elettronica.
- A ogni `aggiorna()` il dialog ha la classe della fase: `ultimi` o `scaduta` (nessuna per
  `accesa`). La classe `consumata` esistente resta.
- **Transizione allo scadere**: `aggiorna()` ricorda la fase precedente; se
  `spegnimentoDaAnimare(precedente, attuale)` è true, aggiunge la classe `spegnimento` che fa partire
  la sequenza animata. Se la schermata si apre già scaduta (app riaperta, tolleranza 0)
  la classe non viene aggiunta e si vede subito lo stato finale.
- Vale per entrambi i tipi:
  - **ultimi**: uno strato rosso sopra lo sfondo (pseudo-elemento del dialog, sotto i contenuti)
    pulsa circa una volta al secondo (opacità 0 ↔ ~0,45, ben sotto le 3 accensioni al secondo).
    Disegno, timer e bottoni restano leggibili sopra lo strato;
  - **scaduta**: niente lampeggio, sfondo rosso scuro fisso (gradiente radiale circa
    `#4a0d0d` → `#1a0404`). Timer `+mm:ss` e nota *Al rientro: N di permesso* come oggi;
    il rosso del timer si schiarisce quanto basta per un contrasto ≥ 4,5:1 sul nuovo sfondo.

### Disegni (`src/ui/sigarettaDisegni.ts`, nuovo)

- `creaDisegno(tipo: TipoSigaretta): { elemento: Element; aggiorna(consumata: number): void }`:
  crea l'SVG statico (markup costante, nessun dato dell'utente) e aggiorna le parti che
  dipendono dal consumo. `sigaretta.ts` non conosce la geometria.
- Funzioni pure esportate, usate da `aggiorna` e dai test (`consumata` limitata a 0–1):
  - `misureNormale(consumata)` → `{ larghezzaCartina, spostamentoPunta }` (come oggi);
  - `misureElettronica(consumata)` → `{ yLiquido, altezzaLiquido }` del liquido nel serbatoio.
- Il riquadro (`viewBox`) diventa più alto per fare posto al posacenere sotto la sigaretta.
- **Sigaretta normale**
  - In corso: invariata (cartina che si accorcia, brace che avanza, cenere, fumo).
  - Posacenere: nascosto finché la pausa non scade.
  - Con `spegnimento` (≈ 1,5 s, `animation-fill-mode: forwards`):
    1. il posacenere sale dal basso e compare (≈ 0–0,4 s);
    2. il mozzicone (filtro con un residuo di brace) si inclina e scende nel posacenere
       (≈ 0,4–1,0 s);
    3. viene schiacciato e piegato, la brace si spegne, esce un ultimo sbuffo di fumo
       (≈ 1,0–1,5 s).
  - Stato finale (`scaduta` senza `spegnimento`, o a sequenza finita): posacenere con il
    mozzicone schiacciato, brace spenta, nessun fumo.
- **Sigaretta elettronica** (stesso ingombro, orizzontale): da sinistra bocchino scuro,
  serbatoio trasparente con il liquido, corpo metallico, LED rosso sulla punta.
  - In corso: il livello del liquido scende linearmente con `consumata`; il LED pulsa come la
    brace (bagliore); sbuffi di vapore escono dal bocchino. La sigaretta non si accorcia.
  - Scaduta: serbatoio vuoto, vapore fermo, il LED lampeggia acceso/spento a scatti circa una
    volta al secondo (avviso di "vuoto"). Nessun posacenere.
- `prefers-reduced-motion`: niente fumo, vapore, pulsazioni, lampeggio dello strato né
  sequenza di spegnimento. Negli ultimi 30 s lo strato rosso è una tinta fissa; allo scadere
  il posacenere compare direttamente nello stato finale; il LED resta acceso fisso.
  Cartina e liquido calano comunque.

### Aiuto e README

- `src/ui/aiutoTesti.ts`, voce `pausa-sigaretta`: una frase sul lampeggio degli ultimi 30
  secondi e su cosa succede oltre la tolleranza secondo il tipo impostato (normale: la
  sigaretta finisce nel posacenere; elettronica: il serbatoio si svuota e il LED lampeggia),
  con lo sfondo che resta rosso fino al rientro; "Tolleranza e tipo di sigaretta (normale
  o elettronica) si cambiano in Impostazioni → Pausa sigaretta".
- README: nella descrizione della pausa sigaretta e nell'elenco delle impostazioni, il tipo di
  sigaretta.

## Test (Vitest)

- `sigaretta.test.ts`, `countdown(...).fase`:
  - tolleranza 11 min, residuo 30 s + 1 ms → `accesa`;
  - residuo esattamente 30 s → `ultimi`;
  - tolleranza esatta (residuo 0, non scaduta) → `ultimi`;
  - tolleranza + 1 ms → `scaduta`;
  - tolleranza 0 → `scaduta` da subito;
  - tolleranza 1 min: 29 s trascorsi → `accesa`, 30 s → `ultimi`.
- `migrazioni.test.ts`: `tipoSigaretta` mancante o sconosciuto → `'normale'`;
  `'elettronica'` conservato.
- `sigaretta.test.ts`, `spegnimentoDaAnimare`: da `accesa`/`ultimi` a `scaduta` → true;
  da `null` o da `scaduta` → false.
- `sigarettaDisegni.test.ts`: `misureNormale` e `misureElettronica` a 0, 0,5 e 1 (cartina
  piena/metà/zero e punta spostata; liquido pieno/metà/vuoto) e fuori da 0–1. Nessun ambiente
  DOM: la parte SVG si verifica a mano.
- `aiuto.test.ts`: la voce `pausa-sigaretta` cita il posacenere con la sigaretta normale e il
  LED con l'elettronica.
- A mano nel browser (`npm run dev`, tolleranza 1 min): per entrambi i tipi fase accesa,
  lampeggio negli ultimi 30 s, sequenza del posacenere / LED che lampeggia, sfondo rosso,
  riapertura a pausa già scaduta (stato finale senza sequenza), riduci movimento emulato;
  impostazione *Tipo* salvata e ripristinata.

## Fuori dallo scopo

- Vibrazione, suoni, notifiche.
- Testi diversi per la sigaretta elettronica (il bottone resta *Pausa sigaretta*).
- Scritte o riquadri aggiuntivi nel fuori orario.
- Tipo di sigaretta registrato sulla timbratura.
