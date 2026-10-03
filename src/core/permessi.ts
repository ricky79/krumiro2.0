/** Ogni permesso usato vale un multiplo di questa durata (minuti). */
export const BLOCCO_PERMESSO = 30;

/** Permesso conteggiato per `durata` minuti reali: blocchi da 30 per eccesso, 0 se non c'è permesso. */
export function permessoABlocchi(durata: number): number {
  return durata > 0 ? Math.ceil(durata / BLOCCO_PERMESSO) * BLOCCO_PERMESSO : 0;
}
