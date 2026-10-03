import { describe, expect, it } from 'vitest';
import { pausaDaProporre } from '../src/core/pausaPranzo';
import { giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const mattina = () => giornata([['ENTRATA', '08:30']]);

describe('pausa pranzo da proporre', () => {
  it('prima della fine della fascia pranzo non propone nulla', () => {
    expect(pausaDaProporre(mattina(), imp, h('14:29'))).toBeNull();
  });

  it('dopo la fascia, senza pausa, propone 12:15–12:45', () => {
    expect(pausaDaProporre(mattina(), imp, h('14:30'))).toEqual({ inizio: h('12:15'), fine: h('12:45') });
  });

  it('non propone se la pausa è registrata', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '13:00'], ['FINE_PAUSA', '13:30']]);
    expect(pausaDaProporre(g, imp, h('15:00'))).toBeNull();
  });

  it('non propone se un permesso copre il pranzo', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '12:00'], ['RIENTRO_PERMESSO', '13:30']]);
    expect(pausaDaProporre(g, imp, h('15:00'))).toBeNull();
  });

  it('non propone se a quell\'ora non eri al lavoro', () => {
    expect(pausaDaProporre(giornata([['ENTRATA', '13:00']]), imp, h('15:00'))).toBeNull();
    expect(pausaDaProporre(giornata([['ENTRATA', '08:30'], ['USCITA', '12:30']]), imp, h('15:00'))).toBeNull();
    expect(pausaDaProporre(giornata([]), imp, h('15:00'))).toBeNull();
  });

  it('non propone con timbrature incoerenti', () => {
    const g = giornata([['ENTRATA', '08:30'], ['FINE_PAUSA', '10:00']]);
    expect(pausaDaProporre(g, imp, h('15:00'))).toBeNull();
  });

  it('a giornata chiusa senza pausa la propone', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA', '17:00']]);
    expect(pausaDaProporre(g, imp, h('17:30'))).toEqual({ inizio: h('12:15'), fine: h('12:45') });
  });

  it('segue la fascia pranzo delle impostazioni', () => {
    const tardi = impostazioni({ pranzo: { inizio: h('13:00'), fine: h('15:00') } });
    expect(pausaDaProporre(mattina(), tardi, h('15:00'))).toEqual({ inizio: h('13:15'), fine: h('13:45') });
  });

  it('se la pausa non sta nella fascia non propone nulla', () => {
    const corta = impostazioni({ pranzo: { inizio: h('12:00'), fine: h('12:30') } });
    expect(pausaDaProporre(mattina(), corta, h('13:00'))).toBeNull();
  });

  it('per le giornate passate non propone nulla', () => {
    expect(pausaDaProporre(mattina(), imp, null)).toBeNull();
  });
});
