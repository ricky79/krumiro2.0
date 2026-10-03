# Pausa saltata e permessi a blocchi — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permessi conteggiati a blocchi da 30 min (#12), permesso in uscita pianificato che anticipa l'uscita prevista (#13) e proposta di aggiungere la pausa pranzo dimenticata (#10).

**Architecture:** Una funzione pura `permessoABlocchi` (nuovo `src/core/permessi.ts`) è applicata da `calcolaGiornata` a ogni permesso; le eccedenze escono dalle lavorate (ore coperte invariate), come già per la pausa sigaretta. Il permesso pianificato è un campo della giornata (`permessoUscitaMinuti`) letto dal calcolo per l'uscita prevista e per la chiusura con *Uscita*. La pausa da proporre è una funzione pura (`src/core/pausaPranzo.ts`) usata da un riquadro della vista Oggi (`src/ui/pausaSaltata.ts`).

**Tech Stack:** TypeScript 5.9 senza framework (helper `el()` in `src/ui/dom.ts`), Vite 8 + vite-plugin-pwa, Vitest 5 (ambiente node, nessun DOM nei test), localStorage.

**Spec:** `docs/superpowers/specs/2026-10-03-pause-e-permessi-design.md`

## Global Constraints

- Testi dell'interfaccia, nomi e commenti in **italiano**, come il resto del codice.
- Nessuna nuova dipendenza npm. Nessun cambio di `VERSIONE_CORRENTE` (oggi `1`).
- `BLOCCO_PERMESSO = 30`; `permessoABlocchi(d)` = `0` se `d ≤ 0`, altrimenti `ceil(d / 30) × 30`.
- Ogni permesso si arrotonda per conto suo; le eccedenze si tolgono dalle lavorate, mai sotto zero; ore coperte e saldo dei permessi chiusi non cambiano rispetto al tempo reale.
- Pausa sigaretta invariata (almeno un blocco). `Ripartizione` invariata (parte di permesso reale).
- Permesso pianificato: `Giornata.permessoUscitaMinuti`, predefinito 0, intero 0–1440; colonna CSV `Permesso in uscita (min)` subito dopo `Permesso inizio giornata (min)`.
- Pausa proposta: inizio `pranzo.inizio + 15`, durata `30` (12:15–12:45 con la fascia predefinita); chiave locale `timbrature-pausa-saltata` = data del "No".
- Comandi: `npm test`, `npx tsc --noEmit`, `npm run build`, `npm run dev` (`http://localhost:5173/krumiro2.0/`).
- Branch `feature/10-12-13-pausa-e-permessi`. Ogni commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Permesso pianificato più lungo delle ore rimaste** (es. 4h quando ne mancano 3h30) → l'uscita prevista risulta già passata ("Ore completate alle…") e all'*Uscita* conta il mancante reale a blocchi, saldo 0 (Task 4, test "pianificato più lungo delle ore rimaste").
2. **"No, l'ho saltata" vale solo per quel giorno** → il giorno dopo il riquadro ricompare (Task 7, verifica manuale "chiave di un altro giorno").
3. **Giornata con solo il permesso pianificato** (inserito prima dell'entrata) → non sparisce al salvataggio, resta nel CSV e nel backup (Task 3, test `haContenuto` e CSV "giornata con solo il permesso").
4. **Permesso a inizio giornata non multiplo di 30 con poco lavoro** (es. 40 min dichiarati, entrata da 5 minuti) → le coperte non superano tempo trascorso + dichiarato (Task 2, test "permesso a inizio giornata con poco lavoro").
5. **Aggiungere la pausa a giornata già chiusa** → la giornata resta coerente (nessun "da correggere") e il saldo cala di 30 min (Task 5, test "a giornata chiusa senza pausa la propone"; Task 7, verifica manuale "Aggiungi a giornata chiusa").

---

## File Structure

| File | Ruolo |
|---|---|
| `src/core/permessi.ts` (nuovo) | `BLOCCO_PERMESSO`, `permessoABlocchi` |
| `src/core/sigaretta.ts` (modifica) | Usa la costante e la funzione comuni |
| `src/core/tipi.ts` (modifica) | `PermessoABlocchi`, campi nuovi di `RisultatoGiornata`, `Giornata.permessoUscitaMinuti` |
| `src/core/calcolo.ts` (modifica) | Blocchi su ogni permesso; permesso pianificato in uscita prevista e chiusura |
| `src/core/pausaPranzo.ts` (nuovo) | `pausaDaProporre` |
| `src/storage/store.ts`, `src/storage/migrazioni.ts`, `src/core/riepilogo.ts`, `src/core/csv.ts` (modifica) | Persistenza del permesso pianificato |
| `src/ui/editor.ts` (modifica) | `editorPermessoUscita`; passo 30 in *Entro dopo* |
| `src/ui/giorno.ts` (modifica) | Timeline, note dell'uscita prevista, conferma uscita anticipata, toast di *Uscita*, riquadro pausa |
| `src/ui/pausaSaltata.ts` (nuovo) | Riquadro "Non hai registrato la pausa pranzo" e chiave locale |
| `src/style.css` (modifica) | Stile del riquadro |
| `src/ui/aiutoTesti.ts`, `README.md` (modifica) | Testi |
| `tests/permessi.test.ts`, `tests/pausaPranzo.test.ts` (nuovi), `tests/calcolo.test.ts`, `tests/csv.test.ts`, `tests/migrazioni.test.ts`, `tests/aiuto.test.ts`, `tests/helpers.ts` | Test |

---

### Task 1: Blocchi da 30 minuti (logica pura)

**Files:**
- Create: `src/core/permessi.ts`
- Modify: `src/core/sigaretta.ts` (righe ~5–11: costante e `permessoSigaretta`)
- Test: `tests/permessi.test.ts`

**Interfaces:**
- Produces: `export const BLOCCO_PERMESSO = 30;` · `export function permessoABlocchi(durata: number): number`
- `BLOCCO_PERMESSO_SIGARETTA` e `permessoSigaretta` restano esportati da `sigaretta.ts` con lo stesso comportamento.

- [ ] **Step 1: Test che fallisce** — creare `tests/permessi.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BLOCCO_PERMESSO, permessoABlocchi } from '../src/core/permessi';
import { permessoSigaretta } from '../src/core/sigaretta';

describe('permessi a blocchi', () => {
  it('arrotonda per eccesso alla mezz\'ora', () => {
    expect(BLOCCO_PERMESSO).toBe(30);
    expect(permessoABlocchi(1)).toBe(30);
    expect(permessoABlocchi(30)).toBe(30);
    expect(permessoABlocchi(31)).toBe(60);
    expect(permessoABlocchi(83)).toBe(90);
  });

  it('nessun permesso resta nessun permesso', () => {
    expect(permessoABlocchi(0)).toBe(0);
    expect(permessoABlocchi(-5)).toBe(0);
  });

  it('la pausa sigaretta vale sempre almeno un blocco', () => {
    expect(permessoSigaretta(0)).toBe(30);
    expect(permessoSigaretta(42)).toBe(60);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/permessi.test.ts` → FAIL (modulo `permessi` inesistente).

- [ ] **Step 3: Implementare** — creare `src/core/permessi.ts`:

```ts
/** Ogni permesso usato vale un multiplo di questa durata (minuti). */
export const BLOCCO_PERMESSO = 30;

/** Permesso conteggiato per `durata` minuti reali: blocchi da 30 per eccesso, 0 se non c'è permesso. */
export function permessoABlocchi(durata: number): number {
  return durata > 0 ? Math.ceil(durata / BLOCCO_PERMESSO) * BLOCCO_PERMESSO : 0;
}
```

In `src/core/sigaretta.ts` aggiungere in testa `import { BLOCCO_PERMESSO, permessoABlocchi } from './permessi';` e sostituire costante e funzione:

```ts
/** Oltre la tolleranza la pausa sigaretta diventa permesso a blocchi di questa durata (minuti). */
export const BLOCCO_PERMESSO_SIGARETTA = BLOCCO_PERMESSO;

/** Permesso conteggiato per una pausa sigaretta di `durata` minuti: blocchi da 30, almeno uno. */
export function permessoSigaretta(durata: number): number {
  return Math.max(BLOCCO_PERMESSO, permessoABlocchi(durata));
}
```

- [ ] **Step 4:** `npx vitest run tests/permessi.test.ts tests/sigaretta.test.ts` → PASS; `npx tsc --noEmit` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add src/core/permessi.ts src/core/sigaretta.ts tests/permessi.test.ts
git commit -F - <<'EOF'
Permessi: blocchi da 30 minuti (logica pura)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Calcolo — ogni permesso a blocchi (#12)

**Files:**
- Modify: `src/core/tipi.ts` (tipo nuovo prima di `RisultatoGiornata`; campi in `RisultatoGiornata`)
- Modify: `src/core/calcolo.ts` (import; sezione 3 e totali, righe ~133–205; `return`)
- Test: `tests/calcolo.test.ts`, `tests/csv.test.ts` (riepilogo)

**Interfaces:**
- Consumes: `permessoABlocchi` (Task 1).
- Produces:
  - `export interface PermessoABlocchi { eventoRientroId?: string; da: number; a: number; durata: number; permesso: number }`
  - `RisultatoGiornata.permessoInizioDichiarato: number` (minuti inseriti; `permessoInizio` diventa il valore a blocchi)
  - `RisultatoGiornata.permessiIntermedi: PermessoABlocchi[]` (intermedi conclusi non sigaretta, con o senza ripartizione)

- [ ] **Step 1: Test che falliscono** — in `tests/calcolo.test.ts`, in fondo al file:

```ts
describe('permessi a blocchi da 30 min', () => {
  it('uscita anticipata con 1h23 mancanti → 1h30 di permesso, lavorate −7, saldo 0', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA_ANTICIPATA', '16:07'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.permessoUscita).toBe(90);
    expect(r.lavorati).toBe(397 - 7);
    expect(r.coperti).toBe(480);
    expect(r.saldo).toBe(0);
  });

  it('permesso intermedio di 40 min → 1h, lavorate −20, coperte invariate', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
      ['RIENTRO_PERMESSO', '10:40'],
      ['INIZIO_PAUSA', '12:30'],
      ['FINE_PAUSA', '13:30'],
      ['USCITA', '17:30'],
    ]);
    const r = calcolaGiornata(g, imp, null);
    expect(r.permessoIntermedio).toBe(60);
    expect(r.lavorati).toBe(440 - 20);
    expect(r.coperti).toBe(480);
    expect(r.saldo).toBe(0);
    expect(r.permessiIntermedi).toEqual([
      { eventoRientroId: g.eventi[2]!.id, da: h('10:00'), a: h('10:40'), durata: 40, permesso: 60 },
    ]);
  });

  it('due permessi da 20 min valgono 30 + 30', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
      ['RIENTRO_PERMESSO', '10:20'],
      ['USCITA_PERMESSO', '11:00'],
      ['RIENTRO_PERMESSO', '11:20'],
    ]);
    const r = calcolaGiornata(g, imp, h('12:00'));
    expect(r.permessoIntermedio).toBe(60);
    expect(r.permessiIntermedi.map((p) => p.permesso)).toEqual([30, 30]);
    expect(r.lavorati).toBe(170 - 20);
  });

  it('permesso a inizio giornata di 40 min → 1h, lavorate −20, uscita invariata', () => {
    const g = giornata(
      [
        ['ENTRATA', '09:10'],
        ['INIZIO_PAUSA', '12:30'],
        ['FINE_PAUSA', '13:30'],
      ],
      { permessoInizio: 40 },
    );
    const r = calcolaGiornata(g, imp, h('14:00'));
    expect(r.permessoInizio).toBe(60);
    expect(r.permessoInizioDichiarato).toBe(40);
    expect(r.lavorati).toBe(230 - 20);
    expect(uscita(r)).toBe('17:30');
  });

  it('permesso a inizio giornata con poco lavoro: le coperte non superano tempo + dichiarato', () => {
    const g = giornata([['ENTRATA', '09:10']], { permessoInizio: 40 });
    const r = calcolaGiornata(g, imp, h('09:15'));
    expect(r.lavorati).toBe(0);
    expect(r.coperti).toBe(45);
  });

  it('con la pausa pranzo di mezzo si arrotonda la sola parte di permesso', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '12:00'],
      ['RIENTRO_PERMESSO', '14:10'],
    ]);
    const r = calcolaGiornata(g, imp, h('15:00'));
    expect(r.ripartizioni[0]).toMatchObject({ pausa: 60, permesso: 70 });
    expect(r.permessiIntermedi[0]).toMatchObject({ durata: 70, permesso: 90 });
    expect(r.permessoIntermedio).toBe(90);
    expect(r.lavorati).toBe(210 + 50 - 20);
  });

  it('un permesso in corso conta il tempo reale', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:00'],
    ]);
    const r = calcolaGiornata(g, imp, h('10:40'));
    expect(r.permessoIntermedio).toBe(40);
    expect(r.permessiIntermedi).toEqual([]);
  });

  it('se il lavoro non basta ad assorbire l\'eccedenza le coperte non superano il tempo trascorso', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '08:35'],
      ['RIENTRO_PERMESSO', '08:45'],
    ]);
    const r = calcolaGiornata(g, imp, h('08:50'));
    expect(r.lavorati).toBe(0);
    expect(r.coperti).toBe(20);
  });

  it('con ore dovute non multiple di 30 l\'uscita anticipata non supera le dovute', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_ANTICIPATA', '08:30'],
    ]);
    const r = calcolaGiornata(g, impostazioni({ minutiDovuti: { predefinito: 432, perGiorno: [0, null, null, null, null, null, 0] } }), null);
    expect(r.permessoUscita).toBe(432);
    expect(r.saldo).toBe(0);
  });
});
```

Nello stesso file, nel test `'la pausa scalata non supera il totale configurato su più permessi'`, sostituire `expect(r.permessoIntermedio).toBe(0 + 45);` con:

```ts
    // Seconda uscita: 45 min di permesso reale → 1h (blocchi).
    expect(r.permessoIntermedio).toBe(0 + 60);
```

In `tests/csv.test.ts`, test `'somma lavorate, permessi e saldo del mese'`, sostituire `expect(r.permesso).toBe(120 + 105);` con:

```ts
    // 2026-10-02: permesso 12:00–14:30 con 45 di pausa → 105 reali → 2h a blocchi.
    expect(r.permesso).toBe(120 + 120);
```

- [ ] **Step 2:** `npx vitest run tests/calcolo.test.ts tests/csv.test.ts` → FAIL (campi `permessiIntermedi`/`permessoInizioDichiarato` assenti, valori non a blocchi).

- [ ] **Step 3: Tipi** — in `src/core/tipi.ts`, prima di `export interface RisultatoGiornata`:

```ts
/** Permesso intermedio concluso (non sigaretta): parte di permesso reale e valore a blocchi. */
export interface PermessoABlocchi {
  /** Id dell'evento RIENTRO_PERMESSO che l'ha chiuso. */
  eventoRientroId?: string;
  da: number;
  a: number;
  /** Parte di permesso reale in minuti (esclusa l'eventuale quota di pausa pranzo). */
  durata: number;
  /** Permesso conteggiato (blocchi da 30 min). */
  permesso: number;
}
```

In `RisultatoGiornata`, dopo `permessoInizio: number;`:

```ts
  /** Permesso a inizio giornata inserito; `permessoInizio` è il valore a blocchi. */
  permessoInizioDichiarato: number;
```

e dopo `sigarette: PermessoSigaretta[];`:

```ts
  permessiIntermedi: PermessoABlocchi[];
```

- [ ] **Step 4: Calcolo** — in `src/core/calcolo.ts`:

Import: aggiungere `import { permessoABlocchi } from './permessi';` e `PermessoABlocchi` all'import dei tipi:

```ts
import type { Giornata, Impostazioni, PermessoABlocchi, PermessoSigaretta, Ripartizione, RisultatoGiornata } from './tipi';
```

Sostituire tutto dal commento `// 3. Permessi intermedi…` fino alla riga `const pausaFatta = pausaRegistrata || pausaScalata > 0;` compresa con:

```ts
  // 3. Permessi intermedi, con eventuale quota di pausa se coprono il pranzo. Ogni permesso
  //    concluso vale blocchi da 30 min: l'eccedenza sul tempo reale passa dalle lavorate al
  //    permesso (ore coperte invariate).
  const ripartizioni: Ripartizione[] = [];
  const sigarette: PermessoSigaretta[] = [];
  const permessiIntermedi: PermessoABlocchi[] = [];
  let permessoIntermedio = 0;
  let pausaScalata = 0;
  let residuoDaScalare = imp.pausaDaScalare;
  let eccedenza = 0;
  for (const i of intervalli) {
    if (i.tipo !== 'permesso') continue;
    const d = i.a - i.da;
    if (i.sigaretta) {
      // Mai pausa pranzo; conclusa vale almeno un blocco.
      if (i.aperto) {
        permessoIntermedio += d;
      } else {
        // Tutta prima dell'inizio conteggio: quel tempo non conta, quindi nemmeno il permesso.
        const primaDelConteggio = i.rientroReale !== undefined && i.rientroReale <= minimo;
        const permesso = primaDelConteggio ? 0 : permessoSigaretta(d);
        permessoIntermedio += permesso;
        eccedenza += permesso - d;
        sigarette.push({ eventoRientroId: i.rientroId, da: i.da, a: i.a, durata: d, permesso });
      }
      continue;
    }
    let pausa = 0;
    const overlap = pausaRegistrata ? 0 : sovrapposizione(i.da, i.a, imp.pranzo.inizio, imp.pranzo.fine);
    if (overlap > 0) {
      const proposta = Math.min(residuoDaScalare, overlap);
      const confermata = i.pausaConfermata !== undefined;
      pausa = Math.min(d, Math.max(0, confermata ? i.pausaConfermata! : proposta));
      residuoDaScalare = Math.max(0, residuoDaScalare - pausa);
      pausaScalata += pausa;
      ripartizioni.push({
        eventoRientroId: i.rientroId,
        da: i.da,
        a: i.a,
        proposta,
        pausa,
        permesso: d - pausa,
        confermata,
      });
    }
    const parte = d - pausa;
    if (i.aperto) {
      permessoIntermedio += parte;
    } else {
      const permesso = permessoABlocchi(parte);
      permessoIntermedio += permesso;
      eccedenza += permesso - parte;
      permessiIntermedi.push({ eventoRientroId: i.rientroId, da: i.da, a: i.a, durata: parte, permesso });
    }
  }

  // Permesso a inizio giornata, anch'esso a blocchi.
  const permessoInizioDichiarato =
    Number.isFinite(giornata.permessoInizioMinuti) && giornata.permessoInizioMinuti > 0
      ? giornata.permessoInizioMinuti
      : 0;
  let permessoInizio = permessoABlocchi(permessoInizioDichiarato);
  eccedenza += permessoInizio - permessoInizioDichiarato;

  // L'eccedenza si toglie solo dal lavoro che c'è: le coperte non superano mai il tempo trascorso.
  const lavoroNetto = Math.max(0, lavoroLordo - penalitaPausa);
  const eccedenzaApplicata = Math.min(eccedenza, lavoroNetto);
  let nonAssorbita = eccedenza - eccedenzaApplicata;
  const riduci = (v: number) => {
    const t = Math.min(v, nonAssorbita);
    nonAssorbita -= t;
    return v - t;
  };
  permessoIntermedio = riduci(permessoIntermedio);
  permessoInizio = riduci(permessoInizio);
  let lavorati = lavoroNetto - eccedenzaApplicata;

  // 4. Totali. Uscita anticipata: il permesso in uscita è quello che manca davvero, a blocchi
  //    (l'eccedenza esce dalle lavorate rimaste, le coperte arrivano alle dovute).
  const dovuti = minutiDovuti(giornata.data, imp);
  let permessoUscita = 0;
  if (anticipata) {
    const mancante = Math.max(0, dovuti - (lavorati + permessoInizio + permessoIntermedio));
    const eccedenzaUscita = Math.min(permessoABlocchi(mancante) - mancante, lavorati);
    permessoUscita = mancante + eccedenzaUscita;
    lavorati -= eccedenzaUscita;
  }
  const coperti = lavorati + permessoInizio + permessoIntermedio + permessoUscita;
  const pausaFatta = pausaRegistrata || pausaScalata > 0;
```

Nel `return`, dopo `permessoInizio,` aggiungere `permessoInizioDichiarato,` e dopo `sigarette,` aggiungere `permessiIntermedi,`.

- [ ] **Step 5:** `npx vitest run tests/calcolo.test.ts tests/csv.test.ts` → PASS. `npm test` → tutti PASS. `npx tsc --noEmit` → nessun errore.

- [ ] **Step 6: Commit**

```bash
git add src/core/tipi.ts src/core/calcolo.ts tests/calcolo.test.ts tests/csv.test.ts
git commit -F - <<'EOF'
Calcolo: ogni permesso vale un multiplo di 30 minuti (#12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Permesso in uscita pianificato — dato e persistenza (#13)

**Files:**
- Modify: `src/core/tipi.ts` (`Giornata`), `src/storage/store.ts` (`giornata`, `modificaGiornata`), `src/core/riepilogo.ts` (`haContenuto`), `src/storage/migrazioni.ts` (`normalizzaGiornata`), `src/core/csv.ts` (intestazione, export, import)
- Modify: `tests/helpers.ts` (opzione `permessoUscita`)
- Test: `tests/migrazioni.test.ts`, `tests/csv.test.ts`

**Interfaces:**
- Produces: `Giornata.permessoUscitaMinuti: number`; helper di test `giornata(eventi, { permessoUscita?: number })`.

- [ ] **Step 1: Helper di test** — in `tests/helpers.ts`, firma e corpo di `giornata`:

```ts
export function giornata(
  eventi: [TipoEvento, string, number?][],
  opz: { permessoInizio?: number; permessoUscita?: number; data?: string } = {},
): Giornata {
  return {
    data: opz.data ?? GIOVEDI,
    permessoInizioMinuti: opz.permessoInizio ?? 0,
    permessoUscitaMinuti: opz.permessoUscita ?? 0,
    eventi: eventi.map(([tipo, ora, pausaConfermata]): Evento => {
      const e: Evento = { id: `e${++n}`, tipo, minuti: h(ora) };
      if (pausaConfermata !== undefined) e.pausaConfermata = pausaConfermata;
      return e;
    }),
  };
}
```

- [ ] **Step 2: Test che falliscono**

In `tests/migrazioni.test.ts`, dentro `describe('migrazioni', …)`:

```ts
  it('permesso in uscita pianificato: predefinito 0, valori non validi scartati', () => {
    const permesso = (v: unknown) =>
      migra({ version: 1, giornate: { '2026-10-01': { data: '2026-10-01', permessoInizioMinuti: 0, permessoUscitaMinuti: v, eventi: [] } } })
        .giornate['2026-10-01']!.permessoUscitaMinuti;
    expect(permesso(undefined)).toBe(0);
    expect(permesso(60)).toBe(60);
    expect(permesso(-30)).toBe(0);
    expect(permesso(7.5)).toBe(0);
    expect(permesso('30')).toBe(0);
  });
```

In `tests/csv.test.ts`:
- import: `import { haContenuto, riepilogoMese } from '../src/core/riepilogo';`
- nel test `'esporta con separatore ; e decimali con virgola'` sostituire le due aspettative di `righe[0]` e `righe[1]` con:

```ts
    expect(righe[0]).toBe(
      'Data;Giorno;Ore dovute;Ore lavorate;Ore permesso;Saldo;Stato;Permesso inizio giornata (min);Permesso in uscita (min);Eventi',
    );
    expect(righe[1]).toBe(
      '2026-10-01;Giovedì;8,00;6,25;2,00;0,25;Giornata chiusa;120;0;10:30 Entrata, 12:30 Inizio pausa, 13:30 Fine pausa, 17:45 Uscita',
    );
```

- nel test `'round trip esporta → importa'`, dopo `expect(i.permessoInizioMinuti)…`: `expect(i.permessoUscitaMinuti).toBe(g.permessoUscitaMinuti);`
- nuovi test nel `describe` dell'export/import (stesso blocco del round trip):

```ts
  it('giornata con solo il permesso in uscita: esportata e reimportata', () => {
    const g = giornata([], { permessoUscita: 60, data: '2026-10-06' });
    const csv = esportaCsv({ [g.data]: g }, imp, oggi);
    expect(csv).toContain(';0;60;');
    const i = importaCsv(csv)['2026-10-06']!;
    expect(i.permessoUscitaMinuti).toBe(60);
    expect(i.eventi).toEqual([]);
  });

  it('CSV senza la colonna del permesso in uscita: vale 0; valore non valido: errore', () => {
    expect(importaCsv('Data;Eventi\r\n2026-10-02;08:30 Entrata\r\n')['2026-10-02']!.permessoUscitaMinuti).toBe(0);
    expect(() => importaCsv('Data;Permesso in uscita (min);Eventi\r\n2026-10-02;-30;08:30 Entrata\r\n')).toThrow(/permesso in uscita/);
  });
```

- nel `describe('riepilogo mensile', …)`:

```ts
  it('una giornata con solo il permesso in uscita ha contenuto', () => {
    expect(haContenuto(giornata([], { permessoUscita: 30 }))).toBe(true);
    expect(haContenuto(giornata([]))).toBe(false);
  });
```

- [ ] **Step 3:** `npx vitest run tests/migrazioni.test.ts tests/csv.test.ts` → FAIL (campo assente nelle giornate normalizzate e nel CSV).

- [ ] **Step 4: Implementare**

`src/core/tipi.ts`, in `Giornata` dopo `permessoInizioMinuti: number;`:

```ts
  /** Permesso in uscita pianificato, in minuti: anticipa l'uscita prevista. */
  permessoUscitaMinuti: number;
```

`src/storage/store.ts`:

```ts
  giornata(data: string): Giornata {
    return this.dati.giornate[data] ?? { data, permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [] };
  }
```

e in `modificaGiornata`:

```ts
    if (g.eventi.length === 0 && g.permessoInizioMinuti === 0 && g.permessoUscitaMinuti === 0) delete this.dati.giornate[data];
```

`src/core/riepilogo.ts`:

```ts
export function haContenuto(g: Giornata): boolean {
  return g.eventi.length > 0 || g.permessoInizioMinuti > 0 || g.permessoUscitaMinuti > 0;
}
```

`src/storage/migrazioni.ts`, `return` di `normalizzaGiornata`:

```ts
  return {
    data,
    permessoInizioMinuti: intIn(g.permessoInizioMinuti, 0, 1440) ?? 0,
    permessoUscitaMinuti: intIn(g.permessoUscitaMinuti, 0, 1440) ?? 0,
    eventi,
  };
```

`src/core/csv.ts`:
- `INTESTAZIONE`: dopo `'Permesso inizio giornata (min)',` aggiungere `'Permesso in uscita (min)',`;
- export: dopo `String(g.permessoInizioMinuti),` aggiungere `String(g.permessoUscitaMinuti),`;
- import: dopo `const iPermesso = …` aggiungere

```ts
  const iPermessoUscita = intest.findIndex((c) => c.startsWith('permesso in uscita'));
```

dopo il controllo del permesso a inizio giornata aggiungere

```ts
    const permessoUscita = iPermessoUscita >= 0 ? Number((r[iPermessoUscita] ?? '0').trim() || '0') : 0;
    if (!Number.isFinite(permessoUscita) || permessoUscita < 0) {
      throw new ErroreImportazione(`Riga ${n + 2}: permesso in uscita non valido.`);
    }
```

e sostituire l'assegnazione finale con

```ts
    giornate[data] = { data, permessoInizioMinuti: permesso, permessoUscitaMinuti: permessoUscita, eventi };
```

- [ ] **Step 5:** `npx vitest run tests/migrazioni.test.ts tests/csv.test.ts` → PASS. `npm test` → tutti PASS. `npx tsc --noEmit` → nessun errore (se il compilatore segnala altri letterali `Giornata` senza il campo, aggiungere `permessoUscitaMinuti: 0`).

- [ ] **Step 6: Commit**

```bash
git add src/core/tipi.ts src/storage/store.ts src/core/riepilogo.ts src/storage/migrazioni.ts src/core/csv.ts tests/helpers.ts tests/migrazioni.test.ts tests/csv.test.ts
git commit -F - <<'EOF'
Permesso in uscita pianificato: dato, backup e CSV (#13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Calcolo — permesso pianificato (#13)

**Files:**
- Modify: `src/core/tipi.ts` (`RisultatoGiornata`), `src/core/calcolo.ts` (ciclo eventi, totali, uscita prevista, `return`)
- Test: `tests/calcolo.test.ts`

**Interfaces:**
- Consumes: `Giornata.permessoUscitaMinuti` (Task 3), `permessoABlocchi` (Task 1), struttura dei totali del Task 2.
- Produces: `RisultatoGiornata.permessoUscitaPianificato: number`, `RisultatoGiornata.uscitaPrevistaConPermesso: boolean`.

- [ ] **Step 1: Test che falliscono** — in fondo a `tests/calcolo.test.ts`:

```ts
describe('permesso in uscita pianificato', () => {
  const pausaFatta = (): [TipoEvento, string][] => [
    ['ENTRATA', '08:30'],
    ['INIZIO_PAUSA', '12:30'],
    ['FINE_PAUSA', '13:30'],
  ];

  it('anticipa l\'uscita prevista', () => {
    const r = calcolaGiornata(giornata(pausaFatta(), { permessoUscita: 30 }), imp, h('14:00'));
    expect(uscita(r)).toBe('17:00');
    expect(r.uscitaPrevistaConPermesso).toBe(true);
    expect(r.permessoUscitaPianificato).toBe(30);
  });

  it('con la pausa ancora da fare la pausa si aggiunge dopo la sottrazione', () => {
    const r = calcolaGiornata(giornata([['ENTRATA', '08:30']], { permessoUscita: 30 }), imp, h('10:00'));
    expect(uscita(r)).toBe('17:00');
    expect(r.uscitaPrevistaConPausa).toBe(true);
  });

  it('in pausa: uscita se rientri ora, meno il pianificato', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']], { permessoUscita: 30 });
    expect(uscita(calcolaGiornata(g, imp, h('12:40')))).toBe('16:30');
  });

  it('uscendo con Uscita conta il permesso che manca davvero, a blocchi', () => {
    const casi: [string, number, number][] = [
      ['17:00', 30, 0],
      ['16:45', 60, 0],
      ['17:15', 30, 0],
      ['17:45', 0, 15],
    ];
    for (const [ora, permesso, saldo] of casi) {
      const r = calcolaGiornata(giornata([...pausaFatta(), ['USCITA', ora]], { permessoUscita: 30 }), imp, null);
      expect(r.permessoUscita, ora).toBe(permesso);
      expect(r.saldo, ora).toBe(saldo);
    }
  });

  it('senza permesso pianificato l\'uscita normale non genera permesso', () => {
    const r = calcolaGiornata(giornata([...pausaFatta(), ['USCITA', '17:00']]), imp, null);
    expect(r.permessoUscita).toBe(0);
    expect(r.saldo).toBe(-30);
    expect(r.uscitaPrevistaConPermesso).toBe(false);
  });

  it('con uscita anticipata il pianificato non conta', () => {
    const r = calcolaGiornata(giornata([...pausaFatta(), ['USCITA_ANTICIPATA', '16:45']], { permessoUscita: 30 }), imp, null);
    expect(r.permessoUscita).toBe(60);
  });

  it('pianificato più lungo delle ore rimaste: uscita prevista già passata, all\'uscita conta il mancante reale', () => {
    expect(uscita(calcolaGiornata(giornata(pausaFatta(), { permessoUscita: 240 }), imp, h('14:00')))).toBe('13:30');
    const r = calcolaGiornata(giornata([...pausaFatta(), ['USCITA', '14:00']], { permessoUscita: 240 }), imp, null);
    expect(r.permessoUscita).toBe(210);
    expect(r.saldo).toBe(0);
  });
});
```

Aggiungere `TipoEvento` all'import dei tipi in cima al file: `import type { Giornata, TipoEvento } from '../src/core/tipi';`.

- [ ] **Step 2:** `npx vitest run tests/calcolo.test.ts` → FAIL (uscita prevista non anticipata, campi assenti).

- [ ] **Step 3: Implementare**

`src/core/tipi.ts`, in `RisultatoGiornata` dopo `uscitaPrevistaConPausa: boolean;`:

```ts
  /** True se l'uscita prevista è anticipata dal permesso in uscita pianificato. */
  uscitaPrevistaConPermesso: boolean;
  /** Minuti del permesso in uscita pianificato della giornata. */
  permessoUscitaPianificato: number;
```

`src/core/calcolo.ts`:
- accanto a `let anticipata = false;` aggiungere `let uscitaNormale = false;`;
- nel `switch`, `case 'USCITA':` diventa

```ts
      case 'USCITA':
        chiudi(t);
        uscitaNormale = true;
        break;
```

- sostituire il blocco dei totali del Task 2 (da `// 4. Totali.` a `const coperti = …`) con:

```ts
  // 4. Totali. Uscita anticipata, o uscita normale con un permesso pianificato: il permesso in
  //    uscita è quello che manca davvero, a blocchi (l'eccedenza esce dalle lavorate rimaste,
  //    le coperte arrivano alle dovute).
  const dovuti = minutiDovuti(giornata.data, imp);
  const pianificato =
    Number.isFinite(giornata.permessoUscitaMinuti) && giornata.permessoUscitaMinuti > 0
      ? giornata.permessoUscitaMinuti
      : 0;
  let permessoUscita = 0;
  if (anticipata || (uscitaNormale && pianificato > 0)) {
    const mancante = Math.max(0, dovuti - (lavorati + permessoInizio + permessoIntermedio));
    const eccedenzaUscita = Math.min(permessoABlocchi(mancante) - mancante, lavorati);
    permessoUscita = mancante + eccedenzaUscita;
    lavorati -= eccedenzaUscita;
  }
  const coperti = lavorati + permessoInizio + permessoIntermedio + permessoUscita;
```

- nella sezione `// 5. Uscita prevista.`: il commento diventa `// 5. Uscita prevista (anticipata dal permesso in uscita pianificato).`; in `AL_LAVORO` sostituire `uscitaPrevista = ora + (dovuti - coperti);` con `uscitaPrevista = ora + (dovuti - coperti - pianificato);`; in `IN_PAUSA` sostituire `uscitaPrevista = rientro + (dovuti - coperti);` con `uscitaPrevista = rientro + (dovuti - coperti - pianificato);`; dopo l'intero blocco `if … else if …` aggiungere

```ts
  const uscitaPrevistaConPermesso = uscitaPrevista !== null && pianificato > 0;
```

- nel `return`, dopo `uscitaPrevistaConPausa,` aggiungere `uscitaPrevistaConPermesso,` e `permessoUscitaPianificato: pianificato,`.

- [ ] **Step 4:** `npx vitest run tests/calcolo.test.ts` → PASS. `npm test` → tutti PASS. `npx tsc --noEmit` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add src/core/tipi.ts src/core/calcolo.ts tests/calcolo.test.ts
git commit -F - <<'EOF'
Calcolo: il permesso in uscita pianificato anticipa l'uscita prevista (#13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Pausa pranzo da proporre (logica pura, #10)

**Files:**
- Create: `src/core/pausaPranzo.ts`
- Test: `tests/pausaPranzo.test.ts`

**Interfaces:**
- Consumes: `calcolaGiornata` (`pausaFatta`), `analizzaGiornata` (`idScartati`).
- Produces: `export const OFFSET_PAUSA_PROPOSTA = 15;` · `export const DURATA_PAUSA_PROPOSTA = 30;` · `export function pausaDaProporre(giornata: Giornata, imp: Impostazioni, adesso: number | null): { inizio: number; fine: number } | null`

- [ ] **Step 1: Test che falliscono** — creare `tests/pausaPranzo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pausaDaProporre } from '../src/core/pausaPranzo';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const mattina = () => giornata([['ENTRATA', '08:30']]);

describe('pausa pranzo da proporre', () => {
  it('prima della fine della fascia pranzo non propone nulla', () => {
    expect(pausaDaProporre(mattina(), imp, h('14:29'))).toBeNull();
  });

  it('dopo la fascia, senza pausa, propone 12:15–12:45', () => {
    expect(pausaDaProporre(mattina(), imp, h('14:30'))).toEqual({ inizio: h('12:15'), fine: h('12:45') });
  });

  it('non propone se la pausa è registrata', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '13:00'], ['FINE_PAUSA', '13:30']]);
    expect(pausaDaProporre(g, imp, h('15:00'))).toBeNull();
  });

  it('non propone se un permesso copre il pranzo', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '12:00'], ['RIENTRO_PERMESSO', '13:30']]);
    expect(pausaDaProporre(g, imp, h('15:00'))).toBeNull();
  });

  it('non propone se a quell\'ora non eri al lavoro', () => {
    expect(pausaDaProporre(giornata([['ENTRATA', '13:00']]), imp, h('15:00'))).toBeNull();
    expect(pausaDaProporre(giornata([['ENTRATA', '08:30'], ['USCITA', '12:30']]), imp, h('15:00'))).toBeNull();
    expect(pausaDaProporre(giornata([]), imp, h('15:00'))).toBeNull();
  });

  it('non propone con timbrature incoerenti', () => {
    const g = giornata([['ENTRATA', '08:30'], ['FINE_PAUSA', '10:00']]);
    expect(pausaDaProporre(g, imp, h('15:00'))).toBeNull();
  });

  it('a giornata chiusa senza pausa la propone', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA', '17:00']]);
    expect(pausaDaProporre(g, imp, h('17:30'))).toEqual({ inizio: h('12:15'), fine: h('12:45') });
  });

  it('segue la fascia pranzo delle impostazioni', () => {
    const tardi = impostazioni({ pranzo: { inizio: h('13:00'), fine: h('15:00') } });
    expect(pausaDaProporre(mattina(), tardi, h('15:00'))).toEqual({ inizio: h('13:15'), fine: h('13:45') });
  });

  it('se la pausa non sta nella fascia non propone nulla', () => {
    const corta = impostazioni({ pranzo: { inizio: h('12:00'), fine: h('12:30') } });
    expect(pausaDaProporre(mattina(), corta, h('13:00'))).toBeNull();
  });

  it('per le giornate passate non propone nulla', () => {
    expect(pausaDaProporre(mattina(), imp, null)).toBeNull();
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/pausaPranzo.test.ts` → FAIL (modulo inesistente).

- [ ] **Step 3: Implementare** — creare `src/core/pausaPranzo.ts`:

```ts
import { calcolaGiornata } from './calcolo';
import { analizzaGiornata } from './statoGiornata';
import type { Giornata, Impostazioni } from './tipi';

/** La pausa proposta inizia 15 minuti dopo l'inizio della fascia pranzo e dura 30 minuti (12:15–12:45). */
export const OFFSET_PAUSA_PROPOSTA = 15;
export const DURATA_PAUSA_PROPOSTA = 30;

/**
 * Pausa pranzo da proporre per la giornata di oggi (`adesso` non null), passata la fascia pranzo
 * senza pausa: null se non serve o se a quell'ora non si era al lavoro.
 */
export function pausaDaProporre(
  giornata: Giornata,
  imp: Impostazioni,
  adesso: number | null,
): { inizio: number; fine: number } | null {
  if (adesso === null || adesso < imp.pranzo.fine) return null;
  const inizio = imp.pranzo.inizio + OFFSET_PAUSA_PROPOSTA;
  const fine = inizio + DURATA_PAUSA_PROPOSTA;
  if (fine > imp.pranzo.fine) return null;
  if (analizzaGiornata(giornata).idScartati.size > 0) return null;
  if (calcolaGiornata(giornata, imp, adesso).pausaFatta) return null;
  const conPausa: Giornata = {
    ...giornata,
    eventi: [
      ...giornata.eventi,
      { id: '__pausa_inizio__', tipo: 'INIZIO_PAUSA', minuti: inizio },
      { id: '__pausa_fine__', tipo: 'FINE_PAUSA', minuti: fine },
    ],
  };
  return analizzaGiornata(conPausa).idScartati.size === 0 ? { inizio, fine } : null;
}
```

- [ ] **Step 4:** `npx vitest run tests/pausaPranzo.test.ts` → PASS. `npm test` → tutti PASS. `npx tsc --noEmit` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add src/core/pausaPranzo.ts tests/pausaPranzo.test.ts
git commit -F - <<'EOF'
Pausa pranzo dimenticata: quando e come proporla (#10)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Interfaccia — permessi a blocchi e permesso in uscita (#12, #13)

**Files:**
- Modify: `src/ui/editor.ts` (import; `editorPermessoInizio` passo; nuova `editorPermessoUscita` dopo `editorPermessoInizio`)
- Modify: `src/ui/giorno.ts` (import; chiamata e funzione `timeline`; nota dell'uscita prevista; `eseguiAzione` per `USCITA_ANTICIPATA` e `USCITA`)

**Interfaces:**
- Consumes: `RisultatoGiornata.permessiIntermedi`, `.permessoInizioDichiarato` (Task 2); `.uscitaPrevistaConPermesso`, `.permessoUscitaPianificato` (Task 4); `Giornata.permessoUscitaMinuti` (Task 3); `BLOCCO_PERMESSO`, `permessoABlocchi` (Task 1).
- Produces: `export async function editorPermessoUscita(data: string): Promise<void>` in `src/ui/editor.ts`.

- [ ] **Step 1: Editor** — `src/ui/editor.ts`:
- import: `import { BLOCCO_PERMESSO, permessoABlocchi } from '../core/permessi';`
- in `editorPermessoInizio` sostituire `{ passo: 15, max: 12 * 60 }` con `{ passo: BLOCCO_PERMESSO, max: 12 * 60 }`;
- dopo `editorPermessoInizio` aggiungere:

```ts
/** Imposta il permesso in uscita pianificato: anticipa l'uscita prevista. */
export async function editorPermessoUscita(data: string): Promise<void> {
  const attuale = store.giornata(data).permessoUscitaMinuti;
  const durata = campoDurata('Durata del permesso', attuale || BLOCCO_PERMESSO, {
    passo: BLOCCO_PERMESSO,
    min: BLOCCO_PERMESSO,
    max: 12 * 60,
  });
  const preset = el(
    'div',
    { class: 'preset' },
    [30, 60, 90, 120].map((m) =>
      el('button', { type: 'button', class: 'chip', onclick: () => durata.imposta(m) }, formattaDurata(m)),
    ),
  );
  const contenuto = el(
    'div',
    { class: 'modulo' },
    el(
      'p',
      { class: 'nota' },
      'Ore di permesso per uscire prima: l\'uscita prevista si anticipa. All\'uscita conta il permesso che manca davvero, a blocchi di 30 min.',
    ),
    preset,
    durata.elemento,
  );
  const pulsanti: PulsanteFoglio[] = [
    {
      etichetta: 'Salva',
      stile: 'primario',
      azione: () => store.modificaGiornata(data, (g) => void (g.permessoUscitaMinuti = permessoABlocchi(durata.leggi()))),
    },
  ];
  if (attuale > 0) {
    pulsanti.push({
      etichetta: 'Rimuovi permesso',
      stile: 'pericolo',
      azione: () => store.modificaGiornata(data, (g) => void (g.permessoUscitaMinuti = 0)),
    });
  }
  pulsanti.push({ etichetta: 'Annulla' });
  await apriFoglio('Permesso in uscita', contenuto, pulsanti);
}
```

- [ ] **Step 2: Import e chiamata della timeline** — `src/ui/giorno.ts`:
- `import { ETICHETTE_EVENTO, type Evento, type Giornata, type RisultatoGiornata } from '../core/tipi';`
- `import { confermaRipartizione, editorEvento, editorPermessoInizio, editorPermessoUscita } from './editor';`
- in `vistaGiorno` sostituire la chiamata a `timeline(...)` con

```ts
    timeline(data, giornata, analisi.idScartati, r, oggi ? adesso.minuti : 9 * 60),
```

- [ ] **Step 3: Nota dell'uscita prevista** — in `schedaRiepilogo` sostituire le tre righe

```ts
    if (r.stato === 'IN_PAUSA') nota = 'se rientri ora (pausa minima inclusa)';
    else if (r.uscitaPrevistaConPausa) nota = `inclusa pausa pranzo di ${formattaDurata(store.impostazioni.pausaDaScalare)}`;
    else if (passata) nota = 'stai facendo straordinario';
```

con `nota = notaUscitaPrevista(r, passata);` e aggiungere dopo `schedaRiepilogo`:

```ts
/** Nota sotto l'uscita prevista: pausa minima, permesso in uscita, pausa pranzo inclusa, straordinario. */
function notaUscitaPrevista(r: RisultatoGiornata, passata: boolean): string | null {
  const permesso = r.uscitaPrevistaConPermesso
    ? `con ${formattaDurata(r.permessoUscitaPianificato)} di permesso in uscita`
    : null;
  const unisci = (...parti: (string | null)[]) => parti.filter((p) => p !== null).join(', ');
  if (r.stato === 'IN_PAUSA') return unisci('se rientri ora (pausa minima inclusa)', permesso);
  if (r.uscitaPrevistaConPausa) {
    return unisci(permesso, `inclusa pausa pranzo di ${formattaDurata(store.impostazioni.pausaDaScalare)}`);
  }
  if (permesso) return permesso;
  return passata ? 'stai facendo straordinario' : null;
}
```

- [ ] **Step 4: Conferma di uscita anticipata e toast di Uscita** — in `eseguiAzione` sostituire il `case 'USCITA_ANTICIPATA': { … }` con:

```ts
    case 'USCITA_ANTICIPATA': {
      const g = store.giornata(data);
      const mancante = Math.max(0, -calcolaGiornata(g, store.impostazioni, minuti).saldo);
      const prova = calcolaGiornata(
        { ...g, eventi: [...g.eventi, { id: 'prova', tipo: 'USCITA_ANTICIPATA', minuti }] },
        store.impostazioni,
        minuti,
      );
      const dettaglio = mancante !== prova.permessoUscita ? ` (mancano ${formattaDurata(mancante)})` : '';
      const ok = await conferma(
        'Uscita anticipata',
        `Esci alle ${formattaOra(minuti)}: ${formattaDurata(prova.permessoUscita)} di permesso${dettaglio} per completare la giornata.`,
        'Conferma uscita',
      );
      if (!ok) return;
      aggiungi('USCITA_ANTICIPATA');
      break;
    }
    case 'USCITA': {
      aggiungi('USCITA');
      const g = store.giornata(data);
      if (g.permessoUscitaMinuti > 0) {
        const r = calcolaGiornata(g, store.impostazioni, minuti);
        const permesso = r.permessoUscita > 0 ? `${formattaDurata(r.permessoUscita)} di permesso` : 'nessun permesso';
        toast(`Uscita alle ${formattaOra(minuti)} · ${permesso}`);
        return;
      }
      break;
    }
```

- [ ] **Step 5: Timeline** — sostituire l'intera funzione `timeline` con:

```ts
function timeline(
  data: string,
  giornata: Giornata,
  scartati: Set<string>,
  r: RisultatoGiornata,
  minutiProposti: number,
): HTMLElement {
  const ordinati = [...giornata.eventi].sort((a, b) => a.minuti - b.minuti);
  const voci: HTMLElement[] = [];
  const vocePermesso = (testo: string, dettaglio: string, onclick: () => void) =>
    el(
      'li',
      {},
      el(
        'button',
        { type: 'button', class: 'voce voce-permesso', onclick },
        el('span', { class: 'voce-ora' }, '—'),
        el('span', { class: 'voce-testo' }, testo, el('small', {}, dettaglio)),
        el('span', { class: 'voce-freccia', 'aria-hidden': 'true' }, '›'),
      ),
    );
  if (giornata.permessoInizioMinuti > 0) {
    const dichiarati =
      r.permessoInizioDichiarato !== r.permessoInizio ? ` (dichiarati ${formattaDurata(r.permessoInizioDichiarato)})` : '';
    voci.push(
      vocePermesso('Permesso a inizio giornata', `${formattaDurata(r.permessoInizio)}${dichiarati}`, () => void editorPermessoInizio(data, null)),
    );
  }
  for (const e of ordinati) {
    const rip = r.ripartizioni.find((x) => x.eventoRientroId === e.id);
    const sig = r.sigarette.find((x) => x.eventoRientroId === e.id);
    const pi = r.permessiIntermedi.find((x) => x.eventoRientroId === e.id);
    const dettaglio = rip
      ? `${formattaDurata(rip.pausa)} pausa + ${formattaDurata(pi?.permesso ?? rip.permesso)} permesso${rip.confermata ? '' : ' (proposta)'}`
      : sig
        ? `${formattaDurata(sig.permesso)} di permesso (pausa sigaretta di ${formattaDurata(sig.durata)})`
        : pi
          ? `${formattaDurata(pi.permesso)} di permesso${pi.permesso !== pi.durata ? ` (assenza di ${formattaDurata(pi.durata)})` : ''}`
          : scartati.has(e.id)
            ? 'non coerente: da correggere'
            : e.tipo === 'USCITA_PERMESSO' && e.sigaretta
              ? '🚬 pausa sigaretta'
              : null;
    voci.push(
      el(
        'li',
        {},
        el(
          'button',
          {
            type: 'button',
            class: `voce voce-${e.tipo.toLowerCase()} ${scartati.has(e.id) ? 'voce-errata' : ''}`,
            onclick: () => void editorEvento(data, e, e.minuti),
          },
          el('span', { class: 'voce-ora' }, formattaOra(e.minuti)),
          el('span', { class: 'voce-testo' }, ETICHETTE_EVENTO[e.tipo], dettaglio ? el('small', {}, dettaglio) : null),
          el('span', { class: 'voce-freccia', 'aria-hidden': 'true' }, '›'),
        ),
      ),
    );
  }
  const pianificato = giornata.permessoUscitaMinuti;
  if (pianificato > 0) {
    const dettaglio =
      r.stato === 'CHIUSA'
        ? `${formattaDurata(r.permessoUscita)}${r.permessoUscita !== pianificato ? ` (pianificati ${formattaDurata(pianificato)})` : ''}`
        : formattaDurata(pianificato);
    voci.push(vocePermesso('Permesso in uscita', dettaglio, () => void editorPermessoUscita(data)));
  }
  return el(
    'div',
    { class: 'scheda' },
    el('h2', { class: 'titolo-sezione' }, 'Timbrature'),
    voci.length > 0 ? el('ol', { class: 'timeline' }, voci) : el('p', { class: 'vuoto' }, 'Nessuna timbratura.'),
    el(
      'div',
      { class: 'riga-pulsanti' },
      el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void editorEvento(data, null, minutiProposti) }, '+ Aggiungi timbratura'),
      giornata.permessoInizioMinuti === 0
        ? el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void editorPermessoInizio(data, null) }, '+ Permesso inizio giornata')
        : null,
      pianificato === 0 && r.stato !== 'CHIUSA'
        ? el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void editorPermessoUscita(data) }, '+ Permesso in uscita')
        : null,
    ),
  );
}
```

- [ ] **Step 6: Verifica automatica** — `npx tsc --noEmit` → nessun errore; `npm test` → tutti PASS; `npm run build` → completata.

- [ ] **Step 7: Verifica manuale nel browser** (`npm run dev`, 390 px, giornata di oggi):
1. *Entrata*, poi *+ Permesso in uscita* → scheda con preset 30 min / 1h / 1h30 / 2h; Salva 30 min → la timeline mostra in fondo "Permesso in uscita · 30 min", il bottone *+ Permesso in uscita* sparisce, l'uscita prevista è 30 min prima con la nota "con 30 min di permesso in uscita" (e ", inclusa pausa pranzo di 1h" se la pausa non è fatta).
2. Tocco sulla voce → *Rimuovi permesso* → l'uscita prevista torna com'era.
3. Con permesso pianificato, *Uscita* → toast "Uscita alle HH:MM · N di permesso" (o "nessun permesso"); la voce mostra il permesso conteggiato e, se diverso, "(pianificati 30 min)".
4. *Riapri* e prova *Uscita anticipata*: la conferma mostra il permesso a blocchi e "(mancano …)" quando diverso.
5. Aggiungi a mano (*+ Aggiungi timbratura*) un *Uscita in permesso* e un *Rientro da permesso* a 40 min di distanza → il rientro mostra "1h di permesso (assenza di 40 min)".
6. Permesso a inizio giornata non multiplo di 30 (come nei dati salvati prima di questa versione): in console `const d = JSON.parse(localStorage.getItem('timbrature')); d.giornate[<data di oggi>].permessoInizioMinuti = 40; localStorage.setItem('timbrature', JSON.stringify(d))`, ricaricare → la voce mostra "1h (dichiarati 40 min)". La scheda *Entro dopo* ora scatta a passi di 30 min.

- [ ] **Step 8: Commit**

```bash
git add src/ui/editor.ts src/ui/giorno.ts
git commit -F - <<'EOF'
Oggi: permesso in uscita pianificato e permessi a blocchi in timeline e conferme (#12, #13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Interfaccia — riquadro della pausa pranzo dimenticata (#10)

**Files:**
- Create: `src/ui/pausaSaltata.ts`
- Modify: `src/ui/giorno.ts` (import; `vistaGiorno`), `src/style.css` (dopo `.avviso-problemi ul { … }`)

**Interfaces:**
- Consumes: `pausaDaProporre` (Task 5).
- Produces: `export function riquadroPausaSaltata(data: string, adesso: number): HTMLElement | null`.

- [ ] **Step 1: Modulo** — creare `src/ui/pausaSaltata.ts`:

```ts
import { nuovoId } from '../core/id';
import { pausaDaProporre } from '../core/pausaPranzo';
import { formattaOra } from '../core/tempo';
import { store } from '../storage/store';
import { toast } from './dialoghi';
import { el } from './dom';

/** Data dell'ultimo "No, l'ho saltata": è uno stato del dispositivo, non dei dati (come tema e banner). */
const CHIAVE = 'timbrature-pausa-saltata';

function rifiutata(data: string): boolean {
  try {
    return localStorage.getItem(CHIAVE) === data;
  } catch {
    return false;
  }
}

function rifiuta(data: string): void {
  try {
    localStorage.setItem(CHIAVE, data);
  } catch {
    /* il riquadro ricomparirà al prossimo ridisegno */
  }
}

/** Riquadro "Non hai registrato la pausa pranzo" per la giornata di oggi, o null se non serve. */
export function riquadroPausaSaltata(data: string, adesso: number): HTMLElement | null {
  if (rifiutata(data)) return null;
  const p = pausaDaProporre(store.giornata(data), store.impostazioni, adesso);
  if (!p) return null;
  const riquadro = el(
    'div',
    { class: 'scheda avviso-pausa', role: 'status' },
    el('p', {}, `Non hai registrato la pausa pranzo: la aggiungo dalle ${formattaOra(p.inizio)} alle ${formattaOra(p.fine)}?`),
    el(
      'div',
      { class: 'riga-pulsanti' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-primario',
          onclick: () => {
            store.modificaGiornata(data, (g) => {
              g.eventi.push(
                { id: nuovoId(), tipo: 'INIZIO_PAUSA', minuti: p.inizio },
                { id: nuovoId(), tipo: 'FINE_PAUSA', minuti: p.fine },
              );
            });
            toast(`Pausa pranzo aggiunta (${formattaOra(p.inizio)}–${formattaOra(p.fine)})`);
          },
        },
        'Aggiungi pausa',
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondario',
          onclick: () => {
            rifiuta(data);
            riquadro.remove();
          },
        },
        'No, l\'ho saltata',
      ),
    ),
  );
  return riquadro;
}
```

- [ ] **Step 2: Vista e stile**

`src/ui/giorno.ts`: `import { riquadroPausaSaltata } from './pausaSaltata';` e in `vistaGiorno`, subito dopo la riga `oggi ? pulsantiAzione(data, r, adesso.minuti) : null,`:

```ts
    oggi ? riquadroPausaSaltata(data, adesso.minuti) : null,
```

`src/style.css`, dopo la regola `.avviso-problemi ul { … }`:

```css
.avviso-pausa {
  background: var(--avviso-sfondo);
  border: 1px solid var(--avviso-bordo);
}
.avviso-pausa p {
  margin: 0;
}
```

- [ ] **Step 3: Verifica automatica** — `npx tsc --noEmit` → nessun errore; `npm test` → tutti PASS; `npm run build` → completata.

- [ ] **Step 4: Verifica manuale nel browser** (`npm run dev`, 390 px; servono orari dopo le 14:30, altrimenti impostare in Impostazioni una fascia pranzo già passata):
1. Oggi con solo *Entrata* 08:30 (aggiungerla a mano) → compare il riquadro "Non hai registrato la pausa pranzo: la aggiungo dalle 12:15 alle 12:45?", leggibile in tema chiaro e scuro.
2. **Aggiungi pausa** → toast, timeline con *Inizio pausa* 12:15 e *Fine pausa* 12:45, riquadro sparito, lavorate −30.
3. Eliminare le due timbrature di pausa → il riquadro ricompare. **No, l'ho saltata** → sparisce; ricaricando la pagina resta nascosto.
4. **Chiave di un altro giorno**: in console `localStorage.setItem('timbrature-pausa-saltata', '2000-01-01')`, ricaricare → il riquadro ricompare.
5. **Aggiungi a giornata chiusa**: con *Entrata* 08:30 e *Uscita* 17:00 senza pausa → riquadro presente; Aggiungi → nessun avviso "Giornata da correggere", saldo −30 rispetto a prima.

- [ ] **Step 5: Commit**

```bash
git add src/ui/pausaSaltata.ts src/ui/giorno.ts src/style.css
git commit -F - <<'EOF'
Oggi: proposta di aggiungere la pausa pranzo dimenticata (#10)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Aiuto e README

**Files:**
- Modify: `src/ui/aiutoTesti.ts` (import; voci `ore-coperte`, `pausa`, `uscita-prevista`; nuova voce `permesso-uscita` dopo `entro-dopo`)
- Modify: `README.md` (*Come si usa*, tabella delle regole, *Export CSV*)
- Test: `tests/aiuto.test.ts`

**Interfaces:**
- Consumes: `OFFSET_PAUSA_PROPOSTA`, `DURATA_PAUSA_PROPOSTA` (Task 5).

- [ ] **Step 1: Test che fallisce** — in `tests/aiuto.test.ts`, dentro `describe('aiuto', …)`:

```ts
  it('spiega permessi a blocchi, permesso in uscita e pausa dimenticata', () => {
    const testo = (id: string) => voci.find((v) => v.id === id)!.testo.join(' ');
    expect(voci.find((v) => v.id === 'permesso-uscita')).toBeDefined();
    expect(testo('ore-coperte')).toContain('multiplo di 30 min');
    expect(testo('pausa')).toContain('12:15');
    expect(testo('uscita-prevista')).toContain('permesso in uscita');
  });
```

- [ ] **Step 2:** `npx vitest run tests/aiuto.test.ts` → FAIL.

- [ ] **Step 3: Testi** — `src/ui/aiutoTesti.ts`:
- import: `import { DURATA_PAUSA_PROPOSTA, OFFSET_PAUSA_PROPOSTA } from '../core/pausaPranzo';`
- in `vociAiuto`, dopo `const tolleranza = …`:

```ts
  const inizioProposta = imp.pranzo.inizio + OFFSET_PAUSA_PROPOSTA;
  const pausaProposta = `${formattaOra(inizioProposta)}–${formattaOra(inizioProposta + DURATA_PAUSA_PROPOSTA)}`;
```

- voce `ore-coperte`, dopo la riga che inizia con `'• Permesso:`:

```ts
        '• Ogni permesso vale un multiplo di 30 min: un\'uscita anticipata con 1h23 mancanti conta 1h30; i minuti in più non contano come lavorate.',
```

- voce `pausa`, in fondo al `testo`:

```ts
        `Se a fine fascia pranzo non hai registrato la pausa, in Oggi compare un riquadro che propone di aggiungerla (${pausaProposta}); con "No, l'ho saltata" non te lo chiede più quel giorno.`,
```

- voce `uscita-prevista`, in fondo al `testo`:

```ts
        'Se hai inserito un permesso in uscita, l\'uscita prevista si anticipa di quella durata.',
```

- dopo la voce `entro-dopo`:

```ts
    {
      id: 'permesso-uscita',
      sezione: 'I bottoni',
      domanda: 'Permesso in uscita (uscire prima)',
      testo: [
        'Se sai già che uscirai prima, tocca "+ Permesso in uscita" sotto la timeline e indica la durata (multipli di 30 min): l\'uscita prevista si anticipa di quel tempo.',
        'Quando esci usa il normale "Uscita": il permesso conteggiato è quello che manca davvero, a blocchi di 30 min.',
        'Esempio: uscita prevista 17:55 e 30 min di permesso in uscita → uscita prevista 17:25. Esci alle 17:25 → 30 min di permesso; alle 17:10 → 1h; dopo le 17:55 → nessun permesso.',
      ],
    },
```

- [ ] **Step 4:** `npx vitest run tests/aiuto.test.ts` → PASS.

- [ ] **Step 5: README**
- *Come si usa*, dopo il punto **Pausa sigaretta**:

```markdown
- **Permesso in uscita**: se sai già che uscirai prima, tocca *+ Permesso in uscita* e indica la
  durata: l'uscita prevista si anticipa. Quando esci usa *Uscita*: conta il permesso che manca
  davvero, a blocchi di 30 min.
- **Pausa dimenticata**: passata la fascia pranzo senza pausa registrata, in *Oggi* compare un
  riquadro che propone di aggiungerla (30 min, 12:15–12:45).
```

- tabella delle regole: sostituire la riga *Uscita anticipata* con le tre righe

```markdown
| Uscita anticipata | le ore mancanti diventano permesso, a blocchi di 30 min (saldo 0) |
| Permessi | ogni permesso vale un multiplo di 30 min (1h23 → 1h30); i minuti in più non contano come lavorate, il saldo non cambia |
| Permesso in uscita pianificato | anticipa l'uscita prevista; all'uscita conta il permesso che manca davvero, a blocchi di 30 min |
```

- *Export CSV*: sostituire `permesso, saldo in ore decimali e l'elenco delle timbrature)` con `permesso, saldo in ore decimali, i permessi a inizio giornata e in uscita e l'elenco delle timbrature)`.

- [ ] **Step 6: Verifica finale** — `npm test` → tutti PASS; `npm run build` → completata; in `npm run dev`, Aiuto → la voce *Permesso in uscita* compare e la ricerca "permesso uscita" la trova.

- [ ] **Step 7: Commit**

```bash
git add src/ui/aiutoTesti.ts tests/aiuto.test.ts README.md
git commit -F - <<'EOF'
Aiuto e README: permessi a blocchi, permesso in uscita, pausa dimenticata

Closes #10
Closes #12
Closes #13

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
