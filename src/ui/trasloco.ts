import { inApp } from '../native/app';
import { creaBanner, mostraBanner } from './banner';
import { el } from './dom';

/** Indirizzo della nuova app: Krumiro è diventata Sbeggio. */
export const URL_SBEGGIO = 'https://sbeggio.app/';

function apri(): void {
  // Nell'app Android Capacitor apre gli indirizzi esterni nel browser; nella PWA si apre una scheda.
  if (inApp()) window.location.href = URL_SBEGGIO;
  else window.open(URL_SBEGGIO, '_blank', 'noopener');
}

/**
 * Ultima versione di Krumiro: un banner rimanda a Sbeggio. Si chiude solo fino all'apertura
 * successiva, così resta visibile finché si usa la vecchia app.
 */
export function avviaAvvisoTrasloco(): void {
  mostraBanner(
    creaBanner({
      etichetta: 'Krumiro è diventata Sbeggio',
      titolo: 'Krumiro ora si chiama Sbeggio',
      testo: 'Si trova su sbeggio.app. Prima esporta il backup JSON da Impostazioni e importalo lì: i dati non si spostano da soli.',
      azione: el('button', { type: 'button', class: 'btn btn-primario', onclick: apri }, 'Vai'),
      chiudi: 'Chiudi l\'avviso',
      onChiudi: () => mostraBanner(null),
    }),
  );
}
