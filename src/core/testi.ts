import { ETICHETTE_STATO } from './statoGiornata';
import { formattaDurata } from './tempo';
import type { RisultatoGiornata, SigarettaNonConteggiata } from './tipi';

export function statoLeggibile(r: RisultatoGiornata): string {
  return r.daCorreggere ? 'Da correggere' : ETICHETTE_STATO[r.stato];
}

/**
 * Pausa per il riepilogo: il valore conteggiato ("—" se non c'è) e, se è scattata la pausa minima,
 * una nota con quella fatta davvero ("fatta 20 min").
 */
export function testoPausa(r: RisultatoGiornata): { valore: string; nota: string | null } {
  if (r.pausa <= 0) return { valore: '—', nota: null };
  return {
    valore: formattaDurata(r.pausa),
    nota: r.pausaAggiuntaMinima > 0 ? `fatta ${formattaDurata(r.pausa - r.pausaAggiuntaMinima)}` : null,
  };
}

/** Dettaglio della pausa sigaretta non conteggiata nelle timbrature ("7 min · non conteggiata"). */
export function dettaglioSigarettaNonConteggiata(s: SigarettaNonConteggiata): string {
  return `${formattaDurata(s.durata)} · non conteggiata`;
}
