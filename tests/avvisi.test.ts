import { describe, expect, it } from 'vitest';
import { ID_AVVISO, pianificaAvvisi } from '../src/core/avvisi';
import { formattaOra } from '../src/core/tempo';
import { GIOVEDI, giornata, h, impostazioni } from './helpers';

const imp = impostazioni();
const piano = (g: ReturnType<typeof giornata>, ora: string, i = imp) =>
  pianificaAvvisi(g, i, { data: GIOVEDI, minuti: h(ora) }).map((a) => `${a.tipo} ${formattaOra(a.minuti)}`);

function conAvvisi(modifiche: Partial<typeof imp.avvisi>) {
  return impostazioni({ avvisi: { ...imp.avvisi, ...modifiche } });
}

describe('avviso di uscita prevista', () => {
  it('al lavoro prima della pausa: include la pausa pranzo', () => {
    expect(piano(giornata([['ENTRATA', '08:30']]), '09:00')).toEqual(['uscita 17:30']);
  });

  it('dopo la pausa: uscita prevista dalle timbrature', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30']]);
    expect(piano(g, '14:00')).toEqual(['uscita 17:30']);
  });

  it('non cambia mentre si lavora', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30']]);
    expect(piano(g, '13:30')).toEqual(piano(g, '16:59'));
  });

  it('nessun avviso se l\'uscita prevista è già passata', () => {
    const g = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30']]);
    expect(piano(g, '18:00')).toEqual([]);
  });

  it('tiene conto del permesso a inizio giornata', () => {
    const g = giornata([['ENTRATA', '10:30']], { permessoInizio: 120 });
    expect(piano(g, '10:30')).toEqual(['uscita 17:30']);
  });

  it('disattivato nelle impostazioni', () => {
    expect(piano(giornata([['ENTRATA', '08:30']]), '09:00', conAvvisi({ uscita: false }))).toEqual([]);
  });
});

describe('avviso di rientro dalla pausa pranzo', () => {
  const inPausa = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30']]);

  it('30 minuti dopo l\'inizio della pausa, e niente avviso di uscita', () => {
    expect(piano(inPausa, '12:30')).toEqual(['pausa 13:00']);
  });

  it('durata configurabile', () => {
    expect(piano(inPausa, '12:30', conAvvisi({ pranzoMinuti: 45 }))).toEqual(['pausa 13:15']);
    expect(piano(inPausa, '12:30', conAvvisi({ pranzoMinuti: 60 }))).toEqual(['pausa 13:30']);
  });

  it('parte dall\'inizio reale della pausa, anche se la si apre più tardi', () => {
    expect(piano(inPausa, '12:50')).toEqual(['pausa 13:00']);
  });

  it('nessun avviso se la durata è già trascorsa', () => {
    expect(piano(inPausa, '13:10')).toEqual([]);
  });

  it('disattivato nelle impostazioni', () => {
    expect(piano(inPausa, '12:30', conAvvisi({ pranzo: false }))).toEqual([]);
  });
});

describe('avviso di rientro dalla pausa sigaretta', () => {
  const sigaretta = () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']]);
    g.eventi[1]!.sigaretta = true;
    return g;
  };

  it('alla scadenza della tolleranza (11 minuti di default)', () => {
    expect(piano(sigaretta(), '10:00')).toEqual(['sigaretta 10:11']);
  });

  it('segue la tolleranza configurata', () => {
    expect(piano(sigaretta(), '10:00', impostazioni({ tolleranzaSigaretta: 5 }))).toEqual(['sigaretta 10:05']);
  });

  it('con tolleranza 0 non c\'è niente da avvisare', () => {
    expect(piano(sigaretta(), '10:00', impostazioni({ tolleranzaSigaretta: 0 }))).toEqual([]);
  });

  it('nessun avviso a tolleranza scaduta', () => {
    expect(piano(sigaretta(), '10:20')).toEqual([]);
  });

  it('un permesso normale non genera avvisi', () => {
    const g = giornata([['ENTRATA', '08:30'], ['USCITA_PERMESSO', '10:00']]);
    expect(piano(g, '10:05')).toEqual([]);
  });

  it('disattivato nelle impostazioni', () => {
    expect(piano(sigaretta(), '10:00', conAvvisi({ sigaretta: false }))).toEqual([]);
  });
});

describe('quando non programmare avvisi', () => {
  it('giornata non iniziata o chiusa', () => {
    expect(piano(giornata([]), '09:00')).toEqual([]);
    const chiusa = giornata([['ENTRATA', '08:30'], ['INIZIO_PAUSA', '12:30'], ['FINE_PAUSA', '13:30'], ['USCITA', '17:30']]);
    expect(piano(chiusa, '17:31')).toEqual([]);
  });

  it('giornata da correggere', () => {
    const g = giornata([['ENTRATA', '08:30'], ['FINE_PAUSA', '13:30']]);
    expect(piano(g, '14:00')).toEqual([]);
  });

  it('giornata di un altro giorno', () => {
    const g = giornata([['ENTRATA', '08:30']], { data: '2026-09-30' });
    expect(pianificaAvvisi(g, imp, { data: GIOVEDI, minuti: h('09:00') })).toEqual([]);
  });

  it('niente avvisi oltre la mezzanotte', () => {
    const g = giornata([['ENTRATA', '20:00']]);
    expect(piano(g, '20:05')).toEqual([]); // 20:00 + 8h + pausa supera le 24:00
  });

  it('id numerici distinti per tipo', () => {
    expect(new Set(Object.values(ID_AVVISO)).size).toBe(3);
  });
});

describe('impostazioni degli avvisi', () => {
  it('predefiniti: tutti attivi, pausa pranzo 30 minuti', () => {
    expect(imp.avvisi).toEqual({ uscita: true, sigaretta: true, pranzo: true, pranzoMinuti: 30 });
  });
});
