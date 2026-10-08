import { haTimbrature } from '../core/riepilogo';
import type { Giornata, Impostazioni, Luogo } from '../core/tipi';
import { datiVuoti, migra, type DatiSalvati } from './migrazioni';

const CHIAVE = 'timbrature';

type Ascoltatore = () => void;

/** Stato dell'app in memoria, sincronizzato su localStorage a ogni modifica. */
class Store {
  private dati: DatiSalvati;
  private ascoltatori = new Set<Ascoltatore>();
  /** Luogo proposto per una data (rilevato dalla posizione), fissato alla prima timbratura. */
  private luogoProposto: (data: string) => Luogo | null = () => null;
  /** Messaggio di errore di caricamento, se i dati salvati erano illeggibili. */
  erroreCaricamento: string | null = null;

  constructor() {
    this.dati = this.carica();
  }

  private carica(): DatiSalvati {
    let testo: string | null = null;
    try {
      testo = localStorage.getItem(CHIAVE);
    } catch {
      this.erroreCaricamento = 'Impossibile accedere alla memoria del browser.';
      return datiVuoti();
    }
    if (!testo) return datiVuoti();
    try {
      return migra(JSON.parse(testo));
    } catch (e) {
      // Conserva la copia illeggibile per non perderla.
      try {
        localStorage.setItem(`${CHIAVE}-corrotto-${Date.now()}`, testo);
      } catch {
        /* ignora */
      }
      this.erroreCaricamento = `Dati salvati non leggibili (${(e as Error).message}). È stata creata una copia di sicurezza.`;
      return datiVuoti();
    }
  }

  /** Rilegge i dati salvati (es. modificati da un'altra scheda) e avvisa chi ascolta. */
  ricarica(): void {
    this.dati = this.carica();
    for (const a of this.ascoltatori) a();
  }

  private salva(): void {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(this.dati));
    } catch {
      alert('Salvataggio non riuscito: memoria del browser piena o non disponibile.');
    }
    for (const a of this.ascoltatori) a();
  }

  ascolta(a: Ascoltatore): () => void {
    this.ascoltatori.add(a);
    return () => this.ascoltatori.delete(a);
  }

  get impostazioni(): Impostazioni {
    return this.dati.impostazioni;
  }

  get giornate(): Record<string, Giornata> {
    return this.dati.giornate;
  }

  get tutto(): DatiSalvati {
    return this.dati;
  }

  giornata(data: string): Giornata {
    return this.dati.giornate[data] ?? { data, permessoInizioMinuti: 0, permessoUscitaMinuti: 0, eventi: [] };
  }

  /** Applica una modifica alla giornata (creandola se serve) e salva. */
  modificaGiornata(data: string, modifica: (g: Giornata) => void): void {
    const g = structuredClone(this.giornata(data));
    modifica(g);
    // Alla prima timbratura la proposta (casa o sede dalla posizione) diventa il luogo della giornata.
    if (g.luogo === undefined && haTimbrature(g)) {
      const proposto = this.luogoProposto(data);
      if (proposto) g.luogo = proposto;
    }
    if (!haTimbrature(g) && g.luogo === undefined) delete this.dati.giornate[data];
    else this.dati.giornate[data] = g;
    this.salva();
  }

  proponiLuogo(f: (data: string) => Luogo | null): void {
    this.luogoProposto = f;
  }

  modificaImpostazioni(modifica: (i: Impostazioni) => void): void {
    modifica(this.dati.impostazioni);
    this.salva();
  }

  /** Sostituisce tutti i dati (ripristino da backup JSON). */
  sostituisci(dati: DatiSalvati): void {
    this.dati = dati;
    this.salva();
  }

  /** Unisce giornate importate, sovrascrivendo le date già presenti. */
  unisciGiornate(giornate: Record<string, Giornata>): void {
    Object.assign(this.dati.giornate, giornate);
    this.salva();
  }
}

export const store = new Store();

/**
 * Con l'app aperta in più schede ognuna tiene i dati in memoria: quando un'altra scheda salva, questa
 * li rilegge. Così non sovrascrive le timbrature dell'altra e gli avvisi seguono i dati veri.
 * (`key` null: l'altra scheda ha svuotato tutta la memoria del sito.)
 */
export function seguiAltreSchede(): void {
  window.addEventListener('storage', (e) => {
    if (e.key === CHIAVE || e.key === null) store.ricarica();
  });
}

/** Chiede al browser di non cancellare i dati in caso di poco spazio. */
export async function richiediPersistenza(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* non supportato */
  }
  return false;
}
