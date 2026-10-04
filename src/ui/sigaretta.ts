import { anteprimaSigaretta } from '../core/calcolo';
import { nuovoId } from '../core/id';
import {
  BLOCCO_PERMESSO_SIGARETTA,
  countdown,
  esitoRientroSigaretta,
  type FaseSigaretta,
  istanteDaMinuti,
  sigarettaDaRiprendere,
  spegnimentoDaAnimare,
  testoTimer,
} from '../core/sigaretta';
import { adessoRoma, formattaDataLunga, formattaDurata, formattaOra } from '../core/tempo';
import type { Evento } from '../core/tipi';
import { store } from '../storage/store';
import { avviso, conferma, toast } from './dialoghi';
import { el } from './dom';
import { creaDisegno } from './sigarettaDisegni';
import { cancellaInizioSigaretta, inizioSigarettaSalvato, salvaInizioSigaretta } from './inizioSigaretta';

function leggiInizio(data: string, uscita: Evento): number {
  return inizioSigarettaSalvato(data, uscita.id) ?? istanteDaMinuti(uscita.minuti, new Date());
}

let aperta = false;

/** Registra l'uscita della pausa sigaretta e apre la schermata. */
export function avviaPausaSigaretta(data: string, minuti: number): void {
  const uscita: Evento = { id: nuovoId(), tipo: 'USCITA_PERMESSO', minuti, sigaretta: true };
  salvaInizioSigaretta({ data, eventoId: uscita.id, inizio: Date.now() });
  store.modificaGiornata(data, (g) => void g.eventi.push({ ...uscita }));
  if (!aperta) apriSchermata(data, uscita);
}

/** Riapre la schermata se nella giornata c'è una pausa sigaretta in corso (e non è già aperta). */
export function riprendiPausaSigaretta(data: string): void {
  if (aperta) return;
  const uscita = sigarettaDaRiprendere(store.giornata(data));
  if (uscita) apriSchermata(data, uscita);
}

function apriSchermata(data: string, uscita: Evento): void {
  aperta = true;
  const inizio = leggiInizio(data, uscita);
  const tolleranza = store.impostazioni.tolleranzaSigaretta;
  const entro = formattaOra(adessoRoma(new Date(inizio + tolleranza * 60_000)).minuti);

  // Il tipo si legge all'apertura: con la schermata aperta le impostazioni non sono raggiungibili.
  const tipo = store.impostazioni.tipoSigaretta;
  const disegno = creaDisegno(tipo);
  const scena = el('div', { class: 'sigaretta-scena' }, disegno.elemento);
  const timer = el('p', { class: 'sigaretta-timer', role: 'timer' });
  const nota = el('p', { class: 'sigaretta-nota' });

  let chiusaDaNoi = false;
  const termina = () => {
    chiusaDaNoi = true;
    dlg.close();
  };
  /** Il giorno è cambiato a pausa aperta: non si scrive nulla, la giornata va corretta dallo Storico. */
  const giornoCambiato = (): boolean => {
    if (chiusaDaNoi) return true;
    if (adessoRoma().data === data) return false;
    termina();
    cancellaInizioSigaretta();
    void avviso(
      'Pausa sigaretta non chiusa',
      `Il rientro di ${formattaDataLunga(data)} non è stato registrato: correggi la giornata dallo Storico.`,
    );
    return true;
  };

  const dlg = el(
    'dialog',
    { class: tipo === 'elettronica' ? 'sigaretta elettronica' : 'sigaretta', 'aria-label': 'Pausa sigaretta' },
    el('header', {}, el('h2', {}, 'Pausa sigaretta'), el('p', { class: 'sigaretta-uscita' }, `uscita alle ${formattaOra(uscita.minuti)}`)),
    scena,
    timer,
    nota,
    el(
      'div',
      { class: 'sigaretta-azioni' },
      el(
        'button',
        {
          type: 'button',
          class: 'btn btn-primario',
          onclick: () => {
            if (giornoCambiato()) return;
            termina();
            rientra(data, uscita, inizio);
          },
        },
        'Rientro',
      ),
      el(
        'button',
        {
          type: 'button',
          class: 'sigaretta-annulla',
          onclick: async () => {
            if (giornoCambiato()) return;
            const ok = await conferma(
              'Annullare la pausa?',
              'L\'uscita per la pausa sigaretta verrà eliminata, come se non l\'avessi registrata.',
              'Annulla pausa',
              true,
            );
            if (!ok || giornoCambiato()) return;
            termina();
            cancellaInizioSigaretta();
            store.modificaGiornata(data, (g) => void (g.eventi = g.eventi.filter((e) => e.id !== uscita.id)));
            toast('Pausa sigaretta annullata');
          },
        },
        'Annulla pausa',
      ),
    ),
  );

  let fasePrecedente: FaseSigaretta | null = null;
  const aggiorna = () => {
    if (giornoCambiato()) return;
    const c = countdown(Date.now() - inizio, tolleranza);
    disegno.aggiorna(c.consumata);
    dlg.classList.toggle('consumata', c.consumata >= 1);
    dlg.classList.toggle('ultimi', c.fase === 'ultimi');
    dlg.classList.toggle('scaduta', c.fase === 'scaduta');
    // Sequenza del posacenere solo se la pausa scade mentre la schermata è aperta.
    if (spegnimentoDaAnimare(fasePrecedente, c.fase)) dlg.classList.add('spegnimento');
    fasePrecedente = c.fase;
    timer.textContent = testoTimer(c);
    if (c.fase === 'scaduta') {
      const p = anteprimaSigaretta(store.giornata(data), store.impostazioni, adessoRoma().minuti);
      nota.textContent = `Al rientro: ${formattaDurata(p?.permesso ?? BLOCCO_PERMESSO_SIGARETTA)} di permesso`;
    } else {
      nota.textContent = `Rientra entro le ${entro} per non segnare nulla`;
    }
  };
  const intervallo = setInterval(aggiorna, 1000);

  // Si esce solo con Rientro o Annulla pausa.
  dlg.addEventListener('cancel', (ev) => ev.preventDefault());
  dlg.addEventListener('close', () => {
    clearInterval(intervallo);
    dlg.remove();
    aperta = false;
    // Chiusa dal sistema (Esc, tasto Indietro): la pausa è ancora in corso, si riapre.
    if (!chiusaDaNoi) riprendiPausaSigaretta(data);
  });
  document.body.append(dlg);
  dlg.showModal();
  aggiorna();
}

function rientra(data: string, uscita: Evento, inizio: number): void {
  const trascorsi = Date.now() - inizio;
  const { minuti } = adessoRoma();
  cancellaInizioSigaretta();
  if (esitoRientroSigaretta(trascorsi, store.impostazioni.tolleranzaSigaretta) === 'annulla') {
    store.modificaGiornata(data, (g) => void (g.eventi = g.eventi.filter((e) => e.id !== uscita.id)));
    toast(`Pausa sigaretta di ${formattaDurata(Math.max(1, Math.round(trascorsi / 60_000)))}: non conteggiata`);
    return;
  }
  const permesso = anteprimaSigaretta(store.giornata(data), store.impostazioni, minuti)?.permesso ?? BLOCCO_PERMESSO_SIGARETTA;
  store.modificaGiornata(data, (g) => void g.eventi.push({ id: nuovoId(), tipo: 'RIENTRO_PERMESSO', minuti }));
  toast(`Rientro alle ${formattaOra(minuti)} · ${formattaDurata(permesso)} di permesso`);
}
