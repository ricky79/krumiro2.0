import { ETICHETTE_STATO } from './statoGiornata';
import { formattaDurata } from './tempo';
import type { RisultatoGiornata } from './tipi';

export function statoLeggibile(r: RisultatoGiornata): string {
  return r.daCorreggere ? 'Da correggere' : ETICHETTE_STATO[r.stato];
}

/** Pausa per il riepilogo: "—", "45 min", o "30 min (fatta 20 min)" se è scattata la pausa minima. */
export function testoPausa(r: RisultatoGiornata): string {
  if (r.pausa <= 0) return '—';
  const conteggiata = formattaDurata(r.pausa);
  return r.pausaAggiuntaMinima > 0
    ? `${conteggiata} (fatta ${formattaDurata(r.pausa - r.pausaAggiuntaMinima)})`
    : conteggiata;
}
