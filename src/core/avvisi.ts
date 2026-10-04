import { calcolaGiornata } from './calcolo';
import { sigarettaInCorso } from './sigaretta';
import { analizzaGiornata } from './statoGiornata';
import { formattaDurata, formattaOra, MINUTI_GIORNO } from './tempo';
import type { Giornata, Impostazioni } from './tipi';

/** Avvisi della giornata: al massimo uno per tipo, ognuno con un id numerico fisso (serve ad Android). */
export type TipoAvviso = 'uscita' | 'pausa' | 'sigaretta';

export const ID_AVVISO: Record<TipoAvviso, number> = { uscita: 1, pausa: 2, sigaretta: 3 };

export interface Avviso {
  tipo: TipoAvviso;
  /** Minuti dalla mezzanotte di oggi (Europe/Rome) in cui l'avviso deve suonare. */
  minuti: number;
  titolo: string;
  testo: string;
}

/**
 * Avvisi da programmare per la giornata di oggi, dato lo stato delle timbrature. Funzione pura:
 * chi la chiama cancella i vecchi avvisi e programma esattamente questi.
 *
 * - Al lavoro: avviso all'uscita prevista (che non cambia finché si lavora: se la pausa non è
 *   ancora fatta, la include già). In pausa o in permesso l'uscita prevista non è affidabile,
 *   quindi si riprogramma al rientro.
 * - In pausa pranzo: avviso dopo `avvisi.pranzoMinuti` dall'inizio della pausa.
 * - In pausa sigaretta: avviso allo scadere della tolleranza. L'avviso parte dal minuto in cui
 *   si è timbrata l'uscita, quindi arriva al più 59 secondi prima della scadenza esatta.
 *
 * Niente avvisi per giornate di altri giorni, da correggere, chiuse o non iniziate, né per
 * orari già passati.
 */
export function pianificaAvvisi(
  giornata: Giornata,
  imp: Impostazioni,
  adesso: { data: string; minuti: number },
): Avviso[] {
  if (giornata.data !== adesso.data) return [];
  const r = calcolaGiornata(giornata, imp, adesso.minuti);
  if (r.daCorreggere) return [];

  const { eventiValidi } = analizzaGiornata(giornata);
  const ultimo = eventiValidi[eventiValidi.length - 1];
  const avvisi: Avviso[] = [];
  const aggiungi = (a: Avviso) => {
    if (a.minuti > adesso.minuti && a.minuti < MINUTI_GIORNO) avvisi.push(a);
  };

  if (r.stato === 'AL_LAVORO' && imp.avvisi.uscita && r.uscitaPrevista !== null) {
    aggiungi({
      tipo: 'uscita',
      minuti: r.uscitaPrevista,
      titolo: 'Puoi andare via',
      testo: `Le ore sono completate: uscita prevista alle ${formattaOra(r.uscitaPrevista)}.`,
    });
  } else if (r.stato === 'IN_PAUSA' && imp.avvisi.pranzo && ultimo?.tipo === 'INIZIO_PAUSA') {
    aggiungi({
      tipo: 'pausa',
      minuti: ultimo.minuti + imp.avvisi.pranzoMinuti,
      titolo: 'Fine pausa pranzo',
      testo: `Sono passati ${formattaDurata(imp.avvisi.pranzoMinuti)}: è ora di rientrare.`,
    });
  } else if (r.stato === 'IN_PERMESSO' && imp.avvisi.sigaretta) {
    const uscita = sigarettaInCorso(giornata);
    if (uscita) {
      aggiungi({
        tipo: 'sigaretta',
        minuti: uscita.minuti + imp.tolleranzaSigaretta,
        titolo: 'Pausa sigaretta finita',
        testo: 'Rientra ora: oltre la tolleranza la pausa diventa permesso.',
      });
    }
  }
  return avvisi;
}
