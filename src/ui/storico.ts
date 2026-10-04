import { riepilogoMese } from '../core/riepilogo';
import { statoLeggibile } from '../core/testi';
import { formattaDataBreve, formattaDurata, formattaSaldo, nomeMese, spostaMese } from '../core/tempo';
import { store } from '../storage/store';
import { apriFoglio } from './dialoghi';
import { el } from './dom';
import type { Adesso } from './giorno';
import { esportaCsvCondividi } from './dati';

export function vistaStorico(mese: string, adesso: Adesso, cambiaMese: (m: string) => void, apriGiorno: (data: string) => void): HTMLElement {
  const rm = riepilogoMese(store.giornate, store.impostazioni, mese, adesso);
  const meseCorrente = adesso.data.slice(0, 7);

  return el(
    'section',
    { class: 'vista' },
    el('header', { class: 'intestazione' }, el('h1', {}, 'Storico')),
    el(
      'div',
      { class: 'selettore-mese' },
      el('button', { type: 'button', class: 'btn-tondo', 'aria-label': 'Mese precedente', onclick: () => cambiaMese(spostaMese(mese, -1)) }, '‹'),
      el('h2', {}, nomeMese(mese)),
      el(
        'button',
        { type: 'button', class: 'btn-tondo', 'aria-label': 'Mese successivo', disabled: mese >= meseCorrente, onclick: () => cambiaMese(spostaMese(mese, 1)) },
        '›',
      ),
    ),
    el(
      'div',
      { class: 'scheda' },
      el('h2', { class: 'titolo-sezione' }, 'Riepilogo del mese'),
      el(
        'dl',
        { class: 'statistiche tre' },
        stat('Lavoro', formattaDurata(rm.lavoro)),
        stat('Straordinario', formattaDurata(rm.straordinario), rm.straordinario > 0 ? 'positivo' : ''),
        stat('Permesso', formattaDurata(rm.permesso)),
      ),
      el(
        'p',
        { class: 'nota' },
        `${rm.giorni.length} ${rm.giorni.length === 1 ? 'giorno registrato' : 'giorni registrati'} · saldo esatto del mese `,
        el('strong', { class: rm.saldo > 0 ? 'positivo' : rm.saldo < 0 ? 'negativo' : '' }, formattaSaldo(rm.saldo)),
      ),
      rm.giorniDaCorreggere > 0
        ? el('p', { class: 'nota negativo' }, `⚠︎ ${rm.giorniDaCorreggere} ${rm.giorniDaCorreggere === 1 ? 'giornata da correggere' : 'giornate da correggere'}`)
        : null,
    ),
    el(
      'div',
      { class: 'scheda' },
      rm.giorni.length === 0
        ? el('p', { class: 'vuoto' }, 'Nessuna giornata registrata in questo mese.')
        : el(
            'ul',
            { class: 'elenco-giorni' },
            rm.giorni.map(({ data, risultato: r, ore }) => {
              const inCorso = data === adesso.data && r.stato !== 'CHIUSA';
              const mancano = !inCorso && !r.daCorreggere && r.saldo < 0 ? -r.saldo : 0;
              const nota = r.daCorreggere ? 'Da correggere' : inCorso ? 'In corso' : r.stato !== 'CHIUSA' ? statoLeggibile(r) : null;
              return el(
                'li',
                {},
                el(
                  'button',
                  { type: 'button', class: `giorno ${r.daCorreggere ? 'giorno-errato' : ''}`, onclick: () => apriGiorno(data) },
                  el('span', { class: 'giorno-data' }, formattaDataBreve(data)),
                  cella('Lavoro', ore.lavoro),
                  cella('Straord.', ore.straordinario, 'positivo'),
                  cella('Permesso', ore.permesso),
                  nota || mancano > 0
                    ? el(
                        'span',
                        { class: 'giorno-note' },
                        nota ? el('span', { class: 'badge' }, nota) : null,
                        mancano > 0 ? el('span', { class: 'negativo' }, `Mancano ${formattaDurata(mancano)}`) : null,
                      )
                    : null,
                ),
              );
            }),
          ),
    ),
    el(
      'div',
      { class: 'riga-pulsanti' },
      el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void scegliGiorno(adesso.data, apriGiorno) }, '+ Giornata dimenticata'),
      el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => void esportaCsvCondividi(adesso) }, 'Esporta CSV'),
    ),
  );
}

/** Cella di una colonna del giorno: il valore, o un trattino se è zero. */
function cella(nome: string, minuti: number, classeSeAttiva = ''): HTMLElement {
  return el(
    'span',
    { class: 'giorno-cella' },
    el('span', { class: 'giorno-cella-nome' }, nome),
    el('span', { class: minuti > 0 ? classeSeAttiva : 'zero' }, minuti > 0 ? formattaDurata(minuti) : '–'),
  );
}

function stat(nome: string, valore: string, classe = ''): HTMLElement {
  return el('div', { class: 'stat' }, el('dt', {}, nome), el('dd', { class: classe }, valore));
}

async function scegliGiorno(oggi: string, apriGiorno: (data: string) => void): Promise<void> {
  const input = el('input', { type: 'date', value: oggi, max: oggi });
  let scelta: string | null = null;
  await apriFoglio('Scegli il giorno', el('label', { class: 'campo' }, el('span', {}, 'Data'), input), [
    { etichetta: 'Apri', stile: 'primario', azione: () => { if (!input.value) return false; scelta = input.value; } },
    { etichetta: 'Annulla' },
  ]);
  if (scelta) apriGiorno(scelta);
}
