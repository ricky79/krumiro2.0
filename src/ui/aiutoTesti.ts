import { DURATA_PAUSA_PROPOSTA, OFFSET_PAUSA_PROPOSTA } from '../core/pausaPranzo';
import type { Azione } from '../core/statoGiornata';
import { formattaDurata, formattaOra } from '../core/tempo';
import type { Impostazioni } from '../core/tipi';

/**
 * Contenuti dell'aiuto. Testo semplice: ogni elemento di `testo` è un paragrafo;
 * le righe che iniziano con "• " diventano un elenco puntato.
 * Gli importi (fascia pranzo, pausa da scalare…) seguono le impostazioni correnti.
 */
export interface VoceAiuto {
  id: string;
  sezione: string;
  domanda: string;
  testo: string[];
  /** Azione dell'app a cui la voce si riferisce, per l'aiuto contestuale. */
  azione?: Azione;
}

export const SEZIONI_AIUTO = [
  'Primi passi',
  'I bottoni',
  'Come si calcola',
  'Correggere gli errori',
  'Storico e riepilogo',
  'Dati e backup',
  'Avvisi',
  'Installazione',
] as const;

export function vociAiuto(imp: Impostazioni): VoceAiuto[] {
  const pranzo = `${formattaOra(imp.pranzo.inizio)}–${formattaOra(imp.pranzo.fine)}`;
  const scalare = formattaDurata(imp.pausaDaScalare);
  const minimo = formattaOra(imp.orarioMinimoConteggio);
  const pausaMin = formattaDurata(imp.pausaMinima);
  const dovute = formattaDurata(imp.minutiDovuti.predefinito);
  const tolleranza = formattaDurata(imp.tolleranzaSigaretta);
  const pranzoAvviso = formattaDurata(imp.avvisi.pranzoMinuti);
  const inizioProposta = imp.pranzo.inizio + OFFSET_PAUSA_PROPOSTA;
  const pausaProposta = `${formattaOra(inizioProposta)}–${formattaOra(inizioProposta + DURATA_PAUSA_PROPOSTA)}`;
  const fineSigaretta =
    imp.tipoSigaretta === 'elettronica' ? 'il serbatoio si svuota, il LED lampeggia' : 'la sigaretta finisce nel posacenere';

  return [
    // --- Primi passi
    {
      id: 'come-funziona',
      sezione: 'Primi passi',
      domanda: 'Come funziona l\'app?',
      testo: [
        'Ogni volta che timbri al lavoro, tocca il bottone grande nella schermata Oggi: l\'app registra l\'orario attuale e ti propone già l\'azione successiva (Entrata → Inizio pausa → Fine pausa → Uscita).',
        'In alto vedi l\'ora di uscita prevista, le ore coperte rispetto a quelle dovute e il saldo della giornata.',
        'Sotto il bottone grande compaiono le azioni meno frequenti (permessi, uscita anticipata…), solo quando hanno senso in quel momento.',
      ],
    },
    {
      id: 'ore-coperte',
      sezione: 'Primi passi',
      domanda: 'Cosa sono le ore "coperte", "lavorate" e il "saldo"?',
      testo: [
        '• Lavorate: il tempo effettivamente passato al lavoro, escluse le pause.',
        '• Permesso: le ore di permesso (a inizio giornata, a metà giornata o per uscita anticipata).',
        '• Ogni permesso vale un multiplo di 30 min: un\'uscita anticipata con 1h23 mancanti conta 1h30; i minuti in più non contano come lavorate.',
        '• Coperte: lavorate + permesso. È il numero che deve arrivare alle ore dovute.',
        '• Saldo: coperte − dovute. Positivo = straordinario, negativo = ore mancanti.',
        'Mentre la giornata è in corso, al posto di un saldo negativo vedi "Mancano", cioè quanto ti resta da coprire.',
      ],
    },

    // --- I bottoni
    {
      id: 'entrata',
      sezione: 'I bottoni',
      azione: 'ENTRATA',
      domanda: 'Entrata',
      testo: ['Registra l\'inizio della giornata lavorativa all\'orario attuale.'],
    },
    {
      id: 'pausa',
      sezione: 'I bottoni',
      azione: 'INIZIO_PAUSA',
      domanda: 'Inizio pausa / Fine pausa',
      testo: [
        'Servono per la pausa pranzo, che non conta come ore coperte.',
        `Se la pausa dura meno di ${pausaMin}, viene comunque conteggiata come ${pausaMin}.`,
        'Finché non hai fatto la pausa, l\'uscita prevista la include già (te lo segnala la scritta "inclusa pausa pranzo").',
        `Se a fine fascia pranzo non hai registrato la pausa, in Oggi compare un riquadro che propone di aggiungerla (${pausaProposta}); con "No, l'ho saltata" non te lo chiede più quel giorno.`,
      ],
    },
    {
      id: 'fine-pausa',
      sezione: 'I bottoni',
      azione: 'FINE_PAUSA',
      domanda: 'Durante la pausa, cosa indica l\'uscita prevista?',
      testo: [`È l'orario di uscita se rientrassi adesso, tenendo conto che la pausa vale almeno ${pausaMin}.`],
    },
    {
      id: 'uscita',
      sezione: 'I bottoni',
      azione: 'USCITA',
      domanda: 'Uscita',
      testo: [
        'Chiude la giornata in modo normale. Se esci prima di aver coperto le ore dovute, il saldo sarà negativo: se invece vuoi coprire le ore mancanti con un permesso usa "Uscita anticipata".',
      ],
    },
    {
      id: 'permesso-vs-anticipata',
      sezione: 'I bottoni',
      azione: 'USCITA_PERMESSO',
      domanda: 'Differenza tra "Esco in permesso" e "Uscita anticipata"',
      testo: [
        'La differenza è se poi rientri al lavoro.',
        '• Esco in permesso: esci a metà giornata e poi torni (medico, commissione…). Il permesso va dall\'uscita al rientro e il bottone grande diventa "Rientro da permesso".',
        '• Uscita anticipata: esci e non torni più. Tutte le ore che mancano per arrivare alle dovute diventano permesso e il saldo è 0.',
        `Esempio con ${dovute} dovute: entrata 08:30, pausa 12:30–13:30, uscita anticipata 15:30 → lavorate 6h, permesso 2h, saldo 0.`,
        'Hai usato "Esco in permesso" ma poi non rientri? Tocca "Non rientro": l\'uscita in permesso diventa un\'uscita anticipata.',
      ],
    },
    {
      id: 'uscita-anticipata',
      sezione: 'I bottoni',
      azione: 'USCITA_ANTICIPATA',
      domanda: 'Uscita anticipata',
      testo: [
        'Chiude la giornata in permesso: le ore che mancano per arrivare alle dovute diventano ore di permesso, quindi il saldo è 0.',
        'Prima di registrarla l\'app ti mostra quante ore di permesso verranno conteggiate e chiede conferma.',
        'Se avevi già coperto tutte le ore, non viene conteggiato alcun permesso.',
      ],
    },
    {
      id: 'rientro',
      sezione: 'I bottoni',
      azione: 'RIENTRO_PERMESSO',
      domanda: 'Rientro da permesso e pausa pranzo',
      testo: [
        `Se il permesso si sovrappone alla fascia pranzo (${pranzo}) e quel giorno non hai registrato una pausa, una parte del permesso (fino a ${scalare}) viene considerata pausa pranzo e non permesso.`,
        'Al rientro l\'app ti mostra la ripartizione proposta, per esempio "1h pausa + 1h30 permesso", e puoi modificarla con − / + prima di confermare.',
        'Puoi cambiarla anche dopo, toccando il rientro nella timeline.',
      ],
    },
    {
      id: 'non-rientro',
      sezione: 'I bottoni',
      azione: 'NON_RIENTRO',
      domanda: 'Non rientro (chiudi in permesso)',
      testo: [
        'Compare mentre sei in permesso. Trasforma l\'ultima "Uscita in permesso" in "Uscita anticipata": la giornata si chiude e le ore mancanti diventano permesso.',
      ],
    },
    {
      id: 'pausa-sigaretta',
      sezione: 'I bottoni',
      azione: 'PAUSA_SIGARETTA',
      domanda: 'Pausa sigaretta',
      testo: [
        `Registra un'uscita in permesso e apre una schermata con il conto alla rovescia di ${tolleranza}: la sigaretta si consuma mentre il tempo passa. Quando torni tocca "Rientro".`,
        `Negli ultimi 30 secondi lo schermo lampeggia di rosso; oltre la tolleranza ${fineSigaretta} e lo sfondo resta rosso finché non rientri.`,
        `• Rientri entro ${tolleranza}: la pausa viene cancellata e non resta nessuna timbratura.`,
        '• Rientri dopo: la pausa diventa permesso a blocchi di 30 min (fino a 30 min → 30 min, fino a 1h → 1h, e così via).',
        'Le ore coperte e l\'uscita prevista non cambiano: il tempo del blocco oltre la pausa reale passa dalle ore lavorate al permesso.',
        'Esempio: pausa di 15 min → 30 min di permesso e 15 min in meno di lavorate; pausa di 42 min → 1h di permesso.',
        'Hai toccato il bottone per sbaglio? Usa "Annulla pausa" nella schermata. Se chiudi l\'app durante la pausa, alla riapertura il conto riprende da dove era.',
        'Tolleranza e tipo di sigaretta (normale o elettronica) si cambiano in Impostazioni → Pausa sigaretta.',
      ],
    },
    {
      id: 'entro-dopo',
      sezione: 'I bottoni',
      azione: 'PERMESSO_INIZIO_GIORNATA',
      domanda: 'Entro dopo (permesso a inizio giornata)',
      testo: [
        'Per gli ingressi posticipati: indichi quante ore di permesso prendi a inizio giornata (es. 2h). Non è un orario ma una durata, e conta come ore coperte.',
        'Puoi registrare l\'entrata insieme al permesso oppure aggiungere il permesso dopo, con "+ Permesso inizio giornata" sotto la timeline.',
        `Esempio con ${dovute} dovute: permesso 2h, entrata 10:30, pausa 12:30–13:30 → uscita prevista 17:30.`,
      ],
    },
    {
      id: 'permesso-uscita',
      sezione: 'I bottoni',
      domanda: 'Permesso in uscita (uscire prima)',
      testo: [
        'Se sai già che uscirai prima, tocca "+ Permesso in uscita" sotto la timeline e indica la durata (multipli di 30 min): l\'uscita prevista si anticipa di quel tempo.',
        'Quando esci usa il normale "Uscita": il permesso conteggiato è quello che manca davvero, a blocchi di 30 min.',
        'Esempio: uscita prevista 17:55 e 30 min di permesso in uscita → uscita prevista 17:25. Esci alle 17:25 → 30 min di permesso; alle 17:10 → 1h; dopo le 17:55 → nessun permesso.',
      ],
    },
    {
      id: 'riapri',
      sezione: 'I bottoni',
      azione: 'RIAPRI',
      domanda: 'Riapri giornata',
      testo: ['Elimina l\'ultima uscita (normale o anticipata) e riporta la giornata allo stato "Al lavoro". Utile se hai timbrato l\'uscita per sbaglio.'],
    },

    // --- Come si calcola
    {
      id: 'uscita-prevista',
      sezione: 'Come si calcola',
      domanda: 'Come viene calcolata l\'uscita prevista?',
      testo: [
        'Uscita prevista = adesso + (ore dovute − ore coperte).',
        `Se non hai ancora fatto la pausa e l'uscita cadrebbe dopo la fascia pranzo (${pranzo}), vengono aggiunti ${scalare} di pausa.`,
        'Quando l\'orario supera l\'uscita prevista compare "Ore completate alle…": da lì in poi è straordinario.',
        'Se hai inserito un permesso in uscita, l\'uscita prevista si anticipa di quella durata.',
      ],
    },
    {
      id: 'orario-minimo',
      sezione: 'Come si calcola',
      domanda: `Perché un'entrata prima delle ${minimo} non viene contata?`,
      testo: [
        `Ogni timbratura precedente le ${minimo} viene considerata come se fosse alle ${minimo}, in tutti i calcoli (uscita prevista, ore lavorate e saldo).`,
        `Esempio: entrata 08:00, pausa 12:00–13:00, uscita 18:00 → lavorate 8h30 (dalle ${minimo}), saldo +30 min.`,
        'L\'orario si cambia in Impostazioni → Conteggio.',
      ],
    },
    {
      id: 'pausa-minima',
      sezione: 'Come si calcola',
      domanda: `Perché una pausa breve conta ${pausaMin}?`,
      testo: [
        `Una pausa più breve di ${pausaMin} viene conteggiata come ${pausaMin}: la differenza viene tolta dalle ore lavorate.`,
        'Esempio: pausa 12:30–12:45 (15 min) → conta 30 min, quindi 15 min in meno di lavoro.',
        'Il valore si cambia in Impostazioni → Pausa pranzo.',
      ],
    },
    {
      id: 'ore-dovute',
      sezione: 'Come si calcola',
      domanda: 'Come imposto le ore dovute?',
      testo: [
        `In Impostazioni → Ore dovute: il valore predefinito (ora ${dovute}) vale per tutti i giorni con "predefinito" spuntato.`,
        'Per un giorno diverso (es. venerdì corto) togli la spunta e scegli le ore. 00:00 significa giorno libero: tutto ciò che lavori è straordinario.',
      ],
    },

    // --- Correggere gli errori
    {
      id: 'modifica',
      sezione: 'Correggere gli errori',
      domanda: 'Ho sbagliato o dimenticato una timbratura',
      testo: [
        'Tocca la timbratura nella timeline per cambiarne l\'orario o il tipo, oppure per eliminarla.',
        'Per una timbratura dimenticata usa "+ Aggiungi timbratura" e scegli tipo e orario. Le timbrature vengono sempre ordinate per orario.',
      ],
    },
    {
      id: 'da-correggere',
      sezione: 'Correggere gli errori',
      domanda: 'Cosa significa "Giornata da correggere"?',
      testo: [
        'La sequenza delle timbrature non è coerente: per esempio una "Fine pausa" senza "Inizio pausa", due entrate, o una giornata passata senza uscita.',
        'L\'app spiega il problema nel riquadro arancione e calcola i totali ignorando le timbrature incoerenti (evidenziate in rosso). Aggiungi, modifica o elimina le timbrature finché il riquadro sparisce.',
      ],
    },
    {
      id: 'giorno-passato',
      sezione: 'Correggere gli errori',
      domanda: 'Come inserisco una giornata passata?',
      testo: ['In Storico tocca "+ Giornata dimenticata", scegli la data e aggiungi le timbrature con "+ Aggiungi timbratura".'],
    },

    // --- Storico
    {
      id: 'storico',
      sezione: 'Storico e riepilogo',
      domanda: 'Cosa mostra lo Storico?',
      testo: [
        'Per ogni giorno vedi tre voci: Lavoro, Straordinario e Permesso. Un trattino (–) significa zero.',
        '• Lavoro: le ore lavorate fino alle ore dovute, al netto del permesso.',
        '• Straordinario: il lavoro oltre le ore dovute, contato a blocchi da 30 minuti. 20 minuti in più non contano, 50 minuti valgono 30.',
        '• Permesso: le ore di permesso usate, sempre a blocchi da 30 minuti.',
        'Se in un giorno mancano ore, sotto compare "Mancano …". In alto il riepilogo del mese somma le tre voci; sotto trovi il saldo esatto, che non è arrotondato.',
        'La giornata di oggi non entra nel saldo del mese finché non è chiusa. Tocca un giorno per vederlo e correggerlo.',
      ],
    },
    {
      id: 'straordinario-blocchi',
      sezione: 'Storico e riepilogo',
      domanda: 'Perché 20 minuti di lavoro in più non compaiono?',
      testo: [
        'Lo straordinario viene contato solo a blocchi interi da 30 minuti, sempre per difetto: 20 minuti non contano, 50 minuti valgono 30, 1h10 vale 1h.',
        'Il saldo esatto del mese (sotto le tre voci) conserva invece tutti i minuti, senza arrotondare.',
      ],
    },

    // --- Dati
    {
      id: 'dove-dati',
      sezione: 'Dati e backup',
      domanda: 'Dove sono salvati i miei dati?',
      testo: [
        'Solo su questo telefono, nella memoria dell\'app: non vengono inviati a nessun server.',
        '• iPhone: se elimini l\'app dalla schermata Home, iOS cancella anche i dati.',
        '• Android: l\'app condivide i dati con Chrome, quindi se cancelli i dati del sito o disinstalli l\'app perdi le timbrature.',
        'In ogni caso, fai un backup ogni tanto.',
      ],
    },
    {
      id: 'backup',
      sezione: 'Dati e backup',
      domanda: 'Come faccio un backup o esporto in Excel?',
      testo: [
        '• Esporta CSV (Excel): una riga per giorno, separatore ";" e decimali con la virgola, si apre direttamente in Excel.',
        '• Esporta backup completo (JSON): tutte le timbrature e le impostazioni. Salvalo in File o iCloud Drive (iPhone), oppure in Drive o File (Android).',
        '• Importa: un backup JSON sostituisce tutti i dati; un CSV aggiunge le giornate (sovrascrivendo quelle con la stessa data) senza toccare le impostazioni.',
      ],
    },

    // --- Avvisi
    {
      id: 'avvisi',
      sezione: 'Avvisi',
      domanda: 'Come funzionano gli avvisi?',
      testo: [
        'Nell\'app per Android ricevi una notifica, anche ad app chiusa, in tre momenti:',
        '• Uscita prevista: quando puoi andare via. Si programma mentre sei al lavoro e si aggiorna se modifichi le timbrature.',
        `• Rientro dal pranzo: ${pranzoAvviso} dopo l'inizio della pausa. La durata si cambia in Impostazioni → Avvisi.`,
        `• Pausa sigaretta: 1 minuto prima della fine della tolleranza (${tolleranza}), per rientrare prima che diventi permesso.`,
        'Ogni avviso si può disattivare dalle Impostazioni. Nessun avviso se la giornata è chiusa, da correggere o se l\'orario è già passato.',
        'Gli avvisi sono programmati sul telefono: non serve connessione e nessun dato esce dal dispositivo. Nella PWA (Safari o Chrome) non sono disponibili.',
      ],
    },
    {
      id: 'avvisi-non-arrivano',
      sezione: 'Avvisi',
      domanda: 'Gli avvisi non arrivano o arrivano in ritardo',
      testo: [
        '• Controlla in Impostazioni → Avvisi che le notifiche siano autorizzate; se serve tocca "Autorizza gli avvisi".',
        '• Su Android 12 e successivi concedi anche "Sveglie e promemoria" all\'app: senza, gli avvisi possono ritardare di qualche minuto.',
        '• Nelle impostazioni di Android (App → Krumiro) togli le limitazioni della batteria: alcune marche (Xiaomi, Huawei, Samsung in risparmio energetico) bloccano le notifiche delle app chiuse.',
        '• Se hai attivato "Non disturbare" o una modalità Focus, le notifiche vengono silenziate.',
      ],
    },

    // --- Installazione
    {
      id: 'installazione',
      sezione: 'Installazione',
      domanda: 'Come installo l\'app sull\'iPhone?',
      testo: [
        '• Apri il sito con Safari (le altre app non permettono l\'installazione).',
        '• Tocca Condividi (il quadrato con la freccia in su).',
        '• Scegli "Aggiungi alla schermata Home" e conferma.',
        'Apri sempre l\'app dall\'icona: funziona anche offline e i dati dell\'icona sono separati da quelli di Safari.',
      ],
    },
    {
      id: 'installazione-android',
      sezione: 'Installazione',
      domanda: 'Come installo l\'app su Android?',
      testo: [
        '• Apri il sito con Chrome.',
        '• Tocca il menu ⋮ in alto a destra.',
        '• Scegli "Installa app" (su alcune versioni "Aggiungi a schermata Home", poi "Installa") e conferma.',
        'Apri l\'app dall\'icona: parte a tutto schermo e funziona anche offline.',
        'Con Samsung Internet usa il menu ☰ → "Aggiungi pagina a" → "Schermata Home"; con Firefox ⋮ → "Installa". Se la voce non compare, ricarica la pagina e riprova.',
      ],
    },
    {
      id: 'installazione-app',
      sezione: 'Installazione',
      domanda: 'C\'è un\'app per Android con gli avvisi?',
      testo: [
        '• Scarica il file APK dalla pagina delle release del progetto su GitHub.',
        '• Aprilo: Android chiede di consentire l\'installazione da questa fonte. Conferma e installa.',
        '• Alla prima apertura autorizza le notifiche (Impostazioni → Avvisi → Autorizza gli avvisi).',
        'L\'app ha dati separati dalla PWA: per portarli con te esporta il backup JSON dalla PWA e importalo nell\'app. Gli aggiornamenti si installano scaricando il nuovo APK.',
      ],
    },
    {
      id: 'aggiornamenti',
      sezione: 'Installazione',
      domanda: 'Come si aggiorna?',
      testo: ['Da sola: quando c\'è una nuova versione viene scaricata in background e usata dall\'apertura successiva. I dati non vengono toccati.'],
    },
  ];
}

/** Ricerca senza distinzione tra maiuscole/minuscole e accenti. */
export function filtraAiuto(voci: VoceAiuto[], query: string): VoceAiuto[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const parole = norm(query).split(/\s+/).filter(Boolean);
  if (parole.length === 0) return voci;
  return voci.filter((v) => {
    const t = norm(`${v.domanda} ${v.sezione} ${v.testo.join(' ')}`);
    return parole.every((p) => t.includes(p));
  });
}

/** Voce di aiuto per un'azione (per i link contestuali). */
export function aiutoPerAzione(voci: VoceAiuto[], azione: Azione): VoceAiuto | undefined {
  return voci.find((v) => v.azione === azione);
}
