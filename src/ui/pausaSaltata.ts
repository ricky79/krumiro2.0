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
