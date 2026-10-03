# Pausa sigaretta 2 — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nella schermata della pausa sigaretta: lampeggio rosso negli ultimi 30 s, sfondo rosso scuro oltre la tolleranza, sigaretta che allo scadere si spegne nel posacenere, e in alternativa (da Impostazioni) una sigaretta elettronica con liquido che cala e LED rosso.

**Architecture:** La fase (`accesa` / `ultimi` / `scaduta`) si calcola in modo puro in `src/core/sigaretta.ts` dentro `countdown`. I disegni SVG statici e le loro misure stanno in un modulo nuovo, `src/ui/sigarettaDisegni.ts`. `src/ui/sigaretta.ts` mette sul dialog le classi di fase (`ultimi`, `scaduta`, `spegnimento`, `elettronica`). Tutte le animazioni sono keyframe CSS legate a quelle classi, e gli stati finali stanno negli stili di base, così con "riduci movimento" si vede comunque lo stato giusto.

**Tech Stack:** TypeScript 5.9 senza framework (helper `el()` in `src/ui/dom.ts`), Vite 8 + vite-plugin-pwa, Vitest 5 (ambiente node, nessun DOM nei test), localStorage.

**Spec:** `docs/superpowers/specs/2026-10-03-pausa-sigaretta-2-design.md`

## Global Constraints

- Testi dell'interfaccia, nomi di funzioni/variabili e commenti in **italiano**, come il resto del codice.
- Nessuna nuova dipendenza npm.
- Nessun cambio di `VERSIONE_CORRENTE` (`src/storage/migrazioni.ts`, oggi `1`).
- Regole invariate: tolleranza (predefinita 11, 0–60), blocchi da 30 min, esito del rientro (`trascorsiMs ≤ tolleranza × 60 000` → annulla), annullamento, ripristino della schermata, calcolo.
- `SECONDI_AVVISO = 30`; il lampeggio ha un ciclo di **1 s** (mai più di 3 accensioni al secondo).
- Fuori orario: sfondo `radial-gradient(circle at 50% 40%, #4a0d0d, #1a0404 70%)`, niente scritte o riquadri in più.
- `Impostazioni.tipoSigaretta: 'normale' | 'elettronica'`, predefinito `'normale'`.
- La schermata è sempre scura, indipendente dal tema.
- `src/style.css` ha già la regola globale `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`: ogni stato finale (posacenere, LED acceso, tinta rossa) deve essere espresso negli **stili di base**; le animazioni aggiungono solo movimento.
- Comandi: `npm test` (Vitest), `npx tsc --noEmit` (typecheck), `npm run build`, `npm run dev` (app su `http://localhost:5173/krumiro2.0/`).
- Branch: `feature/9-pausa-sigaretta`. Ogni commit termina con la riga `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Telefono in standby o app in background mentre la pausa scade** → al ritorno la schermata mostra la fase giusta; se è lo stesso dialog la sequenza del posacenere parte una sola volta e non si ripete ogni secondo; se la schermata viene ricreata (ricarica) si vede subito lo stato finale (Task 1, test `spegnimentoDaAnimare`; Task 4, verifica manuale "ricarica a pausa scaduta").
2. **Tolleranza 0** → la schermata si apre già rossa, senza lampeggio né sequenza (Task 1, test "con tolleranza 0 è scaduta da subito"; Task 4, verifica manuale "tolleranza 0").
3. **Backup JSON vecchio (senza `tipoSigaretta`) o modificato a mano con un valore sconosciuto** → l'app si apre con la sigaretta normale, senza errori (Task 2, test di migrazione).
4. **"Riduci movimento" attivo** → ogni fase resta riconoscibile: tinta rossa fissa negli ultimi 30 s, posacenere con mozzicone allo scadere, LED acceso fisso, liquido e cartina che calano (Task 4, verifica manuale "riduci movimento").
5. **Testi sopra il rosso** (timer, nota, *Annulla pausa*, bottone *Rientro*) leggibili al picco del lampeggio e sullo sfondo rosso scuro: il timer `#ff6b81` ha contrasto ≈ 5,7:1 su `#4a0d0d` (Task 4, verifica manuale "leggibilità").

---

## File Structure

| File | Ruolo |
|---|---|
| `src/core/sigaretta.ts` (modifica) | `SECONDI_AVVISO`, `FaseSigaretta`, `Countdown.fase`, `spegnimentoDaAnimare` |
| `src/core/tipi.ts` (modifica) | `TipoSigaretta`, `Impostazioni.tipoSigaretta` (default `'normale'`) |
| `src/storage/migrazioni.ts` (modifica) | Valida `tipoSigaretta` |
| `src/ui/impostazioni.ts` (modifica) | Riga *Tipo* con pulsanti Normale / Elettronica; testo di *Ripristina* |
| `src/ui/sigarettaDisegni.ts` (nuovo) | SVG della sigaretta normale (con posacenere) e dell'elettronica; `misureNormale`, `misureElettronica`, `creaDisegno` |
| `src/ui/sigaretta.ts` (modifica) | Usa `creaDisegno`; classi di fase e di tipo sul dialog |
| `src/style.css` (modifica) | Chip nella riga impostazioni; strato rosso, sfondo scaduto, posacenere, sigaretta elettronica |
| `src/ui/aiutoTesti.ts` (modifica) | Voce `pausa-sigaretta`: lampeggio, esito allo scadere secondo il tipo, dove si cambia il tipo |
| `README.md` (modifica) | Descrizione e impostazioni |
| `tests/sigaretta.test.ts`, `tests/migrazioni.test.ts`, `tests/sigarettaDisegni.test.ts` (nuovo), `tests/aiuto.test.ts` | Test |

---

### Task 1: Fasi della schermata (logica pura)

**Files:**
- Modify: `src/core/sigaretta.ts` (costante e tipo in testa; `Countdown` e `countdown` alle righe ~22–42; nuova funzione dopo `testoTimer`)
- Test: `tests/sigaretta.test.ts`

**Interfaces:**
- Consumes: `esitoRientroSigaretta` (già nel file).
- Produces:
  - `export const SECONDI_AVVISO = 30;`
  - `export type FaseSigaretta = 'accesa' | 'ultimi' | 'scaduta';`
  - `Countdown.fase: FaseSigaretta` (campo nuovo; gli altri invariati)
  - `export function spegnimentoDaAnimare(precedente: FaseSigaretta | null, attuale: FaseSigaretta): boolean`

- [ ] **Step 1: Scrivere i test che falliscono**

In `tests/sigaretta.test.ts` aggiungere `spegnimentoDaAnimare` all'import da `'../src/core/sigaretta'` (in ordine alfabetico, dopo `sigarettaInCorso`) e, subito dopo il blocco `describe('countdown', …)`, aggiungere:

```ts
describe('fasi della schermata', () => {
  const s = 1000;
  const tolleranza = 11 * 60_000;

  it('accesa finché mancano più di 30 secondi', () => {
    expect(countdown(0, 11).fase).toBe('accesa');
    expect(countdown(tolleranza - 30 * s - 1, 11).fase).toBe('accesa');
  });

  it('ultimi negli ultimi 30 secondi, compresa la tolleranza esatta', () => {
    expect(countdown(tolleranza - 30 * s, 11).fase).toBe('ultimi');
    expect(testoTimer(countdown(tolleranza - 30 * s, 11))).toBe('00:30');
    expect(countdown(tolleranza, 11).fase).toBe('ultimi');
  });

  it('scaduta oltre la tolleranza, insieme all\'esito del rientro', () => {
    const c = countdown(tolleranza + 1, 11);
    expect(c.fase).toBe('scaduta');
    expect(c.scaduta).toBe(true);
  });

  it('con tolleranza 1 min il lampeggio parte a metà', () => {
    expect(countdown(29 * s, 1).fase).toBe('accesa');
    expect(countdown(30 * s, 1).fase).toBe('ultimi');
  });

  it('con tolleranza 0 è scaduta da subito', () => {
    expect(countdown(0, 0).fase).toBe('scaduta');
    expect(countdown(2000, 0).fase).toBe('scaduta');
  });
});

describe('sequenza di spegnimento', () => {
  it('parte quando la pausa scade con la schermata aperta', () => {
    expect(spegnimentoDaAnimare('accesa', 'scaduta')).toBe(true);
    expect(spegnimentoDaAnimare('ultimi', 'scaduta')).toBe(true);
  });

  it('non parte aprendo la schermata già scaduta, né di nuovo ai secondi successivi', () => {
    expect(spegnimentoDaAnimare(null, 'scaduta')).toBe(false);
    expect(spegnimentoDaAnimare('scaduta', 'scaduta')).toBe(false);
    expect(spegnimentoDaAnimare('accesa', 'ultimi')).toBe(false);
    expect(spegnimentoDaAnimare(null, 'accesa')).toBe(false);
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/sigaretta.test.ts`
Expected: FAIL (`spegnimentoDaAnimare` non esportata; `fase` undefined).

- [ ] **Step 3: Implementare**

In `src/core/sigaretta.ts`, dopo `BLOCCO_PERMESSO_SIGARETTA`:

```ts
/** Negli ultimi secondi prima dello scadere la schermata lampeggia di rosso. */
export const SECONDI_AVVISO = 30;

/** accesa → ultimi (lampeggio) → scaduta (oltre la tolleranza: rientrando diventa permesso). */
export type FaseSigaretta = 'accesa' | 'ultimi' | 'scaduta';
```

Nell'interfaccia `Countdown`, dopo `scaduta: boolean;`:

```ts
  /** Fase della schermata; con tolleranza 0 è sempre 'scaduta' (sigaretta già consumata). */
  fase: FaseSigaretta;
```

Sostituire `countdown` con:

```ts
export function countdown(trascorsiMs: number, tolleranzaMinuti: number): Countdown {
  const totale = tolleranzaMinuti * 60_000;
  const t = Math.max(0, trascorsiMs);
  const residuoMs = Math.max(0, totale - t);
  const scaduta = esitoRientroSigaretta(t, tolleranzaMinuti) === 'permesso';
  return {
    residuoMs,
    oltreMs: Math.max(0, t - totale),
    consumata: totale > 0 ? Math.min(1, t / totale) : 1,
    scaduta,
    fase: scaduta || totale === 0 ? 'scaduta' : residuoMs <= SECONDI_AVVISO * 1000 ? 'ultimi' : 'accesa',
  };
}
```

Dopo `testoTimer`:

```ts
/**
 * La sequenza del posacenere parte solo se la pausa scade con la schermata aperta:
 * aprendola già scaduta (`precedente` null) si vede subito lo stato finale.
 */
export function spegnimentoDaAnimare(precedente: FaseSigaretta | null, attuale: FaseSigaretta): boolean {
  return attuale === 'scaduta' && precedente !== null && precedente !== 'scaduta';
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx vitest run tests/sigaretta.test.ts` → PASS.
Run: `npx tsc --noEmit` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add src/core/sigaretta.ts tests/sigaretta.test.ts
git commit -F - <<'EOF'
Pausa sigaretta: fasi della schermata (ultimi 30 secondi, scaduta)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Tipo di sigaretta nelle impostazioni

**Files:**
- Modify: `src/core/tipi.ts` (interfaccia `Impostazioni` righe ~53–68, `IMPOSTAZIONI_PREDEFINITE` righe ~70–77)
- Modify: `src/storage/migrazioni.ts` (`normalizzaImpostazioni`, dopo la riga di `tolleranzaSigaretta` ~95)
- Modify: `src/ui/impostazioni.ts` (import da `../core/tipi`, nuove costanti/funzione dopo `selettoreTema`, scheda *Pausa sigaretta*, testo della conferma di ripristino)
- Modify: `src/style.css` (dopo la regola `.chip[aria-pressed='true']`, riga ~605)
- Test: `tests/migrazioni.test.ts`

**Interfaces:**
- Produces:
  - `export type TipoSigaretta = 'normale' | 'elettronica';` in `src/core/tipi.ts`
  - `Impostazioni.tipoSigaretta: TipoSigaretta`, `IMPOSTAZIONI_PREDEFINITE.tipoSigaretta === 'normale'`

- [ ] **Step 1: Scrivere il test che fallisce**

In `tests/migrazioni.test.ts`, dentro `describe('migrazioni', …)`, dopo il test della tolleranza:

```ts
  it('tipo di sigaretta: predefinito normale, valori sconosciuti scartati', () => {
    const tipo = (v: unknown) => migra({ version: 1, impostazioni: { tipoSigaretta: v } }).impostazioni.tipoSigaretta;
    expect(migra({}).impostazioni.tipoSigaretta).toBe('normale');
    expect(tipo('elettronica')).toBe('elettronica');
    expect(tipo('normale')).toBe('normale');
    expect(tipo('svapo')).toBe('normale');
    expect(tipo(1)).toBe('normale');
    expect(tipo(undefined)).toBe('normale');
  });
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/migrazioni.test.ts`
Expected: FAIL (`tipoSigaretta` undefined; il typecheck di Vitest non blocca, il valore è `undefined`).

- [ ] **Step 3: Implementare dato e normalizzazione**

`src/core/tipi.ts`, prima di `export interface Impostazioni`:

```ts
/** Disegno della schermata della pausa sigaretta. */
export type TipoSigaretta = 'normale' | 'elettronica';
```

Nell'interfaccia `Impostazioni`, dopo `tolleranzaSigaretta: number;`:

```ts
  /** Disegno della schermata della pausa: sigaretta normale o elettronica. */
  tipoSigaretta: TipoSigaretta;
```

In `IMPOSTAZIONI_PREDEFINITE`, dopo `tolleranzaSigaretta: 11,`:

```ts
  tipoSigaretta: 'normale',
```

`src/storage/migrazioni.ts`, in `normalizzaImpostazioni` subito dopo la riga `imp.tolleranzaSigaretta = …`:

```ts
  const tipo = v.tipoSigaretta;
  imp.tipoSigaretta = tipo === 'normale' || tipo === 'elettronica' ? tipo : p.tipoSigaretta;
```

- [ ] **Step 4: Verificare che passi**

Run: `npx vitest run tests/migrazioni.test.ts` → PASS.
Run: `npx tsc --noEmit` → nessun errore.

- [ ] **Step 5: Riga *Tipo* nelle impostazioni**

`src/ui/impostazioni.ts`: cambiare l'import

```ts
import { IMPOSTAZIONI_PREDEFINITE } from '../core/tipi';
```

in

```ts
import { IMPOSTAZIONI_PREDEFINITE, type TipoSigaretta } from '../core/tipi';
```

Dopo la funzione `selettoreTema`, aggiungere:

```ts
const OPZIONI_SIGARETTA: [TipoSigaretta, string][] = [
  ['normale', 'Normale'],
  ['elettronica', 'Elettronica'],
];

/** Pulsanti Normale / Elettronica: cambiano solo il disegno della schermata della pausa. */
function selettoreSigaretta(attuale: TipoSigaretta): HTMLElement {
  return el(
    'div',
    { class: 'preset', role: 'group', 'aria-label': 'Tipo di sigaretta' },
    OPZIONI_SIGARETTA.map(([valore, testo]) =>
      el(
        'button',
        {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(attuale === valore),
          onclick: () => {
            // Il salvataggio ridisegna la vista: i pulsanti si aggiornano da soli.
            store.modificaImpostazioni((i) => void (i.tipoSigaretta = valore));
            salvato();
          },
        },
        testo,
      ),
    ),
  );
}
```

Nella scheda *Pausa sigaretta*, tra il titolo e la riga della tolleranza:

```ts
      el('h2', { class: 'titolo-sezione' }, 'Pausa sigaretta'),
      riga('Tipo', selettoreSigaretta(imp.tipoSigaretta)),
      riga('Tolleranza (min)', inputMinuti(imp.tolleranzaSigaretta, (v) => {
```

Nel testo della conferma di *Ripristina valori predefiniti* sostituire `tolleranza sigaretta 11 min)` con `tolleranza sigaretta 11 min, sigaretta normale)`. Il testo completo diventa:

```ts
'Tornano i valori predefiniti (8h lun–ven, pranzo 12:00–14:30, 60 min da scalare, tolleranza sigaretta 11 min, sigaretta normale). Le timbrature non vengono toccate.'
```

`src/style.css`, subito dopo la regola `.chip[aria-pressed='true'] { … }`:

```css
.riga-impostazione .preset {
  flex: none;
}
.riga-impostazione .chip {
  padding: 0 14px;
}
```

- [ ] **Step 6: Verifica**

Run: `npm test` → tutti PASS. Run: `npx tsc --noEmit` → nessun errore.
A mano (`npm run dev`, scheda Impostazioni): la riga *Tipo* mostra Normale selezionato; tocco su Elettronica → toast "Impostazioni salvate" e il pulsante selezionato cambia; ricaricando la pagina resta Elettronica; *Ripristina valori predefiniti* → torna Normale. Controllare a 390 px di larghezza che la riga non vada a capo in modo brutto.

- [ ] **Step 7: Commit**

```bash
git add src/core/tipi.ts src/storage/migrazioni.ts src/ui/impostazioni.ts src/style.css tests/migrazioni.test.ts
git commit -F - <<'EOF'
Impostazioni: tipo di sigaretta (normale o elettronica)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Disegni della sigaretta normale (con posacenere) ed elettronica

**Files:**
- Create: `src/ui/sigarettaDisegni.ts`
- Test: `tests/sigarettaDisegni.test.ts`

**Interfaces:**
- Consumes: `TipoSigaretta` da `src/core/tipi.ts` (Task 2).
- Produces:
  - `export function misureNormale(consumata: number): { larghezzaCartina: number; spostamentoPunta: number }`
  - `export function misureElettronica(consumata: number): { yLiquido: number; altezzaLiquido: number }`
  - `export interface Disegno { elemento: Element; aggiorna(consumata: number): void }`
  - `export function creaDisegno(tipo: TipoSigaretta): Disegno`
  - Classi nell'SVG usate dal CSS del Task 4: normale → `sigaretta-disegno`, `posacenere`, `posacenere-mozzicone`, `posacenere-fumo`, `sigaretta-mozzicone`, `sigaretta-residuo`, `sigaretta-cartina`, `sigaretta-punta`, `sigaretta-bagliore`, `sigaretta-fumo`; elettronica → `sigaretta-disegno`, `svapo-vapore`, `svapo-liquido`, `svapo-led`, `svapo-alone`, `svapo-luce`.

Il modulo non deve toccare `document` al livello superiore (i test girano in node e importano il file): `document` si usa solo dentro `creaDisegno`.

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `tests/sigarettaDisegni.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { misureElettronica, misureNormale } from '../src/ui/sigarettaDisegni';

describe('misure del disegno', () => {
  it('sigaretta normale: la cartina si accorcia e la punta la segue', () => {
    expect(misureNormale(0).larghezzaCartina).toBeCloseTo(200);
    expect(misureNormale(0).spostamentoPunta).toBeCloseTo(0);
    expect(misureNormale(0.5).larghezzaCartina).toBeCloseTo(100);
    expect(misureNormale(0.5).spostamentoPunta).toBeCloseTo(-100);
    expect(misureNormale(1).larghezzaCartina).toBeCloseTo(0);
    expect(misureNormale(1).spostamentoPunta).toBeCloseTo(-200);
  });

  it('sigaretta elettronica: il liquido scende fino a svuotare il serbatoio', () => {
    expect(misureElettronica(0).altezzaLiquido).toBeCloseTo(20);
    expect(misureElettronica(0).yLiquido).toBeCloseTo(58);
    expect(misureElettronica(0.5).altezzaLiquido).toBeCloseTo(10);
    expect(misureElettronica(0.5).yLiquido).toBeCloseTo(68);
    expect(misureElettronica(1).altezzaLiquido).toBeCloseTo(0);
    expect(misureElettronica(1).yLiquido).toBeCloseTo(78);
  });

  it('fuori da 0–1 non produce misure negative né eccessive', () => {
    expect(misureNormale(-0.2).larghezzaCartina).toBeCloseTo(200);
    expect(misureNormale(1.5).larghezzaCartina).toBeCloseTo(0);
    expect(misureNormale(1.5).spostamentoPunta).toBeCloseTo(-200);
    expect(misureElettronica(-1).altezzaLiquido).toBeCloseTo(20);
    expect(misureElettronica(1.5).altezzaLiquido).toBeCloseTo(0);
  });
});
```

- [ ] **Step 2: Verificare che falliscano**

Run: `npx vitest run tests/sigarettaDisegni.test.ts`
Expected: FAIL (modulo inesistente).

- [ ] **Step 3: Implementare il modulo**

Creare `src/ui/sigarettaDisegni.ts`:

```ts
import type { TipoSigaretta } from '../core/tipi';

/** Lunghezza della cartina nel disegno (unità SVG): si accorcia fino a 0. */
const CARTINA = 200;
/** Liquido nel serbatoio della sigaretta elettronica: il livello scende verso il fondo. */
const LIQUIDO_Y = 58;
const LIQUIDO_ALTEZZA = 20;

const tra0e1 = (n: number) => Math.min(1, Math.max(0, n));

/** Sigaretta normale con `consumata` da 0 (intera) a 1 (resta il filtro). */
export function misureNormale(consumata: number): { larghezzaCartina: number; spostamentoPunta: number } {
  const c = tra0e1(consumata);
  return { larghezzaCartina: CARTINA * (1 - c), spostamentoPunta: -CARTINA * c };
}

/** Sigaretta elettronica con `consumata` da 0 (serbatoio pieno) a 1 (vuoto). */
export function misureElettronica(consumata: number): { yLiquido: number; altezzaLiquido: number } {
  const c = tra0e1(consumata);
  return { yLiquido: LIQUIDO_Y + LIQUIDO_ALTEZZA * c, altezzaLiquido: LIQUIDO_ALTEZZA * (1 - c) };
}

/*
 * Sigaretta normale: in alto la sigaretta (filtro a sinistra, brace a destra), sotto il posacenere.
 * Il posacenere, il mozzicone schiacciato e il residuo di brace sono nascosti dal CSS finché la pausa
 * non scade; la sequenza di spegnimento è in src/style.css (classi .scaduta e .spegnimento).
 */
const SVG_NORMALE = `
<svg class="sigaretta-disegno" viewBox="0 0 300 160" aria-hidden="true">
  <defs>
    <linearGradient id="sig-brace" x1="0" x2="1">
      <stop offset="0" stop-color="#ffd27a"/>
      <stop offset="0.5" stop-color="#ff5a1f"/>
      <stop offset="1" stop-color="#7a1600"/>
    </linearGradient>
    <filter id="sig-bagliore" x="-1" y="-1" width="3" height="3">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>
  <g class="posacenere">
    <path d="M86 122 L100 148 Q150 156 200 148 L214 122 Z" fill="#57534e"/>
    <ellipse cx="150" cy="122" rx="64" ry="12" fill="#78716c"/>
    <ellipse cx="150" cy="122" rx="54" ry="8" fill="#292524"/>
    <g fill="#a8a29e">
      <circle cx="128" cy="123" r="1.6"/><circle cx="170" cy="121" r="1.3"/><circle cx="152" cy="125" r="1.2"/>
    </g>
    <g class="posacenere-mozzicone">
      <rect x="120" y="113" width="30" height="10" rx="2" fill="#d9822b" transform="rotate(-10 135 118)"/>
      <path d="M149 112 l9 -4 l7 5 l-3 8 l-12 1 z" fill="#e7e2d8"/>
      <ellipse cx="166" cy="119" rx="6" ry="3" fill="#57534e"/>
    </g>
    <g class="posacenere-fumo" fill="none" stroke="#d8d4cf" stroke-width="3" stroke-linecap="round">
      <path d="M160 110 c-6 -6 6 -11 0 -17 c-5 -5 5 -9 0 -14"/>
    </g>
  </g>
  <g class="sigaretta-mozzicone">
    <rect x="10" y="60" width="60" height="16" rx="3" fill="#d9822b"/>
    <g fill="#b8641c">
      <circle cx="22" cy="65" r="1.4"/><circle cx="35" cy="71" r="1.2"/>
      <circle cx="48" cy="64" r="1.3"/><circle cx="60" cy="70" r="1.1"/>
    </g>
    <rect x="68" y="60" width="4" height="16" fill="#c9a227"/>
    <rect class="sigaretta-residuo" x="72" y="61" width="5" height="14" rx="2"/>
  </g>
  <rect class="sigaretta-cartina" x="72" y="60" width="${CARTINA}" height="16" fill="#f4f1ea"/>
  <g class="sigaretta-punta">
    <ellipse class="sigaretta-bagliore" cx="272" cy="68" rx="9" ry="11" fill="#ff5a1f" filter="url(#sig-bagliore)"/>
    <rect x="268" y="60" width="6" height="16" rx="2" fill="url(#sig-brace)"/>
    <rect x="273" y="61" width="11" height="14" rx="5" fill="#8a8580"/>
    <g class="sigaretta-fumo" fill="none" stroke="#d8d4cf" stroke-width="3" stroke-linecap="round">
      <path d="M279 56 c-8 -8 8 -14 0 -22 c-7 -7 6 -12 0 -20"/>
      <path d="M279 56 c7 -9 -7 -15 1 -24 c6 -7 -5 -12 1 -18"/>
      <path d="M279 56 c-5 -7 9 -13 2 -21 c-6 -8 7 -12 0 -19"/>
    </g>
  </g>
</svg>`;

/* Sigaretta elettronica: bocchino, serbatoio con il liquido, corpo metallico, LED rosso in punta. */
const SVG_ELETTRONICA = `
<svg class="sigaretta-disegno" viewBox="0 0 300 100" aria-hidden="true">
  <defs>
    <linearGradient id="svapo-metallo" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e7e5e4"/>
      <stop offset="0.5" stop-color="#78716c"/>
      <stop offset="1" stop-color="#a8a29e"/>
    </linearGradient>
    <filter id="svapo-sfocatura" x="-1" y="-1" width="3" height="3">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  </defs>
  <g class="svapo-vapore" fill="#e7e5e4">
    <circle cx="10" cy="56" r="6"/>
    <circle cx="6" cy="50" r="8"/>
    <circle cx="12" cy="52" r="7"/>
  </g>
  <rect x="12" y="61" width="36" height="14" rx="6" fill="#1c1917"/>
  <rect x="46" y="56" width="80" height="24" rx="4" fill="rgba(255,255,255,0.06)"/>
  <rect class="svapo-liquido" x="48" y="${LIQUIDO_Y}" width="76" height="${LIQUIDO_ALTEZZA}" rx="2" fill="#f59e0b" opacity="0.85"/>
  <rect x="46" y="56" width="80" height="24" rx="4" fill="none" stroke="#a8a29e" stroke-width="1.5"/>
  <rect x="126" y="56" width="140" height="24" rx="3" fill="url(#svapo-metallo)"/>
  <rect x="150" y="56" width="3" height="24" fill="#57534e"/>
  <g class="svapo-led">
    <ellipse class="svapo-alone" cx="270" cy="68" rx="12" ry="14" fill="#ff1f1f" filter="url(#svapo-sfocatura)"/>
    <rect class="svapo-luce" x="264" y="57" width="10" height="22" rx="4" fill="#ff2d2d"/>
  </g>
</svg>`;

export interface Disegno {
  elemento: Element;
  /** Aggiorna le parti che si consumano (`consumata` da 0 a 1). */
  aggiorna(consumata: number): void;
}

/** Crea il disegno della schermata della pausa per il tipo di sigaretta scelto. */
export function creaDisegno(tipo: TipoSigaretta): Disegno {
  const contenitore = document.createElement('div');
  contenitore.innerHTML = tipo === 'elettronica' ? SVG_ELETTRONICA : SVG_NORMALE; // markup statico, nessun dato dell'utente
  const elemento = contenitore.firstElementChild!;
  if (tipo === 'elettronica') {
    const liquido = elemento.querySelector('.svapo-liquido')!;
    return {
      elemento,
      aggiorna: (consumata) => {
        const m = misureElettronica(consumata);
        liquido.setAttribute('y', String(m.yLiquido));
        liquido.setAttribute('height', String(m.altezzaLiquido));
      },
    };
  }
  const cartina = elemento.querySelector('.sigaretta-cartina')!;
  const punta = elemento.querySelector('.sigaretta-punta')!;
  return {
    elemento,
    aggiorna: (consumata) => {
      const m = misureNormale(consumata);
      cartina.setAttribute('width', String(m.larghezzaCartina));
      punta.setAttribute('transform', `translate(${m.spostamentoPunta} 0)`);
    },
  };
}
```

- [ ] **Step 4: Verificare che passino**

Run: `npx vitest run tests/sigarettaDisegni.test.ts` → PASS.
Run: `npm test` → tutti PASS. Run: `npx tsc --noEmit` → nessun errore.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sigarettaDisegni.ts tests/sigarettaDisegni.test.ts
git commit -F - <<'EOF'
Pausa sigaretta: disegni della sigaretta normale con posacenere e dell'elettronica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Schermata — fasi, lampeggio, sfondo rosso, posacenere ed elettronica

**Files:**
- Modify: `src/ui/sigaretta.ts` (import; togliere `CARTINA` e `DISEGNO` alle righe ~53–86; `apriSchermata`: scena, classe del dialog, `aggiorna`)
- Modify: `src/style.css` (blocco *Pausa sigaretta*, righe ~733–841)

**Interfaces:**
- Consumes: `countdown`, `FaseSigaretta`, `spegnimentoDaAnimare` (Task 1); `store.impostazioni.tipoSigaretta` (Task 2); `creaDisegno` e le classi SVG (Task 3).
- Produces: classi sul `<dialog class="sigaretta">`: `elettronica` (fissa), `consumata`, `ultimi`, `scaduta`, `spegnimento`.

- [ ] **Step 1: Collegare i disegni e le fasi in `src/ui/sigaretta.ts`**

Import: aggiungere `spegnimentoDaAnimare` e `type FaseSigaretta` all'import da `'../core/sigaretta'`, e il nuovo modulo:

```ts
import {
  BLOCCO_PERMESSO_SIGARETTA,
  countdown,
  esitoRientroSigaretta,
  type FaseSigaretta,
  istanteDaMinuti,
  sigarettaDaRiprendere,
  spegnimentoDaAnimare,
  testoTimer,
} from '../core/sigaretta';
```

```ts
import { el } from './dom';
import { creaDisegno } from './sigarettaDisegni';
```

Eliminare le costanti `CARTINA` e `DISEGNO` (ora in `sigarettaDisegni.ts`).

In `apriSchermata`, sostituire:

```ts
  const scena = el('div', { class: 'sigaretta-scena' });
  scena.innerHTML = DISEGNO; // markup statico, nessun dato dell'utente
  const cartina = scena.querySelector('.sigaretta-cartina')!;
  const punta = scena.querySelector('.sigaretta-punta')!;
```

con:

```ts
  // Il tipo si legge all'apertura: con la schermata aperta le impostazioni non sono raggiungibili.
  const tipo = store.impostazioni.tipoSigaretta;
  const disegno = creaDisegno(tipo);
  const scena = el('div', { class: 'sigaretta-scena' }, disegno.elemento);
```

Nella creazione del dialog sostituire `{ class: 'sigaretta', 'aria-label': 'Pausa sigaretta' }` con:

```ts
    { class: tipo === 'elettronica' ? 'sigaretta elettronica' : 'sigaretta', 'aria-label': 'Pausa sigaretta' },
```

Sostituire l'intera funzione `aggiorna` con:

```ts
  let fasePrecedente: FaseSigaretta | null = null;
  const aggiorna = () => {
    if (giornoCambiato()) return;
    const c = countdown(Date.now() - inizio, tolleranza);
    disegno.aggiorna(c.consumata);
    dlg.classList.toggle('consumata', c.consumata >= 1);
    dlg.classList.toggle('ultimi', c.fase === 'ultimi');
    dlg.classList.toggle('scaduta', c.fase === 'scaduta');
    // Sequenza del posacenere solo se la pausa scade mentre la schermata è aperta.
    if (spegnimentoDaAnimare(fasePrecedente, c.fase)) dlg.classList.add('spegnimento');
    fasePrecedente = c.fase;
    timer.textContent = testoTimer(c);
    if (c.fase === 'scaduta') {
      const p = anteprimaSigaretta(store.giornata(data), store.impostazioni, adessoRoma().minuti);
      nota.textContent = `Al rientro: ${formattaDurata(p?.permesso ?? BLOCCO_PERMESSO_SIGARETTA)} di permesso`;
    } else {
      nota.textContent = `Rientra entro le ${entro} per non segnare nulla`;
    }
  };
```

Run: `npx tsc --noEmit` → nessun errore (in particolare nessun riferimento rimasto a `cartina`, `punta`, `CARTINA`, `DISEGNO`).

- [ ] **Step 2: Strato rosso e sfondo del fuori orario in `src/style.css`**

Nel blocco *Pausa sigaretta*, subito dopo la regola `.sigaretta::backdrop { … }`:

```css
/* Ultimi 30 secondi: uno strato rosso pulsa sotto i contenuti (con riduci movimento resta fisso). */
.sigaretta::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 50% 40%, #dc2626, #7f1d1d 75%);
  opacity: 0;
  pointer-events: none;
}
.sigaretta > * {
  position: relative;
}
.sigaretta.ultimi::before {
  opacity: 0.35;
  animation: allarme 1s ease-in-out infinite;
}
/* Fuori orario: sfondo rosso scuro fisso fino al rientro. */
.sigaretta.scaduta {
  background: radial-gradient(circle at 50% 40%, #4a0d0d, #1a0404 70%);
}
.sigaretta.scaduta::backdrop {
  background: #1a0404;
}
```

Alla regola esistente `.sigaretta.scaduta .sigaretta-timer { color: #ff6b81; }` aggiungere sopra il commento:

```css
/* #ff6b81 su #4a0d0d: contrasto ≈ 5,7:1. */
```

Insieme agli altri `@keyframes` del blocco (dopo `@keyframes fumo`):

```css
@keyframes allarme {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 0.55;
  }
}
```

- [ ] **Step 3: Posacenere e sequenza di spegnimento in `src/style.css`**

Dopo la regola esistente `.sigaretta.consumata .sigaretta-punta { display: none; }`:

```css
/* Allo scadere la sigaretta finisce nel posacenere: lo stato finale è negli stili di base,
   la sequenza (.spegnimento, ≈1,5 s) parte solo se la pausa scade a schermata aperta. */
.posacenere,
.posacenere-mozzicone,
.sigaretta-residuo {
  opacity: 0;
}
.sigaretta-residuo {
  fill: #ff5a1f;
}
.sigaretta.consumata .sigaretta-residuo,
.sigaretta.scaduta .posacenere,
.sigaretta.scaduta .posacenere-mozzicone {
  opacity: 1;
}
.sigaretta.scaduta .sigaretta-mozzicone {
  opacity: 0;
}
.posacenere,
.sigaretta-mozzicone {
  transform-box: fill-box;
  transform-origin: center;
}
.posacenere-fumo path {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: 50% 100%;
}
.sigaretta.spegnimento .posacenere {
  animation: posacenere-entra 0.4s ease-out both;
}
.sigaretta.spegnimento .sigaretta-mozzicone {
  animation: mozzicone-cade 1.5s ease-in-out both;
}
.sigaretta.spegnimento .sigaretta-residuo {
  animation: residuo-spento 1.5s linear both;
}
.sigaretta.spegnimento .posacenere-mozzicone {
  animation: mozzicone-schiacciato 1.5s linear both;
}
.sigaretta.spegnimento .posacenere-fumo path {
  animation: sbuffo 1.5s ease-out both;
}
```

Con gli altri `@keyframes`:

```css
@keyframes posacenere-entra {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes mozzicone-cade {
  0%,
  27% {
    opacity: 1;
    transform: none;
  }
  67% {
    opacity: 1;
    transform: translate(97px, 44px) rotate(-12deg);
  }
  80% {
    opacity: 1;
    transform: translate(97px, 48px) rotate(-12deg) scale(0.9, 0.55);
  }
  100% {
    opacity: 0;
    transform: translate(97px, 48px) rotate(-12deg) scale(0.9, 0.55);
  }
}
@keyframes residuo-spento {
  0%,
  67% {
    fill: #ff5a1f;
  }
  80%,
  100% {
    fill: #57534e;
  }
}
@keyframes mozzicone-schiacciato {
  0%,
  78% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
@keyframes sbuffo {
  0%,
  75% {
    opacity: 0;
    transform: translateY(4px) scale(0.6);
  }
  85% {
    opacity: 0.6;
  }
  100% {
    opacity: 0;
    transform: translateY(-16px) scale(1.3);
  }
}
```

- [ ] **Step 4: Sigaretta elettronica in `src/style.css`**

Dopo le regole del posacenere:

```css
/* Sigaretta elettronica: il LED pulsa come la brace, il vapore esce dal bocchino. */
.svapo-alone {
  animation: brace 1.6s ease-in-out infinite;
}
.svapo-vapore circle {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: vapore 3s ease-out infinite;
}
.svapo-vapore circle:nth-child(2) {
  animation-delay: 1s;
}
.svapo-vapore circle:nth-child(3) {
  animation-delay: 2s;
}
.sigaretta.scaduta .svapo-vapore {
  display: none;
}
/* Serbatoio vuoto: il LED lampeggia a scatti (con riduci movimento resta acceso). */
.sigaretta.scaduta .svapo-led {
  animation: led-vuoto 1s steps(1, end) infinite;
}
.sigaretta.scaduta .svapo-alone {
  animation: none;
}
```

Con gli altri `@keyframes`:

```css
@keyframes vapore {
  0% {
    opacity: 0;
    transform: translate(0, 4px) scale(0.5);
  }
  30% {
    opacity: 0.5;
  }
  100% {
    opacity: 0;
    transform: translate(-8px, -22px) scale(1.6);
  }
}
@keyframes led-vuoto {
  50% {
    opacity: 0.15;
  }
}
```

- [ ] **Step 5: Verifica automatica**

Run: `npm test` → tutti PASS. Run: `npm run build` → completata senza errori.

- [ ] **Step 6: Verifica manuale nel browser**

`npm run dev`, aprire `http://localhost:5173/krumiro2.0/` a 390 px di larghezza. In Impostazioni: *Tolleranza* 1, *Tipo* Normale. In Oggi: *Entrata*, poi *Pausa sigaretta*.

1. **Accesa**: sigaretta come prima, sfondo marrone scuro, timer da `01:00`.
2. **Ultimi**: a `00:30` lo sfondo pulsa di rosso circa una volta al secondo; disegno, timer, nota e bottoni restano sopra lo strato e leggibili anche al picco (**leggibilità**).
3. **Scadenza**: il lampeggio si ferma, lo sfondo diventa rosso scuro fisso; il posacenere sale, il mozzicone cade, viene schiacciato, la brace si spegne, uno sbuffo; poi resta il mozzicone schiacciato. La sequenza avviene una volta sola. Timer `+00:0x` rosato leggibile, nota *Al rientro: 30 min di permesso*.
4. **Ricarica a pausa scaduta**: ricaricare la pagina → la schermata ricompare rossa con il posacenere già nello stato finale, senza sequenza.
5. **Rientro**: toast come prima, schermata chiusa.
6. **Elettronica**: in Impostazioni *Tipo* Elettronica, nuova *Pausa sigaretta* → liquido arancio che scende, LED che pulsa, sbuffi dal bocchino, nessun accorciamento; a `00:30` lampeggio; allo scadere serbatoio vuoto, vapore fermo, LED che lampeggia a scatti, nessun posacenere, sfondo rosso. Poi *Annulla pausa*.
7. **Tolleranza 0**: impostare 0, *Pausa sigaretta* → si apre già rossa, senza lampeggio né sequenza (normale: posacenere già con il mozzicone). *Annulla pausa*.
8. **Riduci movimento**: in DevTools → Rendering → *Emulate CSS media feature prefers-reduced-motion: reduce*, tolleranza 1: negli ultimi 30 s tinta rossa fissa; allo scadere posacenere con mozzicone senza animazione (normale) o LED acceso fisso (elettronica); la cartina e il liquido calano comunque.
9. Ripetere i passi 1–3 in tema chiaro e in tema scuro (la schermata deve restare uguale).

Se un dettaglio del disegno non convince (posizione del mozzicone nel posacenere, colori), correggere solo coordinate o colori nell'SVG di `sigarettaDisegni.ts` o i valori di `translate` in `mozzicone-cade`, senza cambiare classi o struttura.

Riportare le impostazioni a Normale e tolleranza 11.

- [ ] **Step 7: Commit**

```bash
git add src/ui/sigaretta.ts src/style.css
git commit -F - <<'EOF'
Pausa sigaretta: lampeggio negli ultimi 30 secondi, sfondo rosso, posacenere e sigaretta elettronica

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Aiuto e README

**Files:**
- Modify: `src/ui/aiutoTesti.ts` (voce `pausa-sigaretta`, righe ~142–155)
- Modify: `README.md` (righe ~56–58 e ~63–64)
- Test: `tests/aiuto.test.ts`

**Interfaces:**
- Consumes: `Impostazioni.tipoSigaretta` (Task 2); helper di test `impostazioni(modifiche)` in `tests/helpers.ts`.

- [ ] **Step 1: Scrivere il test che fallisce**

In `tests/aiuto.test.ts`, dopo il test `'la pausa sigaretta usa la tolleranza impostata'`:

```ts
  it('la pausa sigaretta descrive il disegno scelto', () => {
    const testo = (tipoSigaretta: 'normale' | 'elettronica') =>
      vociAiuto(impostazioni({ tipoSigaretta })).find((x) => x.id === 'pausa-sigaretta')!.testo.join(' ');
    expect(testo('normale')).toContain('posacenere');
    expect(testo('elettronica')).toContain('LED');
    expect(testo('elettronica')).not.toContain('posacenere');
    expect(testo('normale')).toContain('ultimi 30 secondi');
    expect(testo('normale')).toContain('normale o elettronica');
  });
```

- [ ] **Step 2: Verificare che fallisca**

Run: `npx vitest run tests/aiuto.test.ts` → FAIL (il testo non contiene `posacenere`).

- [ ] **Step 3: Implementare**

In `src/ui/aiutoTesti.ts`, dentro `vociAiuto`, dopo `const tolleranza = …`:

```ts
  const fineSigaretta =
    imp.tipoSigaretta === 'elettronica' ? 'il serbatoio si svuota e il LED lampeggia' : 'la sigaretta finisce nel posacenere';
```

Nella voce `pausa-sigaretta`, dopo la prima riga del `testo` (quella che inizia con `` `Registra un'uscita in permesso…` ``) aggiungere:

```ts
        `Negli ultimi 30 secondi lo schermo lampeggia di rosso; oltre la tolleranza ${fineSigaretta} e lo sfondo resta rosso finché non rientri.`,
```

e sostituire l'ultima riga `'La tolleranza si cambia in Impostazioni → Pausa sigaretta.'` con:

```ts
        'Tolleranza e tipo di sigaretta (normale o elettronica) si cambiano in Impostazioni → Pausa sigaretta.',
```

- [ ] **Step 4: Verificare che passi**

Run: `npx vitest run tests/aiuto.test.ts` → PASS.

- [ ] **Step 5: README**

In `README.md`, sostituire il punto *Pausa sigaretta* della sezione *Come si usa*:

```markdown
- **Pausa sigaretta**: registra un'uscita e apre una schermata con il conto alla rovescia e una
  sigaretta che si consuma (normale o elettronica, a scelta). Negli ultimi 30 secondi lo schermo
  lampeggia di rosso; allo scadere la sigaretta finisce nel posacenere e lo sfondo resta rosso.
  Se rientri entro la tolleranza (11 min, configurabile) la pausa si cancella; altrimenti diventa
  permesso a blocchi di 30 min.
```

e nel punto *Impostazioni* sostituire `tolleranza della pausa sigaretta` con `tolleranza e tipo della pausa sigaretta`.

- [ ] **Step 6: Verifica finale**

Run: `npm test` → tutti PASS. Run: `npm run build` → completata. In `npm run dev`, scheda Aiuto → *Pausa sigaretta*: il testo cambia passando da Normale a Elettronica nelle impostazioni.

- [ ] **Step 7: Commit**

```bash
git add src/ui/aiutoTesti.ts tests/aiuto.test.ts README.md
git commit -F - <<'EOF'
Pausa sigaretta: aiuto e README per lampeggio, posacenere e sigaretta elettronica

Closes #9

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
