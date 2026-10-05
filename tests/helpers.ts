import { parseOra } from '../src/core/tempo';
import { IMPOSTAZIONI_PREDEFINITE, type Evento, type Giornata, type Impostazioni, type TipoEvento } from '../src/core/tipi';
import { clonaImpostazioni } from '../src/storage/migrazioni';

/** Giovedì: 8h dovute con le impostazioni predefinite. */
export const GIOVEDI = '2026-10-01';
export const SABATO = '2026-10-03';

export const h = (ore: string): number => {
  const m = parseOra(ore);
  if (m === null) throw new Error(`Ora non valida: ${ore}`);
  return m;
};

let n = 0;
export function giornata(
  eventi: [TipoEvento, string, number?][],
  opz: { permessoInizio?: number; permessoUscita?: number; data?: string } = {},
): Giornata {
  return {
    data: opz.data ?? GIOVEDI,
    permessoInizioMinuti: opz.permessoInizio ?? 0,
    permessoUscitaMinuti: opz.permessoUscita ?? 0,
    eventi: eventi.map(([tipo, ora, pausaConfermata]): Evento => {
      const e: Evento = { id: `e${++n}`, tipo, minuti: h(ora) };
      if (pausaConfermata !== undefined) e.pausaConfermata = pausaConfermata;
      return e;
    }),
  };
}

/** 8h dovute, pausa da scalare 60 min (come richiesto per i test; il predefinito dell'app è 30). */
export function impostazioni(modifiche: Partial<Impostazioni> = {}): Impostazioni {
  return { ...clonaImpostazioni(IMPOSTAZIONI_PREDEFINITE), pausaDaScalare: 60, ...modifiche };
}
