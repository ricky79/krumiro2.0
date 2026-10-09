import { ETICHETTE_STATO } from './statoGiornata';
import { formattaDurata } from './tempo';
import type { Giornata, RisultatoGiornata } from './tipi';

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

/** Riga del riepilogo con le pause sigaretta non conteggiate ("🚬 2 sigarette non conteggiate · 14 min"); null se non ce ne sono. */
export function testoSigaretteNonConteggiate(g: Giornata): string | null {
  const sigarette = g.sigaretteNonConteggiate ?? [];
  if (sigarette.length === 0) return null;
  const totale = sigarette.reduce((s, x) => s + x.durata, 0);
  const quante = sigarette.length === 1 ? '1 sigaretta non conteggiata' : `${sigarette.length} sigarette non conteggiate`;
  return `🚬 ${quante} · ${formattaDurata(totale)}`;
}
