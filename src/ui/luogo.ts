import { store } from '../storage/store';
import { el } from './dom';

/** Emoji di casa e ufficio, a colori come nel resto dell'app (🚬). */
const CASA = '🏠';
const UFFICIO = '🏢';

function icona(emoji: string, classe = 'icona-luogo'): HTMLElement {
  return el('span', { class: classe, 'aria-hidden': 'true' }, emoji);
}

export const iconaCasa = (classe?: string): HTMLElement => icona(CASA, classe);

/** Segna la giornata come lavorata da casa (smart) o in sede. */
export function impostaSmart(data: string, smart: boolean): void {
  if ((store.giornata(data).smart === true) === smart) return;
  store.modificaGiornata(data, (g) => {
    if (smart) g.smart = true;
    else delete g.smart;
  });
}

/** Controllo segmentato casa/ufficio: dove si lavora nella giornata (predefinito: in sede). */
export function controlloLuogo(data: string): HTMLElement {
  const smart = store.giornata(data).smart === true;
  const opzione = (valore: boolean, etichetta: string, emoji: string) =>
    el(
      'button',
      {
        type: 'button',
        class: 'luogo-opzione',
        'aria-pressed': String(valore === smart),
        'aria-label': etichetta,
        title: etichetta,
        onclick: () => impostaSmart(data, valore),
      },
      icona(emoji),
    );
  return el(
    'div',
    { class: 'luogo', role: 'group', 'aria-label': 'Dove lavori' },
    opzione(true, 'Da casa (smart)', CASA),
    opzione(false, 'In sede', UFFICIO),
  );
}
