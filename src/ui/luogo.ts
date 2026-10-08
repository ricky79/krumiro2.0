import { store } from '../storage/store';
import { el } from './dom';

/** Icone (24×24, a tratto) di casa e ufficio: costanti, quindi sicure da inserire come markup. */
const SVG_CASA =
  '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.8v9.7h13V9.8"/><path d="M10 19.5v-5h4v5"/>';
const SVG_UFFICIO =
  '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/>';

function icona(tracciato: string, classe = 'icona-luogo'): HTMLElement {
  const span = el('span', { class: classe, 'aria-hidden': 'true' });
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${tracciato}</svg>`;
  return span;
}

export const iconaCasa = (classe?: string): HTMLElement => icona(SVG_CASA, classe);

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
  const opzione = (valore: boolean, etichetta: string, tracciato: string) =>
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
      icona(tracciato),
    );
  return el(
    'div',
    { class: 'luogo', role: 'group', 'aria-label': 'Dove lavori' },
    opzione(true, 'Da casa (smart)', SVG_CASA),
    opzione(false, 'In sede', SVG_UFFICIO),
  );
}
