# Avvisi nella PWA — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La PWA riceve gli stessi tre avvisi dell'app Android (uscita prevista, rientro dal pranzo, rientro dalla sigaretta) tramite web push: la pagina invia l'orario di ogni avviso al backend Cloudflare, che allo scadere manda la notifica, e il service worker la mostra con il testo giusto.

**Architecture:** La logica pura (id, confronto piano/inviati, stato dei permessi, scelta del testo) sta in `src/core/avvisiPush.ts` ed è condivisa da pagina e service worker. `src/web/avvisi.ts` è il gemello di `src/native/avvisi.ts` per la PWA: iscrizione push, `PUT`/`DELETE` verso il backend, testi nella Cache del browser, stato in `localStorage`. Il service worker diventa nostro (`src/sw.ts`, strategia `injectManifest` di `vite-plugin-pwa`): precache e fallback come prima, più gli handler `push` e `notificationclick`.

**Tech Stack:** TypeScript 5.9 senza framework (helper `el()` in `src/ui/dom.ts`), Vite 8 + vite-plugin-pwa 1.3 (`injectManifest`), Workbox 7.4 (`workbox-core`, `workbox-precaching`, `workbox-routing`), Vitest 5 (ambiente node, nessun DOM: le API del browser si simulano con `vi.stubGlobal`), Push API, Cache Storage, localStorage.

**Spec:** `docs/superpowers/specs/2026-10-05-avvisi-pwa-design.md`

## Global Constraints

- Testi dell'interfaccia, nomi e commenti in **italiano**, come il resto del codice.
- Il backend (`c:\progetti\krumiro2.0_backend`) **non cambia**.
- `URL_NOTIFICHE = 'https://krumiro-notifiche.oliosi-riccardo.workers.dev'`; API `PUT /avvisi/{id}` con corpo `{ contatto: subscription.toJSON(), orario }` e `DELETE /avvisi/{id}`, entrambe rispondono `204`.
- `CHIAVE_VAPID = 'BDMM0_ITU0dc_OrEyil6M1IliUYEiKma7ANcCiK5CVxVIM8LxBWnycBd0NJG_PQpBTadDsQctWsx2z6dMzZb0iA'` (da `wrangler.jsonc` del backend).
- Id dell'avviso: `` `${dispositivo}-${tipo}` ``, al massimo 64 caratteri `[A-Za-z0-9_-]`; `dispositivo` = `nuovoId()` salvato una volta.
- `orario` inviato al backend e salvato nella Cache: `new Date(ms).toISOString()`.
- Chiave locale `timbrature-avvisi-push` = `{ dispositivo, endpoint, inviati }` (stato del dispositivo, fuori dal backup).
- Cache `krumiro-avvisi`, voce `new URL('avvisi/<id>', registration.scope)` con JSON `{ titolo, testo, orario }`.
- Testi generici: uscita "Puoi andare via" / "Le ore di oggi sono completate."; pausa "Fine pausa pranzo" / "È ora di rientrare."; sigaretta "Pausa sigaretta" / "Rientra prima che diventi permesso."; payload non valido "Krumiro" / "Apri l'app per i dettagli." con tag `krumiro`.
- Notifica: `icon: 'icons/icon-192.png'`, `badge: 'icons/badge-96.png'`, `tag` = id.
- L'app Android non cambia comportamento (notifiche locali, testi di Impostazioni invariati salvo il caso "non disponibili").
- Nuove dipendenze solo di sviluppo: `workbox-core`, `workbox-precaching`, `workbox-routing` `^7.4.1`.
- Comandi: `npm test`, `npm run typecheck`, `npm run build`, `npx vite preview --port 5173` (porta ammessa dal CORS del backend), app su `http://localhost:5173/krumiro2.0/`.
- Branch `feature/avvisi-pwa`. Ogni commit termina con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **PWA già installata con il service worker generato** → dopo l'aggiornamento il nuovo service worker prende il controllo da solo e l'app continua a funzionare offline (Task 3, verifica manuale "aggiornamento dal service worker vecchio").
2. **Timbratura fatta senza connessione** → l'avviso parte verso il server appena torna la connessione con l'app aperta, senza toccare nulla (Task 2, test "riprova quando torna la connessione").
3. **Pausa sigaretta con l'istante preciso al secondo** → l'orario inviato conserva i secondi, non viene arrotondato al minuto (Task 2, test "pausa sigaretta: orario al secondo").
4. **Avviso scaduto o giorno nuovo** → nessun `DELETE` (il server potrebbe non averlo ancora spedito), lo stato locale e la Cache si puliscono (Task 2, test "avviso scaduto: lo dimentica senza DELETE").
5. **Iscrizione persa con permesso concesso** (dati del sito cancellati, iscrizione scaduta) → nessuna chiamata al server e in Impostazioni ricompare il pulsante (Task 1, test "concessi solo con permesso e iscrizione"; Task 2, test "nessuna iscrizione").

---

## File Structure

| File | Ruolo |
|---|---|
| `src/core/avvisi.ts` (modifica) | Ospita il tipo `StatoPermessi`, con il nuovo valore `'da-installare'` |
| `src/core/avvisiPush.ts` (nuovo) | Logica pura condivisa da pagina e service worker |
| `src/native/avvisi.ts` (modifica) | Importa `StatoPermessi` da `core/avvisi` |
| `src/web/avvisi.ts` (nuovo) | Avvisi della PWA: permessi, iscrizione, sincronizzazione con il backend |
| `src/sw.ts` (nuovo) | Service worker: precache, fallback, aggiornamento automatico, `push`, `notificationclick` |
| `tsconfig.json` (modifica), `tsconfig.sw.json` (nuovo) | Il service worker si controlla con la lib `WebWorker` |
| `vite.config.ts`, `package.json`, `package-lock.json` (modifica) | `injectManifest`, script di typecheck, dipendenze Workbox |
| `scripts/genera-icone.mjs` (modifica), `public/icons/badge-96.png` (nuovo) | Icona `badge` monocromatica |
| `src/main.ts`, `src/ui/impostazioni.ts` (modifica) | Avvio degli avvisi della PWA e sezione Avvisi per piattaforma |
| `src/ui/aiutoTesti.ts`, `README.md` (modifica) | Testi |
| `tests/avvisiPush.test.ts`, `tests/webAvvisi.test.ts` (nuovi), `tests/aiuto.test.ts` (modifica) | Test |

---

### Task 1: Logica pura degli avvisi push

**Files:**
- Create: `src/core/avvisiPush.ts`
- Modify: `src/core/avvisi.ts` (aggiunta del tipo in cima, dopo `ID_AVVISO`)
- Modify: `src/native/avvisi.ts:1-21` (import e rimozione del tipo locale)
- Modify: `src/ui/impostazioni.ts:13` e `:55-60` (import del tipo e nuova voce della mappa)
- Test: `tests/avvisiPush.test.ts`

**Interfaces:**
- Consumes: `TipoAvviso` da `src/core/avvisi.ts` (`'uscita' | 'pausa' | 'sigaretta'`).
- Produces:
  - `src/core/avvisi.ts`: `export type StatoPermessi = 'concessi' | 'negati' | 'da-chiedere' | 'da-installare' | 'non-disponibili';`
  - `src/core/avvisiPush.ts`:
    - `CACHE_AVVISI: 'krumiro-avvisi'`
    - `idAvviso(dispositivo: string, tipo: TipoAvviso): string`
    - `tipoDaId(id: string): TipoAvviso | null`
    - `chiaveCache(scope: string, id: string): string`
    - `chiaveDaBase64url(s: string): Uint8Array<ArrayBuffer>`
    - `interface AvvisoPush { tipo: TipoAvviso; orario: number; titolo: string; testo: string }`
    - `interface Inviato { orario: number; titolo: string; testo: string }`, `type Inviati = Partial<Record<TipoAvviso, Inviato>>`
    - `type OperazionePush = { azione: 'programma'; avviso: AvvisoPush } | { azione: 'annulla'; tipo: TipoAvviso } | { azione: 'dimentica'; tipo: TipoAvviso }`
    - `operazioniPush(piano: AvvisoPush[], inviati: Inviati, opz: { ora: number; endpointCambiato: boolean }): OperazionePush[]`
    - `interface AmbientePush { iosNonInstallata: boolean; supportato: boolean; permesso: 'granted' | 'denied' | 'default'; iscritto: boolean }`
    - `statoPermessiWeb(a: AmbientePush): StatoPermessi`
    - `interface TestoSalvato { titolo: string; testo: string; orario: string }`, `interface Notifica { titolo: string; testo: string; tag: string }`
    - `notificaDaPush(payload: unknown, salvato: unknown): Notifica`

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `tests/avvisiPush.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CACHE_AVVISI,
  chiaveCache,
  chiaveDaBase64url,
  idAvviso,
  notificaDaPush,
  operazioniPush,
  statoPermessiWeb,
  tipoDaId,
  type AvvisoPush,
} from '../src/core/avvisiPush';

const DISPOSITIVO = '3f2a9c1e-0b7d-4e57-9a1c-2d4b6e8f0a11';
const ORA = Date.parse('2026-10-01T08:00:00Z'); // 10:00 a Roma
const uscita: AvvisoPush = {
  tipo: 'uscita',
  orario: Date.parse('2026-10-01T15:30:00Z'),
  titolo: 'Puoi andare via',
  testo: 'Le ore sono completate: uscita prevista alle 17:30.',
};
const pausa: AvvisoPush = {
  tipo: 'pausa',
  orario: Date.parse('2026-10-01T08:35:00Z'),
  titolo: 'Fine pausa pranzo',
  testo: 'Sono passati 45 min: è ora di rientrare.',
};
const inviato = ({ orario, titolo, testo }: AvvisoPush) => ({ orario, titolo, testo });
const opz = { ora: ORA, endpointCambiato: false };

describe('id degli avvisi', () => {
  it('unisce dispositivo e tipo in un id valido per il backend', () => {
    const id = idAvviso(DISPOSITIVO, 'sigaretta');
    expect(id).toBe(`${DISPOSITIVO}-sigaretta`);
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });

  it('ricava il tipo dall\'id', () => {
    expect(tipoDaId(idAvviso(DISPOSITIVO, 'uscita'))).toBe('uscita');
    expect(tipoDaId(idAvviso(DISPOSITIVO, 'pausa'))).toBe('pausa');
    expect(tipoDaId(idAvviso(DISPOSITIVO, 'sigaretta'))).toBe('sigaretta');
  });

  it('id non riconoscibili', () => {
    expect(tipoDaId(`${DISPOSITIVO}-caffe`)).toBeNull();
    expect(tipoDaId('pausa')).toBeNull();
    expect(tipoDaId('')).toBeNull();
  });
});

describe('operazioni verso il backend', () => {
  it('avviso nuovo → programma', () => {
    expect(operazioniPush([uscita], {}, opz)).toEqual([{ azione: 'programma', avviso: uscita }]);
  });

  it('avviso identico → nessuna operazione', () => {
    expect(operazioniPush([uscita], { uscita: inviato(uscita) }, opz)).toEqual([]);
  });

  it('orario o testo cambiati → programma di nuovo', () => {
    const prima = { uscita: inviato(uscita) };
    const piuTardi = { ...uscita, orario: uscita.orario + 15 * 60_000 };
    const altroTesto = { ...uscita, testo: 'Le ore sono completate: uscita prevista alle 17:45.' };
    expect(operazioniPush([piuTardi], prima, opz)).toEqual([{ azione: 'programma', avviso: piuTardi }]);
    expect(operazioniPush([altroTesto], prima, opz)).toEqual([{ azione: 'programma', avviso: altroTesto }]);
  });

  it('avviso futuro non più nel piano → annulla', () => {
    expect(operazioniPush([], { uscita: inviato(uscita) }, opz)).toEqual([{ azione: 'annulla', tipo: 'uscita' }]);
  });

  it('avviso già scaduto non più nel piano → dimentica, senza DELETE', () => {
    const inviati = { uscita: inviato(uscita) };
    expect(operazioniPush([], inviati, { ora: uscita.orario + 60_000, endpointCambiato: false })).toEqual([
      { azione: 'dimentica', tipo: 'uscita' },
    ]);
    // Proprio all'orario il server lo sta spedendo: non va annullato.
    expect(operazioniPush([], inviati, { ora: uscita.orario, endpointCambiato: false })).toEqual([
      { azione: 'dimentica', tipo: 'uscita' },
    ]);
  });

  it('in pausa: programma il rientro e annulla l\'uscita', () => {
    expect(operazioniPush([pausa], { uscita: inviato(uscita) }, opz)).toEqual([
      { azione: 'programma', avviso: pausa },
      { azione: 'annulla', tipo: 'uscita' },
    ]);
  });

  it('endpoint cambiato → riprogramma anche gli avvisi identici', () => {
    expect(operazioniPush([uscita], { uscita: inviato(uscita) }, { ora: ORA, endpointCambiato: true })).toEqual([
      { azione: 'programma', avviso: uscita },
    ]);
  });

  it('niente piano e niente inviati → nessuna operazione', () => {
    expect(operazioniPush([], {}, opz)).toEqual([]);
  });
});

describe('stato dei permessi nella PWA', () => {
  const base = { iosNonInstallata: false, supportato: true, permesso: 'granted', iscritto: true } as const;

  it('concessi solo con permesso e iscrizione', () => {
    expect(statoPermessiWeb(base)).toBe('concessi');
    expect(statoPermessiWeb({ ...base, iscritto: false })).toBe('da-chiedere');
    expect(statoPermessiWeb({ ...base, permesso: 'default', iscritto: false })).toBe('da-chiedere');
  });

  it('permesso negato', () => {
    expect(statoPermessiWeb({ ...base, permesso: 'denied', iscritto: false })).toBe('negati');
  });

  it('iPhone aperto nel browser: da installare, prima di ogni altro controllo', () => {
    expect(statoPermessiWeb({ ...base, iosNonInstallata: true, supportato: false })).toBe('da-installare');
  });

  it('browser senza push o senza service worker attivo', () => {
    expect(statoPermessiWeb({ ...base, supportato: false })).toBe('non-disponibili');
  });
});

describe('testo della notifica', () => {
  const id = idAvviso(DISPOSITIVO, 'pausa');
  const payload = {
    tipo: 'fine-pausa',
    id,
    orario: '2026-10-01T08:35:00.000Z',
    titolo: 'Pausa finita',
    testo: 'È ora di timbrare il rientro',
  };
  const salvato = { titolo: 'Fine pausa pranzo', testo: 'Sono passati 45 min: è ora di rientrare.', orario: '2026-10-01T08:35:00.000Z' };

  it('usa il testo salvato se l\'orario coincide', () => {
    expect(notificaDaPush(payload, salvato)).toEqual({ titolo: salvato.titolo, testo: salvato.testo, tag: id });
  });

  it('testo salvato di un altro orario → testo generico del tipo', () => {
    expect(notificaDaPush(payload, { ...salvato, orario: '2026-10-01T08:20:00.000Z' })).toEqual({
      titolo: 'Fine pausa pranzo',
      testo: 'È ora di rientrare.',
      tag: id,
    });
  });

  it('senza testo salvato → testo generico del tipo', () => {
    const idUscita = idAvviso(DISPOSITIVO, 'uscita');
    expect(notificaDaPush({ ...payload, id: idUscita }, null)).toEqual({
      titolo: 'Puoi andare via',
      testo: 'Le ore di oggi sono completate.',
      tag: idUscita,
    });
    expect(notificaDaPush({ ...payload, id: idAvviso(DISPOSITIVO, 'sigaretta') }, null)).toMatchObject({
      titolo: 'Pausa sigaretta',
      testo: 'Rientra prima che diventi permesso.',
    });
  });

  it('testo salvato malformato → ignorato', () => {
    expect(notificaDaPush(payload, { titolo: 3 })).toMatchObject({ titolo: 'Fine pausa pranzo', testo: 'È ora di rientrare.' });
    expect(notificaDaPush(payload, 'testo')).toMatchObject({ titolo: 'Fine pausa pranzo' });
  });

  it('id non riconoscibile → testo del payload', () => {
    expect(notificaDaPush({ ...payload, id: 'altro' }, null)).toEqual({
      titolo: 'Pausa finita',
      testo: 'È ora di timbrare il rientro',
      tag: 'altro',
    });
    expect(notificaDaPush({ id: 'altro' }, null)).toEqual({ titolo: 'Krumiro', testo: '', tag: 'altro' });
  });

  it('payload non valido → notifica generica', () => {
    const generica = { titolo: 'Krumiro', testo: 'Apri l\'app per i dettagli.', tag: 'krumiro' };
    expect(notificaDaPush(null, null)).toEqual(generica);
    expect(notificaDaPush('ciao', null)).toEqual(generica);
    expect(notificaDaPush({ id: 7 }, null)).toEqual(generica);
  });
});

describe('cache e chiave VAPID', () => {
  it('la voce della cache è la stessa nella pagina e nel service worker', () => {
    expect(CACHE_AVVISI).toBe('krumiro-avvisi');
    expect(chiaveCache('https://ricky79.github.io/krumiro2.0/', 'abc-pausa')).toBe(
      'https://ricky79.github.io/krumiro2.0/avvisi/abc-pausa',
    );
  });

  it('decodifica la chiave VAPID in un punto P-256 non compresso', () => {
    const chiave = chiaveDaBase64url('BDMM0_ITU0dc_OrEyil6M1IliUYEiKma7ANcCiK5CVxVIM8LxBWnycBd0NJG_PQpBTadDsQctWsx2z6dMzZb0iA');
    expect(chiave).toHaveLength(65);
    expect(chiave[0]).toBe(4);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run tests/avvisiPush.test.ts`
Expected: FAIL con "Failed to resolve import '../src/core/avvisiPush'".

- [ ] **Step 3: Sposta `StatoPermessi` in `src/core/avvisi.ts`**

In `src/core/avvisi.ts`, subito dopo `export const ID_AVVISO …;`, aggiungi:

```ts
/**
 * Stato dei permessi di notifica. 'da-installare' vale solo nella PWA su iPhone, dove le notifiche
 * arrivano soltanto con l'app aggiunta alla schermata Home.
 */
export type StatoPermessi = 'concessi' | 'negati' | 'da-chiedere' | 'da-installare' | 'non-disponibili';
```

In `src/native/avvisi.ts` cambia la prima riga in:

```ts
import { ID_AVVISO, pianificaAvvisi, type Avviso, type StatoPermessi } from '../core/avvisi';
```

e cancella la riga `export type StatoPermessi = 'concessi' | 'negati' | 'da-chiedere' | 'non-disponibili';`.

In `src/ui/impostazioni.ts` sostituisci

```ts
import { richiediPermessi, statoPermessi, type StatoPermessi } from '../native/avvisi';
```

con

```ts
import { richiediPermessi, statoPermessi } from '../native/avvisi';
import type { StatoPermessi } from '../core/avvisi';
```

e aggiungi alla mappa `TESTO_PERMESSI` la voce (la Task 4 dividerà la mappa tra app e PWA):

```ts
  'da-installare': 'Su iPhone gli avvisi arrivano solo con l\'app aggiunta alla schermata Home.',
```

- [ ] **Step 4: Scrivi `src/core/avvisiPush.ts`**

```ts
import type { StatoPermessi, TipoAvviso } from './avvisi';

/**
 * Avvisi della PWA (web push): la pagina invia al backend l'orario di ogni avviso, il backend allo
 * scadere manda una notifica push e il service worker la mostra. Logica pura, condivisa dalla pagina
 * (`src/web/avvisi.ts`) e dal service worker (`src/sw.ts`).
 */

const TIPI: readonly TipoAvviso[] = ['uscita', 'pausa', 'sigaretta'];

/** Cache del browser in cui la pagina lascia il testo di ogni avviso per il service worker. */
export const CACHE_AVVISI = 'krumiro-avvisi';

/** Id dell'avviso sul backend: uno per dispositivo e tipo, così riprogrammare lo sostituisce. */
export function idAvviso(dispositivo: string, tipo: TipoAvviso): string {
  return `${dispositivo}-${tipo}`;
}

/** Il tipo dopo l'ultimo '-' dell'id, o null se l'id non è di un avviso riconoscibile. */
export function tipoDaId(id: string): TipoAvviso | null {
  const i = id.lastIndexOf('-');
  if (i < 0) return null;
  const tipo = id.slice(i + 1);
  return TIPI.find((t) => t === tipo) ?? null;
}

/** Indirizzo della voce nella Cache, risolto sullo scope del service worker: uguale nella pagina e nel worker. */
export function chiaveCache(scope: string, id: string): string {
  return new URL(`avvisi/${id}`, scope).href;
}

/** La chiave VAPID (base64url) come byte: il formato che `pushManager.subscribe` accetta ovunque, Safari compreso. */
export function chiaveDaBase64url(s: string): Uint8Array<ArrayBuffer> {
  const base64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Avviso del piano di oggi con l'istante esatto già calcolato (epoch ms). */
export interface AvvisoPush {
  tipo: TipoAvviso;
  orario: number;
  titolo: string;
  testo: string;
}

/** Ciò che il backend ha già ricevuto per un tipo di avviso. */
export interface Inviato {
  orario: number;
  titolo: string;
  testo: string;
}

export type Inviati = Partial<Record<TipoAvviso, Inviato>>;

export type OperazionePush =
  | { azione: 'programma'; avviso: AvvisoPush }
  | { azione: 'annulla'; tipo: TipoAvviso }
  | { azione: 'dimentica'; tipo: TipoAvviso };

/**
 * Cosa chiedere al backend perché abbia esattamente gli avvisi del piano:
 * - avviso nuovo, cambiato (orario o testo) o con l'iscrizione push cambiata → programma (PUT);
 * - avviso inviato che non è più nel piano: se è ancora futuro → annulla (DELETE); se l'orario è
 *   passato → dimentica, senza DELETE: il server l'ha spedito o lo spedisce al prossimo giro e lo
 *   cancella da solo, e un DELETE in quel momento farebbe perdere un avviso appena scaduto.
 */
export function operazioniPush(
  piano: AvvisoPush[],
  inviati: Inviati,
  opz: { ora: number; endpointCambiato: boolean },
): OperazionePush[] {
  const operazioni: OperazionePush[] = [];
  for (const a of piano) {
    const prima = inviati[a.tipo];
    const uguale = prima !== undefined && prima.orario === a.orario && prima.titolo === a.titolo && prima.testo === a.testo;
    if (!uguale || opz.endpointCambiato) operazioni.push({ azione: 'programma', avviso: a });
  }
  for (const tipo of TIPI) {
    const prima = inviati[tipo];
    if (prima === undefined || piano.some((a) => a.tipo === tipo)) continue;
    operazioni.push(prima.orario > opz.ora ? { azione: 'annulla', tipo } : { azione: 'dimentica', tipo });
  }
  return operazioni;
}

/** Cosa si sa del browser per decidere lo stato dei permessi della PWA. */
export interface AmbientePush {
  /** iPhone o iPad con l'app aperta nel browser e non dalla schermata Home. */
  iosNonInstallata: boolean;
  /** Push API presente e service worker attivo. */
  supportato: boolean;
  permesso: 'granted' | 'denied' | 'default';
  /** C'è un'iscrizione push attiva. */
  iscritto: boolean;
}

export function statoPermessiWeb(a: AmbientePush): StatoPermessi {
  if (a.iosNonInstallata) return 'da-installare';
  if (!a.supportato) return 'non-disponibili';
  if (a.permesso === 'denied') return 'negati';
  if (a.permesso === 'granted' && a.iscritto) return 'concessi';
  return 'da-chiedere';
}

/** Testo che la pagina salva nella Cache per un avviso: `orario` in ISO UTC, come nel payload del backend. */
export interface TestoSalvato {
  titolo: string;
  testo: string;
  orario: string;
}

export interface Notifica {
  titolo: string;
  testo: string;
  tag: string;
}

/** Testi usati quando manca quello salvato (es. Cache svuotata dal browser). */
const TESTI_GENERICI: Record<TipoAvviso, { titolo: string; testo: string }> = {
  uscita: { titolo: 'Puoi andare via', testo: 'Le ore di oggi sono completate.' },
  pausa: { titolo: 'Fine pausa pranzo', testo: 'È ora di rientrare.' },
  sigaretta: { titolo: 'Pausa sigaretta', testo: 'Rientra prima che diventi permesso.' },
};

function isOggetto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function testoSalvato(v: unknown): TestoSalvato | null {
  if (!isOggetto(v) || typeof v.titolo !== 'string' || typeof v.testo !== 'string' || typeof v.orario !== 'string') return null;
  return { titolo: v.titolo, testo: v.testo, orario: v.orario };
}

/**
 * Cosa mostrare per un push del backend. Restituisce sempre una notifica: con `userVisibleOnly` il
 * browser pretende che ogni push ne mostri una. Il testo salvato vale solo se è dello stesso orario
 * del push, così un testo rimasto da una vecchia programmazione non finisce su un avviso nuovo.
 */
export function notificaDaPush(payload: unknown, salvato: unknown): Notifica {
  if (!isOggetto(payload) || typeof payload.id !== 'string') {
    return { titolo: 'Krumiro', testo: 'Apri l\'app per i dettagli.', tag: 'krumiro' };
  }
  const id = payload.id;
  const t = testoSalvato(salvato);
  if (t && t.orario === payload.orario) return { titolo: t.titolo, testo: t.testo, tag: id };
  const tipo = tipoDaId(id);
  if (tipo) return { ...TESTI_GENERICI[tipo], tag: id };
  return {
    titolo: typeof payload.titolo === 'string' && payload.titolo !== '' ? payload.titolo : 'Krumiro',
    testo: typeof payload.testo === 'string' ? payload.testo : '',
    tag: id,
  };
}
```

- [ ] **Step 5: Esegui i test e il typecheck**

Run: `npx vitest run tests/avvisiPush.test.ts`
Expected: PASS (tutti i test).

Run: `npm test && npx tsc --noEmit`
Expected: tutti i test passano (compresi `nativeAvvisi.test.ts`), nessun errore di tipo.

- [ ] **Step 6: Commit**

```bash
git add src/core/avvisi.ts src/core/avvisiPush.ts src/native/avvisi.ts src/ui/impostazioni.ts tests/avvisiPush.test.ts
git commit -F - <<'EOF'
Avvisi PWA: logica pura di id, operazioni, permessi e testi

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Avvisi della PWA nella pagina (`src/web/avvisi.ts`)

**Files:**
- Create: `src/web/avvisi.ts`
- Test: `tests/webAvvisi.test.ts`

**Interfaces:**
- Consumes (Task 1): `StatoPermessi`, `pianificaAvvisi` da `src/core/avvisi.ts`; `CACHE_AVVISI`, `chiaveCache`, `chiaveDaBase64url`, `idAvviso`, `operazioniPush`, `statoPermessiWeb`, `AvvisoPush`, `Inviati`, `TestoSalvato` da `src/core/avvisiPush.ts`. Esistenti: `nuovoId()` (`src/core/id.ts`), `istanteDaMinuti(minuti, ora: Date)` (`src/core/sigaretta.ts`), `adessoRoma(ora?: Date)` (`src/core/tempo.ts`), `store.giornata(data)`, `store.impostazioni`, `store.ascolta(fn)` (`src/storage/store.ts`), `inizioSigarettaSalvato(data, eventoId)` (`src/ui/inizioSigaretta.ts`), `piattaforma(userAgent, puntiTocco)` e `inModalitaApp()` (`src/ui/installa.ts`).
- Produces (usati dalla Task 4), stessa forma di `src/native/avvisi.ts`:
  - `URL_NOTIFICHE: string`, `CHIAVE_VAPID: string`
  - `statoPermessi(): Promise<StatoPermessi>`
  - `richiediPermessi(): Promise<StatoPermessi>`
  - `sincronizzaAvvisi(): Promise<void>`
  - `avviaAvvisi(): void`

- [ ] **Step 1: Scrivi i test che falliscono**

Crea `tests/webAvvisi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { giornata, impostazioni } from './helpers';

// Browser, backend e store sono finti: si verifica cosa viene chiesto al backend e cosa resta salvato.
const dati = vi.hoisted(() => ({ giornata: null as unknown, impostazioni: null as unknown }));
const inizi = vi.hoisted(() => ({ sigaretta: null as number | null }));
vi.mock('../src/ui/inizioSigaretta', () => ({ inizioSigarettaSalvato: () => inizi.sigaretta }));
vi.mock('../src/storage/store', () => ({
  store: {
    giornata: () => dati.giornata,
    get impostazioni() {
      return dati.impostazioni;
    },
    ascolta: vi.fn(),
  },
}));

const BASE = 'https://krumiro-notifiche.oliosi-riccardo.workers.dev';
const SCOPE = 'https://ricky79.github.io/krumiro2.0/';
const CHIAVE = 'timbrature-avvisi-push';
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

const contatto = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
  expirationTime: null,
  keys: { p256dh: 'P256DH', auth: 'AUTH' },
};
let iscrizione: { endpoint: string; toJSON: () => typeof contatto };
const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() };
const registrazione = { active: {}, scope: SCOPE, pushManager };
const sw = { getRegistration: vi.fn(), ready: Promise.resolve(registrazione) };
const notifica = { permission: 'granted' as 'granted' | 'denied' | 'default', requestPermission: vi.fn() };
const fetchFinta = vi.fn();
let memoria: Map<string, string>;
let cache: Map<string, string>;
let ascoltatori: Map<string, () => void>;
let nav: { userAgent: string; maxTouchPoints: number; serviceWorker: typeof sw };

const ok = () => new Response(null, { status: 204 });
const stato = () => JSON.parse(memoria.get(CHIAVE) ?? 'null') as {
  dispositivo: string;
  endpoint: string | null;
  inviati: Record<string, { orario: number; titolo: string; testo: string }>;
};
const chiamate = () =>
  fetchFinta.mock.calls.map(([url, init]) => ({
    url: url as string,
    method: (init as RequestInit).method,
    corpo: (init as RequestInit).body ? JSON.parse((init as RequestInit).body as string) : undefined,
  }));

async function carica() {
  vi.resetModules();
  return import('../src/web/avvisi');
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T08:00:00Z')); // 10:00 a Roma (UTC+2)
  memoria = new Map();
  cache = new Map();
  ascoltatori = new Map();
  iscrizione = { endpoint: contatto.endpoint, toJSON: () => contatto };
  for (const f of [pushManager.getSubscription, pushManager.subscribe, sw.getRegistration, notifica.requestPermission, fetchFinta]) {
    f.mockReset();
  }
  pushManager.getSubscription.mockImplementation(async () => iscrizione);
  sw.getRegistration.mockResolvedValue(registrazione);
  notifica.permission = 'granted';
  fetchFinta.mockImplementation(async () => ok());
  nav = { userAgent: UA_ANDROID, maxTouchPoints: 5, serviceWorker: sw };

  vi.stubGlobal('fetch', fetchFinta);
  vi.stubGlobal('Notification', notifica);
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('window', {
    PushManager: class {},
    Notification: notifica,
    matchMedia: () => ({ matches: false }),
    addEventListener: (tipo: string, f: () => void) => ascoltatori.set(tipo, f),
  });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: vi.fn() });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, String(v)),
    removeItem: (k: string) => void memoria.delete(k),
  });
  vi.stubGlobal('caches', {
    open: async () => ({
      put: async (k: string, r: Response) => void cache.set(String(k), await r.text()),
      delete: async (k: string) => cache.delete(String(k)),
      match: async (k: string) => (cache.has(String(k)) ? new Response(cache.get(String(k))) : undefined),
    }),
  });

  dati.impostazioni = impostazioni();
  dati.giornata = giornata([['ENTRATA', '08:30']]);
  inizi.sigaretta = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('sincronizzazione con il backend', () => {
  it('programma l\'uscita prevista con un PUT e salva testo e stato', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();

    const s = stato();
    const id = `${s.dispositivo}-uscita`;
    expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(fetchFinta).toHaveBeenCalledOnce();
    const [url, init] = fetchFinta.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(`${BASE}/avvisi/${id}`);
    expect(init.method).toBe('PUT');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ contatto, orario: '2026-10-01T15:30:00.000Z' }); // 17:30 a Roma

    expect(s.endpoint).toBe(contatto.endpoint);
    expect(s.inviati.uscita).toMatchObject({ orario: Date.parse('2026-10-01T15:30:00Z'), titolo: 'Puoi andare via' });
    expect(JSON.parse(cache.get(`${SCOPE}avvisi/${id}`)!)).toEqual({
      titolo: 'Puoi andare via',
      testo: 'Le ore sono completate: uscita prevista alle 17:30.',
      orario: '2026-10-01T15:30:00.000Z',
    });
  });

  it('non richiama il server se nulla è cambiato', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    await sincronizzaAvvisi();
    expect(fetchFinta).toHaveBeenCalledOnce();
  });

  it('all\'inizio della pausa programma il rientro e annulla l\'uscita', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    const id = (tipo: string) => `${BASE}/avvisi/${stato().dispositivo}-${tipo}`;
    fetchFinta.mockClear();

    dati.giornata = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '09:50']]);
    dati.impostazioni = impostazioni({ avvisi: { uscita: true, sigaretta: true, sigarettaAnticipo: 1, pranzo: true, pranzoMinuti: 45 } });
    await sincronizzaAvvisi();

    expect(chiamate()).toEqual([
      { url: id('pausa'), method: 'PUT', corpo: { contatto, orario: '2026-10-01T08:35:00.000Z' } }, // 09:50 + 45 = 10:35
      { url: id('uscita'), method: 'DELETE', corpo: undefined },
    ]);
    expect(Object.keys(stato().inviati)).toEqual(['pausa']);
    expect(cache.has(`${SCOPE}avvisi/${stato().dispositivo}-uscita`)).toBe(false);
  });

  it('pausa sigaretta: orario al secondo', async () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '09:59']]);
    g.eventi[1]!.sigaretta = true;
    dati.giornata = g;
    inizi.sigaretta = Date.parse('2026-10-01T07:59:20Z'); // 09:59:20 a Roma
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(chiamate()).toEqual([
      { url: `${BASE}/avvisi/${stato().dispositivo}-sigaretta`, method: 'PUT', corpo: { contatto, orario: '2026-10-01T08:09:20.000Z' } },
    ]);
  });

  it('avviso scaduto: lo dimentica senza DELETE', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    const voce = `${SCOPE}avvisi/${stato().dispositivo}-uscita`;
    fetchFinta.mockClear();

    vi.setSystemTime(new Date('2026-10-01T15:31:00Z')); // 17:31: l'uscita prevista delle 17:30 è passata
    await sincronizzaAvvisi();

    expect(fetchFinta).not.toHaveBeenCalled();
    expect(stato().inviati).toEqual({});
    expect(cache.has(voce)).toBe(false);
  });

  it('errore di rete: lo stato non cambia e la sincronizzazione dopo riprova', async () => {
    fetchFinta.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { sincronizzaAvvisi } = await carica();
    await expect(sincronizzaAvvisi()).resolves.toBeUndefined();
    expect(stato().inviati).toEqual({});
    expect(stato().endpoint).toBeNull();

    await sincronizzaAvvisi();
    expect(fetchFinta).toHaveBeenCalledTimes(2);
    expect(stato().inviati.uscita).toBeDefined();
  });

  it('risposta di errore del server: riprova alla sincronizzazione dopo', async () => {
    fetchFinta.mockResolvedValueOnce(new Response('{"errore":"x"}', { status: 422 }));
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(stato().inviati).toEqual({});
    await sincronizzaAvvisi();
    expect(fetchFinta).toHaveBeenCalledTimes(2);
    expect(stato().inviati.uscita).toBeDefined();
  });

  it('iscrizione push cambiata: rifà il PUT', async () => {
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    iscrizione = { endpoint: 'https://fcm.googleapis.com/fcm/send/nuovo', toJSON: () => contatto };
    await sincronizzaAvvisi();
    expect(fetchFinta).toHaveBeenCalledTimes(2);
    expect(stato().endpoint).toBe('https://fcm.googleapis.com/fcm/send/nuovo');
  });

  it('stato salvato illeggibile: riparte con un nuovo dispositivo', async () => {
    memoria.set(CHIAVE, '{rotto');
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(stato().dispositivo).toMatch(/^[A-Za-z0-9_-]{1,54}$/);
    expect(fetchFinta).toHaveBeenCalledOnce();
  });

  it.each([
    ['permesso non concesso', () => void (notifica.permission = 'default')],
    ['service worker non attivo', () => void sw.getRegistration.mockResolvedValue(undefined)],
    ['nessuna iscrizione', () => void pushManager.getSubscription.mockImplementation(async () => null)],
  ])('%s: nessuna chiamata al server', async (_caso, prepara) => {
    prepara();
    const { sincronizzaAvvisi } = await carica();
    await sincronizzaAvvisi();
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it('riprova quando torna la connessione', async () => {
    fetchFinta.mockRejectedValue(new TypeError('Failed to fetch'));
    const { avviaAvvisi } = await carica();
    avviaAvvisi();
    // Lo stato si salva dopo la chiamata fallita: aspettare quello, non solo la chiamata.
    await vi.waitFor(() => expect(stato()?.inviati).toEqual({}));
    expect(fetchFinta).toHaveBeenCalledTimes(1);

    fetchFinta.mockImplementation(async () => ok());
    ascoltatori.get('online')!();
    await vi.waitFor(() => expect(stato().inviati.uscita).toBeDefined());
    expect(fetchFinta).toHaveBeenCalledTimes(2);
  });
});

describe('permessi', () => {
  it('permesso negato: non si iscrive e non chiama il server', async () => {
    notifica.permission = 'default';
    notifica.requestPermission.mockImplementation(async () => {
      notifica.permission = 'denied';
      return 'denied';
    });
    const { richiediPermessi } = await carica();
    expect(await richiediPermessi()).toBe('negati');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(fetchFinta).not.toHaveBeenCalled();
  });

  it('permesso concesso: si iscrive con la chiave VAPID e programma gli avvisi', async () => {
    notifica.permission = 'default';
    notifica.requestPermission.mockImplementation(async () => {
      notifica.permission = 'granted';
      return 'granted';
    });
    pushManager.getSubscription.mockImplementation(async () => null);
    pushManager.subscribe.mockImplementation(async () => {
      pushManager.getSubscription.mockImplementation(async () => iscrizione);
      return iscrizione;
    });
    const { richiediPermessi } = await carica();
    expect(await richiediPermessi()).toBe('concessi');

    const opzioni = pushManager.subscribe.mock.calls[0]![0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array };
    expect(opzioni.userVisibleOnly).toBe(true);
    expect(opzioni.applicationServerKey).toHaveLength(65);
    expect(opzioni.applicationServerKey[0]).toBe(4);
    expect(chiamate().map((c) => c.method)).toEqual(['PUT']);
  });

  it('iPhone aperto in Safari: da installare', async () => {
    nav.userAgent = UA_IPHONE;
    const { statoPermessi } = await carica();
    expect(await statoPermessi()).toBe('da-installare');
  });

  it('senza service worker attivo: non disponibili', async () => {
    sw.getRegistration.mockResolvedValue(undefined);
    const { statoPermessi } = await carica();
    expect(await statoPermessi()).toBe('non-disponibili');
  });

  it('permesso concesso e iscrizione presente: concessi', async () => {
    const { statoPermessi } = await carica();
    expect(await statoPermessi()).toBe('concessi');
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run tests/webAvvisi.test.ts`
Expected: FAIL con "Failed to resolve import '../src/web/avvisi'".

- [ ] **Step 3: Scrivi `src/web/avvisi.ts`**

```ts
import { pianificaAvvisi, type StatoPermessi } from '../core/avvisi';
import {
  CACHE_AVVISI,
  chiaveCache,
  chiaveDaBase64url,
  idAvviso,
  operazioniPush,
  statoPermessiWeb,
  type AvvisoPush,
  type Inviati,
  type TestoSalvato,
} from '../core/avvisiPush';
import { nuovoId } from '../core/id';
import { istanteDaMinuti } from '../core/sigaretta';
import { adessoRoma } from '../core/tempo';
import { store } from '../storage/store';
import { inizioSigarettaSalvato } from '../ui/inizioSigaretta';
import { inModalitaApp, piattaforma } from '../ui/installa';

/**
 * Avvisi della PWA: il browser non può programmare notifiche locali, quindi l'orario di ogni avviso
 * va al backend (Cloudflare Worker), che allo scadere manda una notifica web push. Il testo resta nel
 * browser (Cache), dove il service worker lo legge.
 */

export const URL_NOTIFICHE = 'https://krumiro-notifiche.oliosi-riccardo.workers.dev';
/** Chiave pubblica VAPID del backend (`VAPID_PUBLIC_KEY` in wrangler.jsonc): cambia solo con la coppia di chiavi. */
export const CHIAVE_VAPID = 'BDMM0_ITU0dc_OrEyil6M1IliUYEiKma7ANcCiK5CVxVIM8LxBWnycBd0NJG_PQpBTadDsQctWsx2z6dMzZb0iA';

/** Stato del dispositivo, come tema e banner: fuori dai dati e dal backup. */
const CHIAVE = 'timbrature-avvisi-push';
/** Il dispositivo entra nell'id dell'avviso: con "-sigaretta" deve restare entro i 64 caratteri del backend. */
const DISPOSITIVO_VALIDO = /^[A-Za-z0-9_-]{1,54}$/;

interface StatoPush {
  dispositivo: string;
  /** Endpoint dell'iscrizione con cui sono stati inviati gli avvisi. */
  endpoint: string | null;
  inviati: Inviati;
}

function leggiStato(): StatoPush {
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) ?? 'null') as Partial<StatoPush> | null;
    if (v && typeof v.dispositivo === 'string' && DISPOSITIVO_VALIDO.test(v.dispositivo) && typeof v.inviati === 'object' && v.inviati !== null) {
      return { dispositivo: v.dispositivo, endpoint: typeof v.endpoint === 'string' ? v.endpoint : null, inviati: v.inviati };
    }
  } catch {
    /* chiave illeggibile o memoria non disponibile */
  }
  // Gli avvisi rimasti sul server con il vecchio id scadono da soli entro 24 ore.
  return { dispositivo: nuovoId(), endpoint: null, inviati: {} };
}

function salvaStato(s: StatoPush): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(s));
  } catch {
    /* gli avvisi si rimandano alla prossima apertura */
  }
}

function supportato(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

const iosNonInstallata = () => piattaforma(navigator.userAgent, navigator.maxTouchPoints ?? 0) === 'ios' && !inModalitaApp();

/** La registrazione del service worker se è già attivo. Non aspetta: in sviluppo (`npm run dev`) non c'è. */
async function registrazioneAttiva(): Promise<ServiceWorkerRegistration | null> {
  if (!supportato()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg?.active ? reg : null;
}

/** Aspetta il service worker attivo al massimo 10 secondi (alla prima apertura si sta ancora installando). */
async function registrazionePronta(): Promise<ServiceWorkerRegistration | null> {
  if (!supportato()) return null;
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 10_000))]);
}

export async function statoPermessi(): Promise<StatoPermessi> {
  try {
    const reg = await registrazioneAttiva();
    return statoPermessiWeb({
      iosNonInstallata: iosNonInstallata(),
      supportato: reg !== null,
      permesso: reg ? Notification.permission : 'default',
      iscritto: reg ? (await reg.pushManager.getSubscription()) !== null : false,
    });
  } catch {
    return 'non-disponibili';
  }
}

/**
 * Chiede il permesso di mostrare notifiche e iscrive il browser al push con la chiave del backend,
 * poi programma gli avvisi. Va chiamata da un gesto dell'utente (Safari lo pretende).
 */
export async function richiediPermessi(): Promise<StatoPermessi> {
  try {
    if (iosNonInstallata() || !supportato()) return statoPermessi();
    if ((await Notification.requestPermission()) !== 'granted') return statoPermessi();
    const reg = await registrazionePronta();
    if (!reg) return 'non-disponibili';
    if (!(await reg.pushManager.getSubscription())) {
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiaveDaBase64url(CHIAVE_VAPID) });
    }
  } catch (e) {
    console.warn('Avvisi: iscrizione alle notifiche non riuscita', e);
  }
  await sincronizzaAvvisi();
  return statoPermessi();
}

/** Chiamata al backend; true se l'ha accettata. Nei log non finiscono endpoint né chiavi. */
async function chiama(metodo: 'PUT' | 'DELETE', id: string, corpo?: unknown): Promise<boolean> {
  try {
    const r = await fetch(`${URL_NOTIFICHE}/avvisi/${id}`, {
      method: metodo,
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    });
    if (r.ok) return true;
    console.warn(`Avvisi: ${metodo} rifiutato dal server (${r.status})`);
  } catch {
    console.warn(`Avvisi: ${metodo} non riuscito, server non raggiungibile`);
  }
  return false;
}

async function scriviTesto(scope: string, id: string, testo: TestoSalvato): Promise<void> {
  try {
    const cache = await caches.open(CACHE_AVVISI);
    await cache.put(chiaveCache(scope, id), new Response(JSON.stringify(testo), { headers: { 'Content-Type': 'application/json' } }));
  } catch {
    /* il service worker userà il testo generico */
  }
}

async function cancellaTesto(scope: string, id: string): Promise<void> {
  try {
    await (await caches.open(CACHE_AVVISI)).delete(chiaveCache(scope, id));
  } catch {
    /* voce già assente o Cache non disponibile */
  }
}

let coda: Promise<void> = Promise.resolve();

async function esegui(): Promise<void> {
  if (!supportato() || Notification.permission !== 'granted') return;
  const reg = await registrazioneAttiva();
  const iscrizione = reg ? await reg.pushManager.getSubscription() : null;
  if (!reg || !iscrizione) return; // all'avvio non ci si iscrive di nascosto: c'è il pulsante

  const ora = new Date();
  const { data, minuti } = adessoRoma(ora);
  const piano: AvvisoPush[] = pianificaAvvisi(store.giornata(data), store.impostazioni, { data, minuti }, {
    ora: ora.getTime(),
    inizioSigaretta: (eventoId) => inizioSigarettaSalvato(data, eventoId),
  }).map((a) => ({ tipo: a.tipo, orario: a.istante ?? istanteDaMinuti(a.minuti, ora), titolo: a.titolo, testo: a.testo }));

  const stato = leggiStato();
  const contatto = iscrizione.toJSON();
  let programmaFallito = false;
  for (const op of operazioniPush(piano, stato.inviati, { ora: ora.getTime(), endpointCambiato: stato.endpoint !== iscrizione.endpoint })) {
    if (op.azione === 'programma') {
      const { tipo, orario, titolo, testo } = op.avviso;
      const id = idAvviso(stato.dispositivo, tipo);
      const iso = new Date(orario).toISOString();
      if (await chiama('PUT', id, { contatto, orario: iso })) {
        stato.inviati[tipo] = { orario, titolo, testo };
        // Dopo il PUT riuscito: nella Cache non resta un testo che non corrisponde al server.
        await scriviTesto(reg.scope, id, { titolo, testo, orario: iso });
      } else {
        programmaFallito = true;
      }
    } else {
      const id = idAvviso(stato.dispositivo, op.tipo);
      if (op.azione === 'annulla' && !(await chiama('DELETE', id))) continue;
      delete stato.inviati[op.tipo];
      await cancellaTesto(reg.scope, id);
    }
    salvaStato(stato);
  }
  if (!programmaFallito) stato.endpoint = iscrizione.endpoint;
  salvaStato(stato);
}

/**
 * Allinea gli avvisi sul backend alle timbrature e alle impostazioni di oggi. Mai in parallelo.
 * Una chiamata fallita lascia l'avviso com'era nello stato salvato: la prossima sincronizzazione la ripete.
 */
export function sincronizzaAvvisi(): Promise<void> {
  coda = coda.then(esegui).catch((e: unknown) => {
    console.warn('Avvisi: sincronizzazione non riuscita', e);
  });
  return coda;
}

/** Sincronizza all'avvio, a ogni modifica dei dati, al ritorno in primo piano e quando torna la connessione. */
export function avviaAvvisi(): void {
  if (!supportato()) return;
  void sincronizzaAvvisi();
  store.ascolta(() => void sincronizzaAvvisi());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sincronizzaAvvisi();
  });
  window.addEventListener('online', () => void sincronizzaAvvisi());
}
```

- [ ] **Step 4: Esegui i test e il typecheck**

Run: `npx vitest run tests/webAvvisi.test.ts`
Expected: PASS (tutti i test).

Run: `npm test && npx tsc --noEmit`
Expected: tutti i test passano, nessun errore di tipo.

Se `tsc` segnala che `Uint8Array<ArrayBuffer>` non è assegnabile ad `applicationServerKey`, verifica di non aver cambiato il tipo restituito da `chiaveDaBase64url` (deve restare `Uint8Array<ArrayBuffer>`, non `Uint8Array`).

- [ ] **Step 5: Commit**

```bash
git add src/web/avvisi.ts tests/webAvvisi.test.ts
git commit -F - <<'EOF'
Avvisi PWA: iscrizione push e sincronizzazione con il backend

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Service worker nostro, con push e badge

**Files:**
- Create: `src/sw.ts`, `tsconfig.sw.json`, `public/icons/badge-96.png` (generato)
- Modify: `vite.config.ts:18-50` (blocco `VitePWA`)
- Modify: `tsconfig.json` (aggiunta di `exclude`)
- Modify: `package.json` (script `build`, `typecheck`, `build:android`; devDependencies), `package-lock.json`
- Modify: `scripts/genera-icone.mjs` (dopo la riga di `icon-maskable-512.png`)

**Interfaces:**
- Consumes (Task 1): `CACHE_AVVISI`, `chiaveCache(scope, id)`, `notificaDaPush(payload, salvato)` da `src/core/avvisiPush.ts`.
- Produces: `dist/sw.js` con precache, fallback di navigazione, `push` e `notificationclick`; `public/icons/badge-96.png`. `src/pwa.ts` resta invariato e continua a registrare il service worker con `virtual:pwa-register`.

- [ ] **Step 1: Installa il service worker vecchio nel browser (per la verifica dell'aggiornamento)**

Prima di toccare la configurazione:

Run: `npm run build && npx vite preview --port 5173`
Apri `http://localhost:5173/krumiro2.0/` in Chrome, aspetta il toast "App pronta per l'uso offline" e controlla in DevTools → Application → Service workers che `sw.js` sia attivo. Chiudi il server di preview (Ctrl+C) ma lascia la scheda aperta.

- [ ] **Step 2: Aggiungi le dipendenze Workbox**

Run: `npm install -D workbox-core@^7.4.1 workbox-precaching@^7.4.1 workbox-routing@^7.4.1`
Expected: `package.json` ha le tre voci in `devDependencies`; in `package-lock.json` restano alla 7.4.1 già usata da `vite-plugin-pwa`.

- [ ] **Step 3: Scrivi `src/sw.ts`**

```ts
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CACHE_AVVISI, chiaveCache, notificaDaPush } from './core/avvisiPush';

/** Service worker della PWA: app offline (precache) e notifiche degli avvisi (web push dal backend). */

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | PrecacheEntry)[] };

// Aggiornamento automatico (registerType 'autoUpdate'): la nuova versione prende subito il controllo.
void self.skipWaiting();
clientsClaim();

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// App a pagina singola: ogni navigazione riceve index.html dalla precache, anche offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

/** Il payload del push, o null se manca o non è JSON. */
function leggiPayload(evento: PushEvent): unknown {
  try {
    return evento.data?.json() ?? null;
  } catch {
    return null;
  }
}

/** Il testo lasciato dalla pagina per questo avviso, o null. */
async function testoSalvato(id: string): Promise<unknown> {
  try {
    const voce = await (await caches.open(CACHE_AVVISI)).match(chiaveCache(self.registration.scope, id));
    return voce ? await voce.json() : null;
  } catch {
    return null;
  }
}

self.addEventListener('push', (evento) => {
  const payload = leggiPayload(evento);
  const id = typeof payload === 'object' && payload !== null && 'id' in payload && typeof payload.id === 'string' ? payload.id : null;
  evento.waitUntil(
    (async () => {
      const n = notificaDaPush(payload, id ? await testoSalvato(id) : null);
      await self.registration.showNotification(n.titolo, {
        body: n.testo,
        tag: n.tag,
        icon: 'icons/icon-192.png',
        badge: 'icons/badge-96.png',
      });
      if (id) {
        await caches
          .open(CACHE_AVVISI)
          .then((c) => c.delete(chiaveCache(self.registration.scope, id)))
          .catch(() => undefined);
      }
    })(),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const finestre = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const app = finestre.find((c) => c.url.startsWith(self.registration.scope));
      if (app) await app.focus();
      else await self.clients.openWindow(self.registration.scope);
    })(),
  );
});
```

- [ ] **Step 4: Configura TypeScript per il service worker**

Crea `tsconfig.sw.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "WebWorker"],
    "types": [],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/sw.ts"]
}
```

In `tsconfig.json`, dopo la riga `"include": [...]`, aggiungi (con la virgola sulla riga precedente):

```json
  "exclude": ["src/sw.ts"]
```

In `package.json` sostituisci gli script `build`, `typecheck` e `build:android` con:

```json
    "build": "tsc --noEmit && tsc -p tsconfig.sw.json && vite build",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.sw.json",
    "build:android": "tsc --noEmit && tsc -p tsconfig.sw.json && vite build --mode android && cap sync android",
```

Run: `npm run typecheck`
Expected: nessun errore. Se `PrecacheEntry` non è esportato da `workbox-precaching`, sostituisci il tipo con `{ url: string; revision?: string | null }` e togli l'import.

- [ ] **Step 5: Passa a `injectManifest` in `vite.config.ts`**

Nel blocco `VitePWA({ ... })`:
- subito dopo `disable: android,` aggiungi:

```ts
        // Service worker nostro (src/sw.ts): precache come prima, più le notifiche degli avvisi.
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
```

- sostituisci tutto il blocco

```ts
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
          navigateFallback: `${BASE}index.html`,
          cleanupOutdatedCaches: true,
        },
```

con

```ts
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        },
```

(`navigateFallback` e `cleanupOutdatedCaches` ora sono in `src/sw.ts`.)

- [ ] **Step 6: Genera l'icona badge**

In `scripts/genera-icone.mjs`, subito dopo `writeFileSync('public/icons/icon-maskable-512.png', icona(512, 0.78));` aggiungi:

```js
// Badge delle notifiche (Android): conta solo la forma, Chrome usa il canale alfa. 96×96 come consiglia Chrome.
writeFileSync('public/icons/badge-96.png', primoPiano(96, 1.3));
```

Run: `npm run icone && git status --short public android`
Expected: l'unico file nuovo o cambiato è `public/icons/badge-96.png` (le altre icone si rigenerano identiche).

- [ ] **Step 7: Build e controllo del service worker generato**

Run: `npm test && npm run build`
Expected: test e build senza errori; vite-plugin-pwa scrive `dist/sw.js`.

Run: `grep -c "__WB_MANIFEST" dist/sw.js; grep -o "badge-96.png" dist/sw.js | head -2; grep -o "notificationclick" dist/sw.js | head -1`
Expected: `0` (il manifest è stato iniettato), `badge-96.png` presente due volte (voce di precache e opzione della notifica), `notificationclick` presente.

- [ ] **Step 8: Verifica nel browser — aggiornamento, offline, push simulato**

Run: `npx vite preview --port 5173`

1. **Aggiornamento dal service worker vecchio:** nella scheda lasciata aperta allo Step 1, ricarica. In DevTools → Application → Service workers il nuovo `sw.js` diventa attivo da solo (niente "waiting to activate"); l'app si apre normalmente.
2. **Offline:** DevTools → Network → Offline, ricarica: l'app si apre e funziona. Torna Online.
3. **Push simulato:** concedi le notifiche al sito (icona a sinistra dell'indirizzo → Notifiche → Consenti). In DevTools → Application → Service workers, nel campo *Push* incolla
   `{"tipo":"fine-pausa","id":"prova-pausa","orario":"2026-10-05T10:00:00.000Z","titolo":"Pausa finita","testo":"È ora di timbrare il rientro"}`
   e premi *Push*: compare "Fine pausa pranzo / È ora di rientrare." (testo generico, perché non c'è testo salvato). Cliccandola, la scheda dell'app torna in primo piano.
4. Con `ciao` (non JSON) nel campo *Push*: compare "Krumiro / Apri l'app per i dettagli.".

- [ ] **Step 9: Commit**

```bash
git add src/sw.ts tsconfig.sw.json tsconfig.json vite.config.ts package.json package-lock.json scripts/genera-icone.mjs public/icons/badge-96.png
git commit -F - <<'EOF'
Avvisi PWA: service worker con injectManifest, notifiche push e badge

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Avvio nella PWA e sezione Avvisi delle Impostazioni

**Files:**
- Modify: `src/main.ts:14-15` (import) e `:121-127` (avvio)
- Modify: `src/ui/impostazioni.ts:12-14` (import), `:55-92` (`TESTO_PERMESSI` e `sezioneAvvisi`)

**Interfaces:**
- Consumes: `statoPermessi()`, `richiediPermessi()`, `avviaAvvisi()` da `src/web/avvisi.ts` (Task 2) e da `src/native/avvisi.ts` (esistenti, stessa forma); `StatoPermessi` da `src/core/avvisi.ts` (Task 1); `linkAiuto(testo, destinazione)` da `src/ui/aiuto.ts`.
- Produces: nessuna API nuova.

- [ ] **Step 1: Avvia gli avvisi nella PWA (`src/main.ts`)**

Sostituisci

```ts
import { avviaAvvisi } from './native/avvisi';
```

con

```ts
import { avviaAvvisi as avviaAvvisiApp } from './native/avvisi';
import { avviaAvvisi as avviaAvvisiPwa } from './web/avvisi';
```

e il blocco finale

```ts
if (inApp()) {
  // App Android: niente service worker né invito a installare; le notifiche sono locali.
  avviaAvvisi();
} else {
  registraServiceWorker();
  avviaBannerInstallazione(() => apriAiuto('installazione'));
}
```

con

```ts
if (inApp()) {
  // App Android: niente service worker né invito a installare; le notifiche sono locali.
  avviaAvvisiApp();
} else {
  registraServiceWorker();
  // PWA: gli avvisi passano dal backend e arrivano come notifiche push.
  avviaAvvisiPwa();
  avviaBannerInstallazione(() => apriAiuto('installazione'));
}
```

- [ ] **Step 2: Sezione Avvisi per piattaforma (`src/ui/impostazioni.ts`)**

Sostituisci gli import

```ts
import { richiediPermessi, statoPermessi } from '../native/avvisi';
import type { StatoPermessi } from '../core/avvisi';
```

con

```ts
import * as avvisiApp from '../native/avvisi';
import * as avvisiPwa from '../web/avvisi';
import type { StatoPermessi } from '../core/avvisi';
```

Sostituisci la costante `TESTO_PERMESSI` e la funzione `sezioneAvvisi` (fino alla riga di `linkAiuto('Come funzionano gli avvisi?', 'avvisi')` e alla chiusura della funzione) con:

```ts
const TESTO_PERMESSI_APP: Record<StatoPermessi, string> = {
  concessi: 'Notifiche autorizzate.',
  negati: 'Notifiche bloccate: abilitale dalle impostazioni di Android (App → Krumiro → Notifiche).',
  'da-chiedere': 'Per ricevere gli avvisi serve il permesso di mostrare notifiche.',
  'da-installare': 'Per ricevere gli avvisi serve il permesso di mostrare notifiche.', // solo PWA: qui non capita
  'non-disponibili': 'Avvisi non disponibili su questo telefono.',
};

const TESTO_PERMESSI_PWA: Record<StatoPermessi, string> = {
  concessi: 'Notifiche autorizzate. Gli avvisi arrivano tramite internet, con fino a un minuto di ritardo.',
  'da-chiedere': 'Per ricevere gli avvisi serve il permesso di mostrare notifiche.',
  negati: 'Notifiche bloccate: abilitale nelle impostazioni del browser per questo sito.',
  'da-installare': 'Su iPhone gli avvisi arrivano solo con l\'app aggiunta alla schermata Home.',
  'non-disponibili': 'Questo browser non supporta le notifiche push.',
};

/** Sezione Avvisi: scelta degli avvisi, durata del pranzo e stato dei permessi (app Android o PWA). */
function sezioneAvvisi(): HTMLElement {
  const avvisi = store.impostazioni.avvisi;
  const nativa = inApp();
  const piattaforma = nativa ? avvisiApp : avvisiPwa;
  const testi = nativa ? TESTO_PERMESSI_APP : TESTO_PERMESSI_PWA;
  const stato = el('small', { class: 'nota' }, 'Controllo dei permessi…');
  const pulsante = el('button', { type: 'button', class: 'btn btn-secondario', hidden: true }, 'Autorizza gli avvisi');
  const comeInstallare = linkAiuto('Come installo l\'app sull\'iPhone?', 'installazione');
  comeInstallare.hidden = true;
  const mostra = (s: StatoPermessi) => {
    stato.textContent = testi[s];
    // Nell'app Android si può richiedere anche dopo un rifiuto; nel browser un rifiuto è definitivo.
    pulsante.hidden = nativa ? s === 'concessi' || s === 'non-disponibili' : s !== 'da-chiedere';
    comeInstallare.hidden = s !== 'da-installare';
  };
  void piattaforma.statoPermessi().then(mostra);
  pulsante.addEventListener('click', () => void piattaforma.richiediPermessi().then(mostra));
  const cambia = (modifica: (a: typeof avvisi) => void) => {
    store.modificaImpostazioni((i) => modifica(i.avvisi));
    salvato();
  };
  return el(
    'div',
    { class: 'scheda' },
    el('h2', { class: 'titolo-sezione' }, 'Avvisi'),
    stato,
    pulsante,
    comeInstallare,
    riga('Uscita prevista', interruttore(avvisi.uscita, (v) => cambia((a) => void (a.uscita = v)), 'Avviso di uscita prevista'), 'quando puoi andare via'),
    riga('Rientro dal pranzo', interruttore(avvisi.pranzo, (v) => cambia((a) => void (a.pranzo = v)), 'Avviso di rientro dalla pausa pranzo'), 'dopo la durata qui sotto'),
    riga('Durata del pranzo (min)', inputMinuti(avvisi.pranzoMinuti, (v) => cambia((a) => void (a.pranzoMinuti = v)), 'Durata della pausa pranzo in minuti', 240, 5, 1), 'di quanto avvisare dopo l\'inizio della pausa'),
    riga('Rientro dalla sigaretta', interruttore(avvisi.sigaretta, (v) => cambia((a) => void (a.sigaretta = v)), 'Avviso di rientro dalla pausa sigaretta'), 'prima della fine della tolleranza, vedi sotto'),
    riga('Anticipo sigaretta (min)', inputMinuti(avvisi.sigarettaAnticipo, (v) => cambia((a) => void (a.sigarettaAnticipo = v)), 'Anticipo dell\'avviso della pausa sigaretta in minuti', 30, 1), '0 = allo scadere della tolleranza'),
    linkAiuto('Come funzionano gli avvisi?', 'avvisi'),
  );
}
```

- [ ] **Step 3: Test, typecheck e build**

Run: `npm test && npm run build`
Expected: tutti i test passano, typecheck e build senza errori.

- [ ] **Step 4: Verifica nel browser**

1. `npm run dev`, apri `http://localhost:5173/krumiro2.0/` → *Impostazioni → Avvisi*: "Questo browser non supporta le notifiche push." (in sviluppo il service worker non c'è), nessun pulsante. Chiudi il server.
2. `npx vite preview --port 5173` in una finestra in incognito di Chrome → *Impostazioni → Avvisi*: "Per ricevere gli avvisi serve il permesso…" con il pulsante *Autorizza gli avvisi*.
3. Tocca il pulsante e concedi: la nota diventa "Notifiche autorizzate. Gli avvisi arrivano tramite internet…", il pulsante sparisce.
4. *Oggi* → timbra l'entrata: in DevTools → Network compare `PUT …/avvisi/<id>-uscita` con risposta `204`. In DevTools → Application → Cache storage → `krumiro-avvisi` c'è la voce `avvisi/<id>-uscita`.
5. DevTools → icona dei dispositivi → *iPhone 12 Pro*, ricarica → *Impostazioni → Avvisi*: "Su iPhone gli avvisi arrivano solo con l'app aggiunta alla schermata Home." e il link *Come installo l'app sull'iPhone?*, che apre l'Aiuto sull'installazione.
6. Annulla la timbratura (o cancellala dalla giornata) per non lasciare l'avviso in sospeso: nel Network compare `DELETE …/avvisi/<id>-uscita` → `204`.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/ui/impostazioni.ts
git commit -F - <<'EOF'
Avvisi PWA: avvio nella PWA e sezione Avvisi per piattaforma

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Aiuto e README

**Files:**
- Modify: `src/ui/aiutoTesti.ts:311-336` (voci `avvisi` e `avvisi-non-arrivano`), `:362-373` (voce `installazione-app`)
- Modify: `README.md` (sezioni "App Android con gli avvisi", "Sviluppo" → struttura, "App Android")
- Test: `tests/aiuto.test.ts`

**Interfaces:**
- Consumes: `vociAiuto(imp)` da `src/ui/aiutoTesti.ts`; variabili locali già presenti in `vociAiuto`: `pranzoAvviso`, `tolleranza`, `imp`.
- Produces: nessuna API nuova.

- [ ] **Step 1: Scrivi il test che fallisce**

In `tests/aiuto.test.ts`, dentro `describe('aiuto', …)`, aggiungi:

```ts
  it('gli avvisi spiegano anche la PWA', () => {
    const avvisi = voci.find((x) => x.id === 'avvisi')!.testo.join(' ');
    expect(avvisi).toContain('PWA');
    expect(avvisi).toContain('schermata Home');
    expect(avvisi).not.toContain('non sono disponibili');
    const problemi = voci.find((x) => x.id === 'avvisi-non-arrivano')!.testo.join(' ');
    expect(problemi).toContain('internet');
    expect(problemi).toContain('Sveglie e promemoria');
  });
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run tests/aiuto.test.ts`
Expected: FAIL su "gli avvisi spiegano anche la PWA" (il testo contiene ancora "non sono disponibili").

- [ ] **Step 3: Aggiorna i testi dell'Aiuto**

In `src/ui/aiutoTesti.ts` sostituisci il `testo` della voce `avvisi` con:

```ts
      testo: [
        'Ricevi una notifica, anche ad app chiusa, in tre momenti:',
        '• Uscita prevista: quando puoi andare via. Si programma mentre sei al lavoro e si aggiorna se modifichi le timbrature.',
        `• Rientro dal pranzo: ${pranzoAvviso} dopo l'inizio della pausa. La durata si cambia in Impostazioni → Avvisi.`,
        imp.avvisi.sigarettaAnticipo > 0
          ? `• Pausa sigaretta: ${formattaDurata(imp.avvisi.sigarettaAnticipo)} prima della fine della tolleranza (${tolleranza}), per rientrare prima che diventi permesso. L'anticipo si cambia in Impostazioni → Avvisi.`
          : `• Pausa sigaretta: allo scadere della tolleranza (${tolleranza}). Puoi anticiparlo in Impostazioni → Avvisi.`,
        'Ogni avviso si può disattivare dalle Impostazioni. Nessun avviso se la giornata è chiusa, da correggere o se l\'orario è già passato. Per riceverli tocca "Autorizza gli avvisi" in Impostazioni → Avvisi.',
        'Nell\'app per Android gli avvisi sono programmati sul telefono: non serve connessione e nessun dato esce dal dispositivo.',
        'Nella PWA (Chrome, Safari, Firefox) l\'orario di ogni avviso va a un server che invia la notifica al momento giusto: quando timbri serve internet e l\'avviso può arrivare con un minuto di ritardo. Su iPhone funziona solo con l\'app aggiunta alla schermata Home (iOS 16.4 o successivi). Al server arrivano solo l\'orario e l\'indirizzo per le notifiche del browser: niente timbrature né testi.',
      ],
```

Sostituisci il `testo` della voce `avvisi-non-arrivano` con:

```ts
      testo: [
        '• Controlla in Impostazioni → Avvisi che le notifiche siano autorizzate; se serve tocca "Autorizza gli avvisi".',
        '• Se hai attivato "Non disturbare" o una modalità Focus, le notifiche vengono silenziate.',
        'Nell\'app per Android:',
        '• Su Android 12 e successivi concedi anche "Sveglie e promemoria" all\'app: senza, gli avvisi possono ritardare di qualche minuto.',
        '• Nelle impostazioni di Android (App → Krumiro) togli le limitazioni della batteria: alcune marche (Xiaomi, Huawei, Samsung in risparmio energetico) bloccano le notifiche delle app chiuse.',
        'Nella PWA:',
        '• Quando timbri serve internet: se manca, l\'avviso viene programmato appena torni online con l\'app aperta.',
        '• Le notifiche del sito devono essere permesse nel browser (in Chrome: icona a sinistra dell\'indirizzo → Notifiche).',
        '• Su iPhone apri l\'app dall\'icona sulla schermata Home, non da Safari.',
      ],
```

Nella voce `installazione-app`, dopo la riga `'• Alla prima apertura autorizza le notifiche (Impostazioni → Avvisi → Autorizza gli avvisi).',` aggiungi:

```ts
        'Rispetto alla PWA, nell\'app gli avvisi funzionano anche senza internet e senza passare da un server.',
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run tests/aiuto.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Aggiorna il README**

1. Nella sezione `### App Android con gli avvisi`, sostituisci la frase
   `Ogni avviso si attiva o disattiva in *Impostazioni → Avvisi*. Le notifiche sono programmate sul telefono: nessun server, nessun dato fuori dal dispositivo. Nella PWA gli avvisi non esistono.`
   con
   `Ogni avviso si attiva o disattiva in *Impostazioni → Avvisi*. Le notifiche sono programmate sul telefono: nessun server, nessun dato fuori dal dispositivo. Anche la PWA ha gli stessi avvisi, ma passano da un server (vedi *Avvisi nella PWA*).`

2. Subito prima di `### App Android con gli avvisi` aggiungi:

```markdown
### Avvisi nella PWA

La PWA ha gli stessi tre avvisi dell'app Android (uscita prevista, rientro dal pranzo, rientro dalla
sigaretta) come **notifiche push**. Si attivano in *Impostazioni → Avvisi → Autorizza gli avvisi*.

- Il browser non può programmare notifiche da solo: a ogni timbratura la PWA invia l'orario
  dell'avviso a un piccolo server (Cloudflare Worker, repository `krumiro2.0_backend`), che allo
  scadere manda la notifica. Al server arrivano solo l'orario e l'indirizzo per le notifiche del
  browser; timbrature e testi restano sul dispositivo.
- Serve internet quando si timbra (senza, l'avviso parte appena si torna online con l'app aperta);
  la notifica arriva con al massimo circa un minuto di ritardo.
- Su iPhone funziona solo con l'app aggiunta alla schermata Home (iOS 16.4 o successivi).
- Funziona su Chrome, Edge, Samsung Internet, Firefox e Safari; l'app Android resta l'unica che
  avvisa anche senza connessione.
```

3. Nel blocco `Struttura:` della sezione `## Sviluppo` aggiungi, dopo la riga di `src/storage/`:

```
src/native/    avvisi dell'app Android (notifiche locali con Capacitor)
src/web/       avvisi della PWA (iscrizione push e chiamate al backend)
src/sw.ts      service worker della PWA: app offline e notifiche push
```

4. Alla fine della sezione `## Sviluppo`, prima di `### Deploy su GitHub Pages`, aggiungi:

~~~markdown
### Avvisi della PWA (sviluppo)

URL del backend e chiave pubblica VAPID sono costanti in `src/web/avvisi.ts` (`URL_NOTIFICHE`,
`CHIAVE_VAPID`); se il backend cambia la coppia di chiavi, la chiave va aggiornata e gli utenti devono
autorizzare di nuovo gli avvisi. La logica pura (operazioni verso il backend, testo della notifica) è in
`src/core/avvisiPush.ts`, con test. Il service worker è scritto a mano (`src/sw.ts`, strategia
`injectManifest` di vite-plugin-pwa) e si controlla con `tsconfig.sw.json`.

Con `npm run dev` il service worker non c'è e gli avvisi risultano "non disponibili". Per provarli:

```bash
npm run build
npx vite preview --port 5173   # il backend accetta richieste solo da questa porta e da GitHub Pages
```

Poi apri `http://localhost:5173/krumiro2.0/`, autorizza gli avvisi e timbra. In Chrome, DevTools →
Application → Service workers → *Push* simula un push senza passare dal backend.
~~~

- [ ] **Step 6: Commit**

```bash
git add src/ui/aiutoTesti.ts tests/aiuto.test.ts README.md
git commit -F - <<'EOF'
Avvisi PWA: Aiuto e README

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Verifica finale e prova reale con il backend

**Files:** nessuna modifica prevista (solo correzioni se la prova trova problemi).

**Interfaces:**
- Consumes: tutto quanto sopra; backend in produzione su `https://krumiro-notifiche.oliosi-riccardo.workers.dev`.
- Produces: branch pronto per la PR verso `develop`.

- [ ] **Step 1: Test, typecheck e build completi**

Run: `npm test && npm run typecheck && npm run build`
Expected: tutto verde.

- [ ] **Step 2: Build Android invariata**

Run: `npx vite build --mode android && ls dist`
Expected: build senza errori; in `dist/` **non** c'è `sw.js` (il service worker è disabilitato per Android).
Poi rifai la build web per non lasciare in `dist/` quella Android: `npm run build`.

- [ ] **Step 3: Prova reale con il backend (Chrome sul computer)**

Run: `npx vite preview --port 5173`

1. Apri `http://localhost:5173/krumiro2.0/` (finestra normale, non incognito: in incognito Chrome può bloccare il push), *Impostazioni → Avvisi → Autorizza gli avvisi*, concedi.
2. *Impostazioni → Avvisi*: durata del pranzo **1** min.
3. *Oggi*: timbra entrata e inizio pausa. In Network: `PUT …-pausa` → `204`.
4. Entro circa due minuti arriva la notifica **"Fine pausa pranzo" / "Sono passati 1 min: è ora di rientrare."** (il testo salvato, non quello generico), con l'orologio come icona. Cliccandola si apre l'app.
5. Durata del pranzo **5** min, timbra rientro e poi un nuovo inizio pausa, quindi il rientro dopo un minuto: in Network `DELETE …-pausa` → `204` e nessuna notifica nei 5 minuti successivi.
6. Rimetti la durata del pranzo al valore di prima.

- [ ] **Step 4: Prova sui telefoni (dopo il merge e il deploy su GitHub Pages)**

Da fare dopo la pubblicazione, perché il backend accetta solo `https://ricky79.github.io` e `localhost:5173`:
- Android/Chrome: PWA installata, stessa prova dello Step 3; la notifica mostra il badge (orologio) nella barra di stato.
- iPhone (iOS 16.4+): in Safari *Impostazioni → Avvisi* dice di aggiungere l'app alla Home; dall'icona sulla Home si autorizzano gli avvisi e la prova dello Step 3 funziona.

- [ ] **Step 5: Chiusura del branch**

Usa la skill `superpowers:finishing-a-development-branch` per decidere come integrare `feature/avvisi-pwa` (PR verso `develop`, come per le feature precedenti).
