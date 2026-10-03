import { describe, expect, it } from 'vitest';
import {
  countdown,
  esitoRientroSigaretta,
  istanteDaMinuti,
  permessoSigaretta,
  sigarettaDaRiprendere,
  sigarettaInCorso,
  spegnimentoDaAnimare,
  testoTimer,
} from '../src/core/sigaretta';
import { giornata, h } from './helpers';

describe('permesso a blocchi', () => {
  it('arrotonda alla mezz\'ora successiva, almeno un blocco', () => {
    expect(permessoSigaretta(0)).toBe(30);
    expect(permessoSigaretta(1)).toBe(30);
    expect(permessoSigaretta(12)).toBe(30);
    expect(permessoSigaretta(30)).toBe(30);
    expect(permessoSigaretta(31)).toBe(60);
    expect(permessoSigaretta(60)).toBe(60);
    expect(permessoSigaretta(61)).toBe(90);
  });
});

describe('esito del rientro', () => {
  it('entro la tolleranza (al secondo) si annulla, oltre è permesso', () => {
    expect(esitoRientroSigaretta(0, 11)).toBe('annulla');
    expect(esitoRientroSigaretta(11 * 60_000, 11)).toBe('annulla');
    expect(esitoRientroSigaretta(11 * 60_000 + 1000, 11)).toBe('permesso');
  });

  it('con tolleranza 0 ogni pausa è permesso', () => {
    expect(esitoRientroSigaretta(1000, 0)).toBe('permesso');
  });
});

describe('countdown', () => {
  it('parte da 11:00 e scende arrotondando per eccesso', () => {
    expect(testoTimer(countdown(0, 11))).toBe('11:00');
    expect(testoTimer(countdown(18_000, 11))).toBe('10:42');
    expect(testoTimer(countdown(18_500, 11))).toBe('10:42');
    expect(testoTimer(countdown(11 * 60_000, 11))).toBe('00:00');
  });

  it('oltre la tolleranza conta in avanti con il +', () => {
    const c = countdown(11 * 60_000 + 150_000, 11);
    expect(c.scaduta).toBe(true);
    expect(c.consumata).toBe(1);
    expect(testoTimer(c)).toBe('+02:30');
  });

  it('la sigaretta si consuma in proporzione al tempo', () => {
    expect(countdown(0, 11).consumata).toBe(0);
    expect(countdown(330_000, 11).consumata).toBeCloseTo(0.5);
    expect(countdown(-5000, 11).consumata).toBe(0);
  });

  it('con tolleranza 0 la sigaretta parte già consumata', () => {
    const c = countdown(0, 0);
    expect(c.consumata).toBe(1);
    expect(testoTimer(countdown(2000, 0))).toBe('+00:02');
  });
});

describe('fasi della schermata', () => {
  const s = 1000;
  const tolleranza = 11 * 60_000;

  it('accesa finché mancano più di 30 secondi', () => {
    expect(countdown(0, 11).fase).toBe('accesa');
    expect(countdown(tolleranza - 30 * s - 1, 11).fase).toBe('accesa');
  });

  it('ultimi negli ultimi 30 secondi, compresa la tolleranza esatta', () => {
    expect(countdown(tolleranza - 30 * s, 11).fase).toBe('ultimi');
    expect(testoTimer(countdown(tolleranza - 30 * s, 11))).toBe('00:30');
    expect(countdown(tolleranza, 11).fase).toBe('ultimi');
  });

  it('scaduta oltre la tolleranza, insieme all\'esito del rientro', () => {
    const c = countdown(tolleranza + 1, 11);
    expect(c.fase).toBe('scaduta');
    expect(c.scaduta).toBe(true);
  });

  it('con tolleranza 1 min il lampeggio parte a metà', () => {
    expect(countdown(29 * s, 1).fase).toBe('accesa');
    expect(countdown(30 * s, 1).fase).toBe('ultimi');
  });

  it('con tolleranza 0 è scaduta da subito', () => {
    expect(countdown(0, 0).fase).toBe('scaduta');
    expect(countdown(2000, 0).fase).toBe('scaduta');
  });
});

describe('sequenza di spegnimento', () => {
  it('parte quando la pausa scade con la schermata aperta', () => {
    expect(spegnimentoDaAnimare('accesa', 'scaduta')).toBe(true);
    expect(spegnimentoDaAnimare('ultimi', 'scaduta')).toBe(true);
  });

  it('non parte aprendo la schermata già scaduta, né di nuovo ai secondi successivi', () => {
    expect(spegnimentoDaAnimare(null, 'scaduta')).toBe(false);
    expect(spegnimentoDaAnimare('scaduta', 'scaduta')).toBe(false);
    expect(spegnimentoDaAnimare('accesa', 'ultimi')).toBe(false);
    expect(spegnimentoDaAnimare(null, 'accesa')).toBe(false);
  });
});

describe('istante di inizio ricavato dalla timbratura', () => {
  it('usa il minuto della timbratura a secondi zero (ora di Roma)', () => {
    // 08:20:35.500 UTC = 10:20:35.500 a Roma (ora legale); uscita alle 10:05.
    const ora = new Date('2026-10-02T08:20:35.500Z');
    expect(istanteDaMinuti(h('10:05'), ora)).toBe(Date.parse('2026-10-02T08:05:00.000Z'));
  });
});

describe('pausa sigaretta in corso', () => {
  it('trova l\'uscita sigaretta che ha aperto il permesso', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:05'],
    ]);
    expect(sigarettaInCorso(g)).toBeNull();
    g.eventi[1]!.sigaretta = true;
    expect(sigarettaInCorso(g)?.id).toBe(g.eventi[1]!.id);
  });

  it('nessuna pausa in corso dopo il rientro', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:05'],
      ['RIENTRO_PERMESSO', '10:20'],
    ]);
    g.eventi[1]!.sigaretta = true;
    expect(sigarettaInCorso(g)).toBeNull();
  });
});

describe('schermata da riaprire da sola', () => {
  it('sì se la pausa è in corso e la giornata è coerente', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['USCITA_PERMESSO', '10:05'],
    ]);
    g.eventi[1]!.sigaretta = true;
    expect(sigarettaDaRiprendere(g)?.id).toBe(g.eventi[1]!.id);
  });

  it('no se la giornata ha timbrature incoerenti (es. rientro spostato prima dell’uscita)', () => {
    const g = giornata([
      ['ENTRATA', '08:30'],
      ['RIENTRO_PERMESSO', '10:02'],
      ['USCITA_PERMESSO', '10:05'],
    ]);
    g.eventi[2]!.sigaretta = true;
    expect(sigarettaInCorso(g)?.id).toBe(g.eventi[2]!.id);
    expect(sigarettaDaRiprendere(g)).toBeNull();
  });
});
