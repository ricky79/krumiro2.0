import './style.css';
import { adessoRoma } from './core/tempo';
import { richiediPersistenza, seguiAltreSchede, store } from './storage/store';
import { avviso } from './ui/dialoghi';
import { el, monta } from './ui/dom';
import { impostaOrologio, vistaGiorno, type Adesso } from './ui/giorno';
import { riprendiPausaSigaretta } from './ui/sigaretta';
import { vistaImpostazioni } from './ui/impostazioni';
import { vistaStorico } from './ui/storico';
import { apriAiuto, EVENTO_APRI_AIUTO, vistaAiuto } from './ui/aiuto';
import { registraServiceWorker } from './pwa';
import { avviaTema } from './ui/tema';
import { avviaBannerInstallazione } from './ui/installa';
import { avviaControlloAggiornamenti } from './ui/aggiornamento';
import { inApp } from './native/app';
import { avviaAvvisi as avviaAvvisiApp } from './native/avvisi';
import { avviaAvvisi as avviaAvvisiPwa } from './web/avvisi';

type Scheda = 'oggi' | 'storico' | 'impostazioni' | 'aiuto';

const stato: { scheda: Scheda; mese: string; giornoAperto: string | null; aiuto: string | null } = {
  scheda: 'oggi',
  aiuto: null,
  mese: adessoRoma().data.slice(0, 7),
  giornoAperto: null,
};

avviaTema();
impostaOrologio(() => adessoRoma());

const app = document.getElementById('app')!;
const contenuto = el('main', { class: 'contenuto' });
const tabbar = el('nav', { class: 'tabbar', 'aria-label': 'Sezioni' });
app.append(contenuto, tabbar);

let ultimoRender = '';

function render(forza = true): void {
  const adesso: Adesso = adessoRoma();
  // Evita di ridisegnare (e perdere lo scroll) se nulla è cambiato.
  const chiave = `${adesso.data} ${adesso.minuti}`;
  if (!forza && chiave === ultimoRender) return;
  // Aiuto e impostazioni non dipendono dall'orario: niente refresh periodico
  // (chiuderebbe le risposte aperte e toglierebbe il focus dai campi).
  if (!forza && (stato.scheda === 'aiuto' || stato.scheda === 'impostazioni')) return;
  if (!forza && document.querySelector('dialog[open]')) return; // non disturbare un dialogo aperto
  ultimoRender = chiave;

  const scroll = window.scrollY;
  let vista: HTMLElement;
  if (stato.scheda === 'oggi') vista = vistaGiorno(adesso.data, adesso, null);
  else if (stato.scheda === 'storico') {
    vista = stato.giornoAperto
      ? vistaGiorno(stato.giornoAperto, adesso, () => vai('storico'))
      : vistaStorico(stato.mese, adesso, (m) => {
          stato.mese = m;
          render();
        }, (data) => {
          if (data === adesso.data) return vai('oggi');
          stato.giornoAperto = data;
          render();
          window.scrollTo(0, 0);
        });
  } else if (stato.scheda === 'aiuto') {
    vista = vistaAiuto(stato.aiuto);
    stato.aiuto = null;
  } else vista = vistaImpostazioni(adesso);
  monta(contenuto, vista);
  window.scrollTo(0, scroll);
  // Pausa sigaretta in corso (app riaperta o tornata in primo piano): ripresenta la schermata.
  riprendiPausaSigaretta(adesso.data);

  monta(
    tabbar,
    ...(
      [
        ['oggi', 'Oggi', '◉'],
        ['storico', 'Storico', '☰'],
        ['impostazioni', 'Impostazioni', '⚙︎'],
        ['aiuto', 'Aiuto', '?'],
      ] as const
    ).map(([id, testo, icona]) =>
      el(
        'button',
        { type: 'button', class: `tab ${stato.scheda === id ? 'attiva' : ''}`, 'aria-current': stato.scheda === id ? 'page' : null, onclick: () => vai(id) },
        el('span', { class: 'tab-icona', 'aria-hidden': 'true' }, icona),
        el('span', {}, testo),
      ),
    ),
  );
}

function vai(scheda: Scheda): void {
  if (scheda !== stato.scheda || scheda === 'storico') stato.giornoAperto = null;
  stato.scheda = scheda;
  render();
  window.scrollTo(0, 0);
}

store.ascolta(() => render());
seguiAltreSchede();
window.addEventListener(EVENTO_APRI_AIUTO, (e) => {
  stato.aiuto = (e as CustomEvent<string | undefined>).detail ?? null;
  vai('aiuto');
});
render();

// Aggiorna l'orario ogni 15 s e quando l'app torna in primo piano.
setInterval(() => render(false), 15_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render(false);
});

void richiediPersistenza();
if (inApp()) {
  // App Android: niente service worker né invito a installare; le notifiche sono locali.
  avviaAvvisiApp();
  // L'APK non si aggiorna da solo: un banner propone la nuova versione pubblicata su GitHub.
  avviaControlloAggiornamenti(__VERSIONE_APP__);
} else {
  registraServiceWorker();
  // PWA: gli avvisi passano dal backend e arrivano come notifiche push.
  avviaAvvisiPwa();
  avviaBannerInstallazione(() => apriAiuto('installazione'));
}
if (store.erroreCaricamento) void avviso('Attenzione', store.erroreCaricamento);
