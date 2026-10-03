# Pausa saltata e permessi — design

Data: 2026-10-03 · Branch: `feature/10-12-13-pausa-e-permessi` · Issue: #10, #12, #13

## Obiettivo

- **#10 Pausa pranzo saltata**: passata la fine della fascia pranzo senza pausa, l'app chiede
  "Non hai registrato la pausa: la aggiungo?"; con un sì registra 30 min di pausa (12:15–12:45).
- **#12 Permessi a blocchi**: ogni permesso usato vale un multiplo di 30 min
  (esempio: uscita prevista 17:55, esco alle 16:32 → mancano 1:23 → permesso 1:30).
- **#13 Permesso in uscita pianificato**: inserisco in anticipo un permesso in uscita e l'uscita
  prevista si anticipa (30 min: 17:55 → 17:25; nella issue "16:25" è un refuso).

Scelte concordate:

- i blocchi valgono per **tutti** i permessi (inizio giornata, intermedi, uscita anticipata,
  uscita con permesso pianificato), ognuno arrotondato per conto suo;
- i minuti in più del blocco si **perdono**: escono dalle lavorate, ore coperte e saldo restano
  invariati (come già la pausa sigaretta);
- il permesso pianificato serve a calcolare l'uscita prevista; all'uscita conta il permesso che
  manca davvero, a blocchi;
- la pausa saltata si propone con un **riquadro nella vista Oggi**; "No" la nasconde per quel giorno;
- realizzazione: blocchi applicati nel calcolo a ogni permesso (approccio A), nessun dato salvato
  già arrotondato.

## Dati

- `Giornata.permessoUscitaMinuti: number` — permesso in uscita pianificato, minuti, predefinito 0.
  - `normalizzaGiornata`: `intIn(v, 0, 1440) ?? 0`. Nessun cambio di `VERSIONE_CORRENTE`.
  - `store.giornata(data)` per una data senza dati restituisce anche `permessoUscitaMinuti: 0`.
  - `store.modificaGiornata` elimina una giornata solo se non ha eventi e ha entrambi i permessi a 0;
    `haContenuto` considera anche `permessoUscitaMinuti > 0`.
  - **CSV**: nuova colonna `Permesso in uscita (min)` subito dopo `Permesso inizio giornata (min)`.
    L'import la cerca per nome (intestazione che inizia con `permesso in uscita`); se manca vale 0;
    un valore non numerico o negativo è un errore di riga, come per il permesso a inizio giornata.
- Pausa saltata: chiave locale `timbrature-pausa-saltata` = data `YYYY-MM-DD` dell'ultimo "No"
  (stato del dispositivo, come tema e banner; fuori dai dati e dal backup).

## Regole (logica pura)

### Blocchi (`src/core/permessi.ts`, nuovo)

- `BLOCCO_PERMESSO = 30`.
- `permessoABlocchi(durata)` → `0` se `durata ≤ 0`, altrimenti `ceil(durata / 30) × 30`.
- `src/core/sigaretta.ts`: `BLOCCO_PERMESSO_SIGARETTA` resta come alias di `BLOCCO_PERMESSO`;
  `permessoSigaretta(d)` = `max(BLOCCO_PERMESSO, permessoABlocchi(d))` (almeno un blocco, invariato).

### Calcolo (`src/core/calcolo.ts`)

Ogni permesso si arrotonda separatamente; la somma delle eccedenze (blocco − reale) si toglie dalle
lavorate, mai sotto zero (stesso meccanismo già usato per le sigarette):

- **inizio giornata**: conteggiato `permessoABlocchi(permessoInizioMinuti)`;
- **intermedio concluso** (non sigaretta): la parte di permesso `p = durata − pausa` (la pausa è la
  quota pranzo della ripartizione, se c'è) vale `permessoABlocchi(p)`. `Ripartizione` resta
  invariata (il suo `permesso` è la parte reale, usata anche dalla finestra di conferma);
  il valore a blocchi sta in `permessiIntermedi`. Intermedio **in corso**: durata reale.
  Intermedio interamente prima dell'inizio conteggio: durata 0 → 0;
- **sigaretta**: invariata;
- **uscita** (chiusura con `USCITA_ANTICIPATA`, oppure con `USCITA` se `permessoUscitaMinuti > 0`):
  mancante `m = max(0, dovuti − coperti prima dell'uscita)` (coperti già al netto delle eccedenze
  precedenti); permesso in uscita `permessoABlocchi(m)`, eccedenza `blocco − m` tolta dalle lavorate
  rimaste. Se le lavorate non bastano, il permesso in uscita si riduce della parte non assorbita:
  le ore coperte non superano mai le dovute;
- chiusura con `USCITA` senza permesso pianificato: invariata (nessun permesso in uscita).

Effetti: per i permessi chiusi ore coperte, saldo e uscita prevista **non cambiano** rispetto al
tempo reale; cambia la ripartizione lavorate ↔ permesso. Le giornate già salvate si ricalcolano
con le nuove regole (lo storico del mese può mostrare più permesso e meno lavorate, saldo uguale).

Nuovo campo in `RisultatoGiornata`:

- `permessiIntermedi: PermessoABlocchi[]` con
  `PermessoABlocchi = { eventoRientroId?: string; da: number; a: number; durata: number; permesso: number }`
  per ogni intermedio concluso non sigaretta, con o senza ripartizione (`durata` = parte di permesso
  reale, `permesso` = a blocchi).
- `permessoInizioDichiarato: number` (minuti inseriti) accanto a `permessoInizio` (a blocchi).
- `permessoUscitaPianificato: number` (minuti del campo della giornata).

### Uscita prevista con permesso pianificato

- `AL_LAVORO`: `uscita = ora + (dovuti − coperti − P)` con `P = permessoUscitaMinuti`; poi la regola
  esistente della pausa pranzo non ancora fatta (se `ora < fine fascia` e `uscita > fine fascia`,
  `+ pausaDaScalare`).
- `IN_PAUSA`: `uscita = rientro + (dovuti − coperti − P)`.
- Nuovo campo `uscitaPrevistaConPermesso: boolean` (true se `P > 0` ed è stata sottratta).

### Pausa da proporre (`src/core/pausaPranzo.ts`, nuovo)

- `OFFSET_PAUSA_PROPOSTA = 15`, `DURATA_PAUSA_PROPOSTA = 30`.
- `pausaDaProporre(giornata, imp, adesso: number | null)` → `{ inizio, fine } | null`:
  - `inizio = pranzo.inizio + 15`, `fine = inizio + 30`; `null` se `fine > pranzo.fine`;
  - `null` se `adesso === null` (giornata non di oggi) o `adesso < pranzo.fine`;
  - `null` se la giornata ha timbrature incoerenti (`idScartati` non vuoto);
  - `null` se `calcolaGiornata(...).pausaFatta` (pausa registrata o permesso che copre il pranzo);
  - `null` se aggiungendo `INIZIO_PAUSA@inizio` e `FINE_PAUSA@fine` la giornata non resta coerente
    (cioè a quell'ora non si era al lavoro: entrata dopo, uscita prima, permesso in corso);
  - altrimenti `{ inizio, fine }` (anche a giornata chiusa).

## Interfaccia

### #12

- Conferma di *Uscita anticipata*: `Esci alle HH:MM: 1h30 di permesso (mancano 1h23) per completare la giornata.`
  — la parte tra parentesi solo se diversa dal blocco.
- Timeline, dettaglio del rientro da un permesso intermedio:
  - con ripartizione: `1h pausa + 1h30 permesso` (pausa dalla ripartizione, permesso a blocchi
    da `permessiIntermedi`), `(proposta)` come oggi;
  - senza: `1h di permesso (assenza di 40 min)`, o solo `30 min di permesso` se uguali.
- Voce *Permesso a inizio giornata*: valore a blocchi; se diverso, `1h (dichiarati 40 min)`.
- *Entro dopo*: passo della durata da 15 a 30 min (preset invariati: 1h, 2h, 3h, 4h).

### #13

- Scheda Timbrature: bottone `+ Permesso in uscita` accanto a `+ Permesso inizio giornata`,
  visibile se `permessoUscitaMinuti === 0` e la giornata non è chiusa.
- Scheda *Permesso in uscita* (`editorPermessoUscita`, sul modello di `editorPermessoInizio`):
  nota "Ore di permesso per uscire prima: l'uscita prevista si anticipa.", preset 30 min, 1h, 1h30,
  2h, durata a passo 30 (max 12h), *Salva*, *Rimuovi permesso* (se presente), *Annulla*.
- Timeline: voce in fondo `Permesso in uscita` con dettaglio la durata pianificata; a giornata chiusa
  il permesso conteggiato (`r.permessoUscita`), con `(pianificati N)` se diverso. Tocco → scheda.
- Riquadro uscita prevista: nota `con N di permesso in uscita` (se `uscitaPrevistaConPermesso`;
  insieme alla nota della pausa pranzo se presenti entrambe: `con 30 min di permesso in uscita, inclusa pausa pranzo di 1h`).
- Toast dell'azione *Uscita* con permesso pianificato: `Uscita alle 17:25 · 30 min di permesso`
  (valore dal calcolo dopo la registrazione; `nessun permesso` se 0).

### #10

- Vista Oggi (solo la giornata di oggi), sotto i bottoni delle azioni: se
  `pausaDaProporre(...)` non è null e la chiave `timbrature-pausa-saltata` non vale la data di oggi,
  riquadro (stile avviso) con testo
  `Non hai registrato la pausa pranzo: la aggiungo dalle 12:15 alle 12:45?` e due bottoni:
  - **Aggiungi pausa** → aggiunge `INIZIO_PAUSA@inizio` e `FINE_PAUSA@fine`; toast
    `Pausa pranzo aggiunta (12:15–12:45)`;
  - **No, l'ho saltata** → salva la data nella chiave locale e ridisegna.
- Lettura/scrittura della chiave protette da try/catch (se non disponibile il riquadro ricompare).

### Aiuto e README

- `src/ui/aiutoTesti.ts`:
  - `ore-coperte`: nuova riga "Ogni permesso vale un multiplo di 30 min: un'uscita anticipata con
    1h23 mancanti conta 1h30; i minuti in più non contano come lavorate."
  - nuova voce `permesso-uscita` (sezione *I bottoni*): come inserirlo, effetto sull'uscita
    prevista, permesso conteggiato secondo l'uscita reale con esempio (17:25 → 30 min,
    17:10 → 1h, dopo le 17:55 → nessuno);
  - `pausa`: una frase sul riquadro "Non hai registrato la pausa pranzo" dopo la fascia pranzo.
- README: righe in *Come si usa* (permesso in uscita, riquadro della pausa) e nella tabella delle
  regole (permessi a blocchi da 30 min; permesso in uscita pianificato); nel paragrafo *Export CSV*
  l'elenco del contenuto cita anche i permessi a inizio giornata e in uscita.

## Test (Vitest)

- `permessi.test.ts`: `permessoABlocchi` (0 → 0, 1 → 30, 30 → 30, 31 → 60, 83 → 90, −5 → 0).
- `sigaretta.test.ts`: `permessoSigaretta(0)` resta 30 (test esistenti invariati).
- `calcolo.test.ts`:
  - uscita anticipata con 1h23 mancanti → `permessoUscita` 90, lavorate −7, saldo 0;
  - intermedio 40 min → permesso 60, lavorate −20, coperte invariate; due intermedi da 20 → 30 + 30;
  - inizio giornata 40 → 60, lavorate −20; `permessoInizioDichiarato` 40;
  - ripartizione pranzo: permesso 12:00–14:10 (130 min, 60 pausa) → `Ripartizione.permesso` 70
    (reale, invariato) e `permessiIntermedi[0].permesso` 90, lavorate −20;
  - intermedio in corso → durata reale;
  - lavoro insufficiente ad assorbire l'eccedenza → coperte ≤ dovute;
  - permesso pianificato 30: uscita prevista −30; con pausa non fatta la regola del pranzo si
    applica dopo la sottrazione; `USCITA` a 17:25 / 17:10 / 17:40 / 18:00 → 30 / 60 / 30 / 0;
    `USCITA_ANTICIPATA` con pianificato → regola dei blocchi sul mancante reale;
  - aggiornare le aspettative esistenti con permessi non multipli di 30.
- `pausaPranzo.test.ts`: prima della fine fascia → null; dopo, senza pausa → `{735, 765}`;
  pausa registrata → null; permesso sul pranzo → null; entrata 13:00 → null; uscita 12:30 → null;
  giornata incoerente → null; giornata chiusa senza pausa → proposta; fascia 13:00–15:00 → `{795, 825}`;
  `adesso` null → null.
- `migrazioni.test.ts`: `permessoUscitaMinuti` mancante / negativo / non intero → 0, valore valido conservato.
- `csv.test.ts`: colonna esportata, andata e ritorno, CSV senza colonna → 0, valore non valido → errore.
- `aiuto.test.ts`: voce `permesso-uscita` presente.
- A mano nel browser: riquadro pausa (Aggiungi / No / ricarica), permesso in uscita (uscita prevista,
  timeline, toast), conferma uscita anticipata con blocchi, dettagli in timeline.

## Fuori dallo scopo

- Proporre la pausa saltata per giornate passate (Storico).
- Durata del blocco o orari della pausa proposta configurabili (blocco 30; la pausa segue la fascia).
- Notifiche o promemoria all'uscita pianificata.
- Riscrivere i dati salvati: le regole nuove agiscono solo nel calcolo.
