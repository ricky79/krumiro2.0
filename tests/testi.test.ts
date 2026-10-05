import { describe, expect, it } from 'vitest';
import { calcolaGiornata } from '../src/core/calcolo';
import { testoPausa } from '../src/core/testi';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni();

describe('testo della pausa nel riepilogo', () => {
  it('senza pausa mostra un trattino', () => {
    expect(testoPausa(calcolaGiornata(giornata([['ENTRATA', '08:30']]), imp, h('10:00')))).toBe('—');
  });

  it('una pausa normale mostra la sua durata', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:15']]);
    expect(testoPausa(calcolaGiornata(g, imp, h('14:00')))).toBe('45 min');
  });

  it('sotto la pausa minima mostra il conteggiato e quella fatta davvero', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '12:50']]);
    expect(testoPausa(calcolaGiornata(g, imp, h('14:00')))).toBe('30 min (fatta 20 min)');
  });

  it('durante la pausa mostra il tempo trascorso', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']]);
    expect(testoPausa(calcolaGiornata(g, imp, h('12:52')))).toBe('22 min');
  });

  it('la pausa ricavata da un permesso sul pranzo conta come pausa', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '12:00'], ['RIENTRO_PERMESSO', '14:30']]);
    expect(testoPausa(calcolaGiornata(g, imp, h('15:00')))).toBe('1h');
  });
});
