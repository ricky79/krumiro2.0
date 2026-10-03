import { calcolaGiornata } from './calcolo';
import type { Giornata, Impostazioni, RisultatoGiornata } from './tipi';

export interface GiornoRiepilogo {
  data: string;
  risultato: RisultatoGiornata;
}

export interface RiepilogoMese {
  mese: string;
  giorni: GiornoRiepilogo[];
  lavorati: number;
  permesso: number;
  saldo: number;
  giorniDaCorreggere: number;
}

/**
 * Riepilogo di un mese ('YYYY-MM'). Solo i giorni registrati contano.
 * `oggi` serve a calcolare la giornata in corso con l'orario attuale.
 */
export function riepilogoMese(
  giornate: Record<string, Giornata>,
  imp: Impostazioni,
  mese: string,
  oggi: { data: string; minuti: number },
): RiepilogoMese {
  const giorni = Object.values(giornate)
    .filter((g) => g.data.startsWith(mese + '-') && haContenuto(g))
    .sort((a, b) => b.data.localeCompare(a.data))
    .map((g) => ({
      data: g.data,
      risultato: calcolaGiornata(g, imp, g.data === oggi.data ? oggi.minuti : null),
    }));

  let lavorati = 0;
  let permesso = 0;
  let saldo = 0;
  let giorniDaCorreggere = 0;
  for (const { data, risultato } of giorni) {
    lavorati += risultato.lavorati;
    permesso += risultato.permesso;
    // La giornata in corso non è ancora chiusa: il suo saldo non entra nel mese.
    if (data !== oggi.data || risultato.stato === 'CHIUSA') saldo += risultato.saldo;
    if (risultato.daCorreggere) giorniDaCorreggere++;
  }
  return { mese, giorni, lavorati, permesso, saldo, giorniDaCorreggere };
}

export function haContenuto(g: Giornata): boolean {
  return g.eventi.length > 0 || g.permessoInizioMinuti > 0 || g.permessoUscitaMinuti > 0;
}
