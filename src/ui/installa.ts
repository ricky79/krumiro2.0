import { el } from './dom';

export type Piattaforma = 'ios' | 'android' | 'altro';
/** 'pulsante' apre la finestra di installazione del browser (Android), 'istruzioni' spiega i passaggi (iPhone). */
export type Proposta = 'nessuna' | 'pulsante' | 'istruzioni';

export function piattaforma(userAgent: string, puntiTocco: number): Piattaforma {
  // iPadOS si presenta come un Mac: lo distingue solo lo schermo touch.
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && puntiTocco > 1)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'altro';
}

export function propostaInstallazione(s: {
  piattaforma: Piattaforma;
  installata: boolean;
  chiuso: boolean;
  promptPronto: boolean;
}): Proposta {
  if (s.installata || s.chiuso) return 'nessuna';
  if (s.piattaforma === 'ios') return 'istruzioni';
  if (s.piattaforma === 'android' && s.promptPronto) return 'pulsante';
  return 'nessuna';
}

/** Chiave separata dai dati, come per il tema: è una preferenza del dispositivo. */
const CHIAVE = 'timbrature-banner-installa-chiuso';

/** Evento di Chrome, Edge e Samsung Internet: non è standard e manca nei tipi di TypeScript. */
interface EventoInstallazione extends Event {
  prompt(): Promise<unknown>;
}

let dispositivo: Piattaforma = 'altro';
let promptRinviato: EventoInstallazione | null = null;
let chiuso = false;
let installata = false;
let comeFare: () => void = () => {};
let banner: HTMLElement | null = null;
let misura: ResizeObserver | null = null;

/** True se l'app è aperta dall'icona sulla schermata Home (PWA installata). */
export const inModalitaApp = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

function installa(): void {
  const evento = promptRinviato;
  promptRinviato = null; // il browser permette di usarlo una volta sola
  aggiorna();
  evento?.prompt().catch(() => {
    /* rifiutato dal browser: resta l'installazione dal menu */
  });
}

function chiudi(): void {
  chiuso = true;
  try {
    localStorage.setItem(CHIAVE, '1');
  } catch {
    /* resta chiuso solo per questa sessione */
  }
  aggiorna();
}

function creaBanner(proposta: Exclude<Proposta, 'nessuna'>): HTMLElement {
  const android = proposta === 'pulsante';
  return el(
    'aside',
    { class: 'banner-installa', 'aria-label': 'Installa l\'app' },
    el(
      'p',
      { class: 'banner-installa-testo' },
      el('strong', {}, 'Installa l\'app'),
      el('span', {}, android ? 'Si apre dall\'icona e funziona anche offline.' : 'Tocca Condividi, poi «Aggiungi alla schermata Home».'),
    ),
    android
      ? el('button', { type: 'button', class: 'btn btn-primario', onclick: installa }, 'Installa')
      : el('button', { type: 'button', class: 'btn btn-secondario', onclick: () => comeFare() }, 'Come fare'),
    el('button', { type: 'button', class: 'banner-installa-chiudi', 'aria-label': 'Chiudi e non mostrare più', onclick: chiudi }, '✕'),
  );
}

function aggiorna(): void {
  const proposta = propostaInstallazione({
    piattaforma: dispositivo,
    installata: installata || inModalitaApp(),
    chiuso,
    promptPronto: promptRinviato !== null,
  });
  banner?.remove();
  misura?.disconnect();
  document.documentElement.style.removeProperty('--altezza-banner');
  banner = proposta === 'nessuna' ? null : creaBanner(proposta);
  if (!banner) return;
  document.body.append(banner);
  misura?.observe(banner);
}

/**
 * Banner in basso che invita a installare l'app, finché non è installata o
 * l'utente lo chiude. Su Android il pulsante apre direttamente la finestra di
 * installazione del browser; su iPhone non è possibile, quindi spiega i passaggi.
 */
export function avviaBannerInstallazione(apriIstruzioni: () => void): void {
  comeFare = apriIstruzioni;
  dispositivo = piattaforma(navigator.userAgent, navigator.maxTouchPoints);
  try {
    chiuso = localStorage.getItem(CHIAVE) === '1';
  } catch {
    /* memoria non accessibile: il banner resta proponibile */
  }
  // Pagina e toast si spostano in su dell'altezza del banner (vedi style.css).
  misura = new ResizeObserver(() => {
    if (banner) document.documentElement.style.setProperty('--altezza-banner', `${banner.offsetHeight + 8}px`);
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // niente barra automatica di Chrome: si installa dal banner
    promptRinviato = e as EventoInstallazione;
    aggiorna();
  });
  window.addEventListener('appinstalled', () => {
    installata = true;
    aggiorna();
  });
  aggiorna();
}
