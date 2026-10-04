import { NOMI_GIORNI } from '../core/tempo';
import { selettoreOra } from './campi';
import { IMPOSTAZIONI_PREDEFINITE, type TipoSigaretta } from '../core/tipi';
import { clonaImpostazioni } from '../storage/migrazioni';
import { store } from '../storage/store';
import { conferma, toast } from './dialoghi';
import { el } from './dom';
import { linkAiuto } from './aiuto';
import { esportaBackupJson, esportaCsvCondividi, importaFile } from './dati';
import type { Adesso } from './giorno';
import { impostaPreferenza, preferenzaTema, type PreferenzaTema } from './tema';
import { inApp } from '../native/app';
import { richiediPermessi, statoPermessi, type StatoPermessi } from '../native/avvisi';

/** Lunedì → domenica, come in un calendario italiano. */
const ORDINE_GIORNI = [1, 2, 3, 4, 5, 6, 0];

/** Selettore "ore:minuti" 24h (usato anche per le durate). */
function inputHHMM(minuti: number, onCambio: (v: number) => void, aria: string): HTMLElement {
  return selettoreOra(minuti, { aria, onChange: onCambio }).elemento;
}

function inputMinuti(valore: number, onCambio: (v: number) => void, aria: string, max = 600, step = 5, min = 0): HTMLInputElement {
  const i = el('input', { type: 'number', inputmode: 'numeric', min, max, step, value: String(valore), 'aria-label': aria });
  i.addEventListener('change', () => {
    const v = Math.round(Number(i.value));
    if (!Number.isFinite(v) || v < min || v > max) {
      i.value = String(valore);
      return;
    }
    valore = v;
    onCambio(v);
  });
  return i;
}

function riga(etichetta: string, controllo: HTMLElement, nota?: string): HTMLElement {
  return el(
    'div',
    { class: 'riga-impostazione' },
    el('div', {}, el('span', { class: 'riga-etichetta' }, etichetta), nota ? el('small', {}, nota) : null),
    controllo,
  );
}

const salvato = () => toast('Impostazioni salvate');

/** Casella di spunta delle impostazioni. */
function interruttore(valore: boolean, onCambio: (v: boolean) => void, aria: string): HTMLInputElement {
  const i = el('input', { type: 'checkbox', checked: valore, 'aria-label': aria, class: 'interruttore' });
  i.addEventListener('change', () => onCambio(i.checked));
  return i;
}

const TESTO_PERMESSI: Record<StatoPermessi, string> = {
  concessi: 'Notifiche autorizzate.',
  negati: 'Notifiche bloccate: abilitale dalle impostazioni di Android (App → Krumiro → Notifiche).',
  'da-chiedere': 'Per ricevere gli avvisi serve il permesso di mostrare notifiche.',
  'non-disponibili': 'Gli avvisi funzionano solo nell\'app per Android: nel browser e nella PWA non sono disponibili.',
};

/** Sezione Avvisi: scelta degli avvisi, durata del pranzo e stato dei permessi del telefono. */
function sezioneAvvisi(): HTMLElement {
  const avvisi = store.impostazioni.avvisi;
  const nativa = inApp();
  const stato = el('small', { class: 'nota' }, nativa ? 'Controllo dei permessi…' : TESTO_PERMESSI['non-disponibili']);
  const pulsante = el('button', { type: 'button', class: 'btn btn-secondario', hidden: true }, 'Autorizza gli avvisi');
  const mostra = (s: StatoPermessi) => {
    stato.textContent = TESTO_PERMESSI[s];
    pulsante.hidden = s === 'concessi' || s === 'non-disponibili';
  };
  if (nativa) {
    void statoPermessi().then(mostra);
    pulsante.addEventListener('click', () => void richiediPermessi().then(mostra));
  }
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
    riga('Uscita prevista', interruttore(avvisi.uscita, (v) => cambia((a) => void (a.uscita = v)), 'Avviso di uscita prevista'), 'quando puoi andare via'),
    riga('Rientro dal pranzo', interruttore(avvisi.pranzo, (v) => cambia((a) => void (a.pranzo = v)), 'Avviso di rientro dalla pausa pranzo'), 'dopo la durata qui sotto'),
    riga('Durata del pranzo (min)', inputMinuti(avvisi.pranzoMinuti, (v) => cambia((a) => void (a.pranzoMinuti = v)), 'Durata della pausa pranzo in minuti', 240, 5, 1), 'di quanto avvisare dopo l\'inizio della pausa'),
    riga('Rientro dalla sigaretta', interruttore(avvisi.sigaretta, (v) => cambia((a) => void (a.sigaretta = v)), 'Avviso di rientro dalla pausa sigaretta'), 'prima della fine della tolleranza, vedi sotto'),
    riga('Anticipo sigaretta (min)', inputMinuti(avvisi.sigarettaAnticipo, (v) => cambia((a) => void (a.sigarettaAnticipo = v)), 'Anticipo dell\'avviso della pausa sigaretta in minuti', 30, 1), '0 = allo scadere della tolleranza'),
    linkAiuto('Come funzionano gli avvisi?', 'avvisi'),
  );
}

const OPZIONI_TEMA: [PreferenzaTema, string][] = [
  ['auto', 'Automatico'],
  ['chiaro', 'Chiaro'],
  ['scuro', 'Scuro'],
];

/** Pulsanti Automatico / Chiaro / Scuro: il tema cambia subito, senza ridisegnare la vista. */
function selettoreTema(): HTMLElement {
  const pulsanti = OPZIONI_TEMA.map(([valore, testo]) =>
    el(
      'button',
      {
        type: 'button',
        class: 'chip',
        'aria-pressed': String(preferenzaTema() === valore),
        onclick: () => {
          impostaPreferenza(valore);
          pulsanti.forEach((b, i) => b.setAttribute('aria-pressed', String(OPZIONI_TEMA[i]![0] === valore)));
        },
      },
      testo,
    ),
  );
  return el('div', { class: 'preset', role: 'group', 'aria-label': 'Tema' }, pulsanti);
}

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

export function vistaImpostazioni(adesso: Adesso): HTMLElement {
  const imp = store.impostazioni;

  const righeGiorni = ORDINE_GIORNI.map((g) => {
    const valore = imp.minutiDovuti.perGiorno[g] ?? null;
    const usaPredefinito = el('input', { type: 'checkbox', checked: valore === null, 'aria-label': `${NOMI_GIORNI[g]}: usa le ore predefinite` });
    const ore = selettoreOra(valore ?? imp.minutiDovuti.predefinito, {
      aria: `Ore dovute ${NOMI_GIORNI[g]}`,
      onChange: (v) => {
        store.modificaImpostazioni((i) => void (i.minutiDovuti.perGiorno[g] = v));
        salvato();
      },
    });
    ore.abilita(valore !== null);
    usaPredefinito.addEventListener('change', () => {
      store.modificaImpostazioni((i) => {
        i.minutiDovuti.perGiorno[g] = usaPredefinito.checked ? null : ore.leggi();
      });
      salvato();
    });
    return el(
      'div',
      { class: 'riga-impostazione riga-giorno' },
      el('span', { class: 'riga-etichetta' }, NOMI_GIORNI[g]!),
      el('label', { class: 'campo-check piccolo' }, usaPredefinito, ' predefinito'),
      ore.elemento,
    );
  });

  const fileInput = el('input', { type: 'file', accept: '.csv,.json,text/csv,application/json', hidden: true });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) void importaFile(f);
  });

  return el(
    'section',
    { class: 'vista' },
    el('header', { class: 'intestazione' }, el('h1', {}, 'Impostazioni'), linkAiuto('Come vengono usati questi valori?', 'come-si-calcola')),
    el(
      'div',
      { class: 'scheda' },
      el('h2', { class: 'titolo-sezione' }, 'Ore dovute'),
      riga(
        'Predefinite',
        inputHHMM(imp.minutiDovuti.predefinito, (v) => {
          store.modificaImpostazioni((i) => void (i.minutiDovuti.predefinito = v));
          salvato();
        }, 'Ore dovute predefinite'),
        'ore:minuti al giorno',
      ),
      el('p', { class: 'nota' }, 'Per giorno della settimana (togli "predefinito" per un valore diverso, 00:00 = giorno libero):'),
      righeGiorni,
    ),
    el(
      'div',
      { class: 'scheda' },
      el('h2', { class: 'titolo-sezione' }, 'Pausa pranzo'),
      riga('Inizio fascia pranzo', inputHHMM(imp.pranzo.inizio, (v) => {
        if (v >= store.impostazioni.pranzo.fine) return void toast('L\'inizio deve precedere la fine');
        store.modificaImpostazioni((i) => void (i.pranzo.inizio = v));
        salvato();
      }, 'Inizio fascia pranzo')),
      riga('Fine fascia pranzo', inputHHMM(imp.pranzo.fine, (v) => {
        if (v <= store.impostazioni.pranzo.inizio) return void toast('La fine deve seguire l\'inizio');
        store.modificaImpostazioni((i) => void (i.pranzo.fine = v));
        salvato();
      }, 'Fine fascia pranzo')),
      riga('Pausa da scalare (min)', inputMinuti(imp.pausaDaScalare, (v) => {
        store.modificaImpostazioni((i) => void (i.pausaDaScalare = v));
        salvato();
      }, 'Pausa da scalare in minuti'), 'se un permesso copre la fascia pranzo senza pausa registrata'),
      riga('Pausa minima (min)', inputMinuti(imp.pausaMinima, (v) => {
        store.modificaImpostazioni((i) => void (i.pausaMinima = v));
        salvato();
      }, 'Pausa minima in minuti'), 'una pausa più breve conta come questa durata'),
    ),
    el(
      'div',
      { class: 'scheda' },
      el('h2', { class: 'titolo-sezione' }, 'Pausa sigaretta'),
      riga('Tipo', selettoreSigaretta(imp.tipoSigaretta)),
      riga('Tolleranza (min)', inputMinuti(imp.tolleranzaSigaretta, (v) => {
        store.modificaImpostazioni((i) => void (i.tolleranzaSigaretta = v));
        salvato();
      }, 'Tolleranza della pausa sigaretta in minuti', 60, 1), 'entro questo tempo la pausa non viene conteggiata'),
      linkAiuto('Come funziona la pausa sigaretta?', 'pausa-sigaretta'),
    ),
    sezioneAvvisi(),
    el(
      'div',
      { class: 'scheda' },
      el('h2', { class: 'titolo-sezione' }, 'Conteggio'),
      riga('Inizio conteggio', inputHHMM(imp.orarioMinimoConteggio, (v) => {
        store.modificaImpostazioni((i) => void (i.orarioMinimoConteggio = v));
        salvato();
      }, 'Orario di inizio conteggio'), 'le timbrature precedenti contano da quest\'ora'),
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-secondario',
          onclick: async () => {
            if (await conferma('Ripristinare le impostazioni?', 'Tornano i valori predefiniti (8h lun–ven, pranzo 12:00–14:30, 60 min da scalare, tolleranza sigaretta 11 min, sigaretta normale, avvisi attivi con pranzo da 30 min e sigaretta 1 min prima). Le timbrature non vengono toccate.', 'Ripristina', true)) {
              store.modificaImpostazioni((i) => Object.assign(i, clonaImpostazioni(IMPOSTAZIONI_PREDEFINITE)));
              salvato();
            }
          },
        },
        'Ripristina valori predefiniti',
      ),
    ),
    el(
      'div',
      { class: 'scheda' },
      el('h2', { class: 'titolo-sezione' }, 'Aspetto'),
      selettoreTema(),
      el('p', { class: 'nota' }, 'Automatico segue il tema chiaro o scuro del telefono.'),
    ),
    el(
      'div',
      { class: 'scheda' },
      el('h2', { class: 'titolo-sezione' }, 'Dati e backup'),
      el('p', { class: 'nota' }, 'I dati restano solo su questo iPhone. Esporta un backup ogni tanto.'),
      el(
        'div',
        { class: 'pila-pulsanti' },
        el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void esportaCsvCondividi(adesso) }, 'Esporta CSV (Excel)'),
        el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void esportaBackupJson(adesso) }, 'Esporta backup completo (JSON)'),
        el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => fileInput.click() }, 'Importa CSV o backup JSON…'),
        fileInput,
      ),
    ),
    el('p', { class: 'versione' }, `Krumiro v${__VERSIONE_APP__}`),
  );
}
